// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPurposeBurnable {
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IRefundPool {
    function payRefund(bytes32 chargeId, address to, uint256 amount) external;
}

interface IReceiptNFT {
    function mintReceipt(
        address champion,
        address vendor,
        uint256 usdcAmount,
        uint256 purposeAmount,
        bytes32 chargeId,
        uint64  settledAt,
        string calldata championName,
        string calldata vendorName
    ) external returns (uint256);
}

/**
 * @title VendorRedemptionV2
 * @notice Escrow-based redemption: champions exchange PURPOSE for USDC at
 *         approved vendors via a Lock -> Capture -> Settle -> (optional) Refund
 *         state machine, settled by a backend signer.
 *
 * Per-charge lifecycle:
 *   None  --lock(chargeId)-->         Locked       (PURPOSE + USDC pulled into this contract)
 *   Locked --capture()-->             Captured     (vendor confirmed fulfillment, auth window starts)
 *   Locked|Captured --cancel()-->     Cancelled    (return PURPOSE to champion, USDC to treasury)
 *   Captured --settle()-->            Settled      (USDC -> vendor; PURPOSE held until refund window closes)
 *   Settled --refund(source)-->       Refunded     (USDC pulled from vendor or refund pool back to treasury;
 *                                                   PURPOSE returned to champion)
 *   Settled --sweep()-->              Finalized    (after refund window: PURPOSE burned)
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE  : multisig / admin EOA
 *   - VENDOR_ADMIN_ROLE   : approve/revoke vendors, set per-vendor windows
 *   - VENDOR_ROLE         : approved vendors (used for direct vendor-side calls)
 *   - SETTLEMENT_ROLE     : backend hot-key (lock/capture/settle/cancel/refund on behalf of vendors)
 *   - REFUND_ADMIN_ROLE   : may force-refund or force-cancel outside normal windows
 */
contract VendorRedemptionV2 is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant VENDOR_ADMIN_ROLE = keccak256("VENDOR_ADMIN_ROLE");
    bytes32 public constant VENDOR_ROLE = keccak256("VENDOR_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant REFUND_ADMIN_ROLE = keccak256("REFUND_ADMIN_ROLE");

    enum State {
        None,
        Locked,
        Captured,
        Settled,
        Refunded,
        Cancelled,
        Finalized
    }

    enum RefundSource {
        Vendor, // pull USDC from vendor wallet (must have approved this contract)
        Pool    // pull USDC from RefundPool
    }

    struct Charge {
        address vendor;
        address champion;
        uint128 purposeAmount;
        uint128 usdcAmount;
        uint64  lockedAt;
        uint64  capturedAt;
        uint32  authWindow;   // seconds; snapshot from per-vendor or global at lock time
        uint32  refundWindow; // seconds; snapshot from per-vendor or global at lock time
        State   state;
    }

    struct VendorWindows {
        uint32 authWindow;
        uint32 refundWindow;
        bool   set;
    }

    IPurposeBurnable public immutable purposeToken;
    IERC20           public immutable usdc;
    address public treasury;
    IRefundPool public refundPool;
    IReceiptNFT public receiptNFT;

    /// @notice USDC paid per 1 PURPOSE. payout = amountPurpose * num / denom
    uint256 public rateNumerator;
    uint256 public rateDenominator;

    /// @notice Default windows applied when a vendor has no override.
    uint32 public defaultAuthWindow;   // e.g. 24h (cancel before settle)
    uint32 public defaultRefundWindow; // e.g. 7d  (refund after settle)

    mapping(address => VendorWindows) public vendorWindows;
    mapping(bytes32 => Charge) public charges;

    // --------------------------- Events ---------------------------
    event VendorApproved(address indexed vendor);
    event VendorRevoked(address indexed vendor);
    event VendorWindowsUpdated(address indexed vendor, uint32 authWindow, uint32 refundWindow);
    event DefaultWindowsUpdated(uint32 authWindow, uint32 refundWindow);
    event TreasuryUpdated(address indexed treasury);
    event RefundPoolUpdated(address indexed pool);
    event ReceiptNFTUpdated(address indexed nft);
    event ReceiptMintFailed(bytes32 indexed chargeId, string reason);
    event RateUpdated(uint256 numerator, uint256 denominator);

    event ChargeLocked(bytes32 indexed chargeId, address indexed vendor, address indexed champion, uint256 purposeAmount, uint256 usdcAmount);
    event ChargeCaptured(bytes32 indexed chargeId, uint64 capturedAt);
    event ChargeCancelled(bytes32 indexed chargeId);
    event ChargeSettled(bytes32 indexed chargeId, uint256 usdcPaid);
    event ChargeRefunded(bytes32 indexed chargeId, RefundSource source, uint256 usdcReturned);
    event ChargeFinalized(bytes32 indexed chargeId, uint256 purposeBurned);

    // --------------------------- Errors ---------------------------
    error NotApprovedVendor();
    error WrongState(State expected, State actual);
    error AuthWindowExpired();
    error AuthWindowActive();
    error RefundWindowExpired();
    error UnknownCharge();
    error AlreadyExists();
    error ZeroAddress();

    constructor(
        address admin,
        address purpose_,
        address usdc_,
        address treasury_
    ) {
        if (admin == address(0) || purpose_ == address(0) || usdc_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VENDOR_ADMIN_ROLE, admin);
        _grantRole(REFUND_ADMIN_ROLE, admin);
        purposeToken = IPurposeBurnable(purpose_);
        usdc = IERC20(usdc_);
        treasury = treasury_;
        rateNumerator = 1e6;     // 1 USDC (6 dec)
        rateDenominator = 1e18;  // per 1 PURPOSE (18 dec)
        defaultAuthWindow = 24 hours;
        defaultRefundWindow = 7 days;
    }

    // ------------------------- Admin -------------------------

    function approveVendor(address vendor) external onlyRole(VENDOR_ADMIN_ROLE) {
        _grantRole(VENDOR_ROLE, vendor);
        emit VendorApproved(vendor);
    }

    function revokeVendor(address vendor) external onlyRole(VENDOR_ADMIN_ROLE) {
        _revokeRole(VENDOR_ROLE, vendor);
        emit VendorRevoked(vendor);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setRefundPool(address pool_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        refundPool = IRefundPool(pool_); // allow zero to disable
        emit RefundPoolUpdated(pool_);
    }

    function setReceiptNFT(address nft_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        receiptNFT = IReceiptNFT(nft_); // allow zero to disable
        emit ReceiptNFTUpdated(nft_);
    }

    function setRate(uint256 numerator, uint256 denominator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(denominator > 0, "denom=0");
        rateNumerator = numerator;
        rateDenominator = denominator;
        emit RateUpdated(numerator, denominator);
    }

    function setDefaultWindows(uint32 authSecs, uint32 refundSecs) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultAuthWindow = authSecs;
        defaultRefundWindow = refundSecs;
        emit DefaultWindowsUpdated(authSecs, refundSecs);
    }

    function setVendorWindows(address vendor, uint32 authSecs, uint32 refundSecs)
        external onlyRole(VENDOR_ADMIN_ROLE)
    {
        vendorWindows[vendor] = VendorWindows({ authWindow: authSecs, refundWindow: refundSecs, set: true });
        emit VendorWindowsUpdated(vendor, authSecs, refundSecs);
    }

    function clearVendorWindows(address vendor) external onlyRole(VENDOR_ADMIN_ROLE) {
        delete vendorWindows[vendor];
        emit VendorWindowsUpdated(vendor, 0, 0);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ------------------------- Views -------------------------

    function quoteUSDC(uint256 amountPurpose) public view returns (uint256) {
        return (amountPurpose * rateNumerator) / rateDenominator;
    }

    function effectiveWindows(address vendor) public view returns (uint32 authSecs, uint32 refundSecs) {
        VendorWindows memory w = vendorWindows[vendor];
        if (w.set) return (w.authWindow, w.refundWindow);
        return (defaultAuthWindow, defaultRefundWindow);
    }

    // ------------------------- State machine -------------------------

    /**
     * @notice Lock a new charge: pull PURPOSE from champion + USDC from treasury.
     * @dev    Champion must have approved this contract for `purposeAmount` PURPOSE
     *         and treasury must have approved this contract for the USDC quote.
     */
    function lock(
        bytes32 chargeId,
        address vendor,
        address champion,
        uint256 purposeAmount
    ) external nonReentrant whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        _lock(chargeId, vendor, champion, purposeAmount);
    }

    /**
     * @notice Convenience: lock + immediately capture (POS flow has no separate fulfillment step).
     */
    function lockAndCapture(
        bytes32 chargeId,
        address vendor,
        address champion,
        uint256 purposeAmount
    ) external nonReentrant whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        _lock(chargeId, vendor, champion, purposeAmount);
        _capture(chargeId);
    }

    function capture(bytes32 chargeId) external nonReentrant whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        _capture(chargeId);
    }

    /**
     * @notice Cancel a Locked or (within auth window) Captured charge.
     *         Returns PURPOSE to champion + USDC to treasury.
     */
    function cancel(bytes32 chargeId) external nonReentrant whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        Charge storage c = charges[chargeId];
        if (c.state == State.None) revert UnknownCharge();
        if (c.state != State.Locked && c.state != State.Captured) revert WrongState(State.Locked, c.state);
        if (c.state == State.Captured && block.timestamp > uint256(c.capturedAt) + c.authWindow) {
            revert AuthWindowExpired();
        }
        c.state = State.Cancelled;

        // Return PURPOSE to champion, USDC to treasury.
        require(purposeToken.transfer(c.champion, c.purposeAmount), "PURPOSE return failed");
        usdc.safeTransfer(treasury, c.usdcAmount);
        emit ChargeCancelled(chargeId);
    }

    /**
     * @notice Settle a Captured charge after the auth window has elapsed.
     *         Pays USDC to vendor; PURPOSE stays held until refund window closes.
     *         REFUND_ADMIN_ROLE may force-settle before window expires.
     */
    function settle(bytes32 chargeId) external nonReentrant whenNotPaused {
        _settle(chargeId, "", "", false);
    }

    /**
     * @notice Same as settle(), but also mints a soulbound on-chain receipt NFT
     *         to the champion via `receiptNFT`. Names are passed in by the
     *         backend signer (off-chain profile data) and rendered into the SVG.
     *         If receiptNFT is unset, behaves like settle().
     */
    function settleWithReceipt(
        bytes32 chargeId,
        string calldata championName,
        string calldata vendorName
    ) external nonReentrant whenNotPaused {
        _settle(chargeId, championName, vendorName, true);
    }

    function _settle(
        bytes32 chargeId,
        string memory championName,
        string memory vendorName,
        bool mintReceipt
    ) internal {
        if (!hasRole(SETTLEMENT_ROLE, msg.sender) && !hasRole(REFUND_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, SETTLEMENT_ROLE);
        }
        Charge storage c = charges[chargeId];
        if (c.state == State.None) revert UnknownCharge();
        if (c.state != State.Captured) revert WrongState(State.Captured, c.state);
        bool isAdmin = hasRole(REFUND_ADMIN_ROLE, msg.sender);
        if (!isAdmin && block.timestamp < uint256(c.capturedAt) + c.authWindow) revert AuthWindowActive();

        c.state = State.Settled;
        // Snapshot capturedAt -> reuse field as settledAt for refund-window math.
        uint64 settledAt = uint64(block.timestamp);
        c.capturedAt = settledAt;

        usdc.safeTransfer(c.vendor, c.usdcAmount);
        emit ChargeSettled(chargeId, c.usdcAmount);

        if (mintReceipt && address(receiptNFT) != address(0)) {
            try receiptNFT.mintReceipt(
                c.champion, c.vendor, c.usdcAmount, c.purposeAmount,
                chargeId, settledAt, championName, vendorName
            ) {} catch Error(string memory reason) {
                emit ReceiptMintFailed(chargeId, reason);
            } catch {
                emit ReceiptMintFailed(chargeId, "unknown");
            }
        }
    }

    /**
     * @notice Refund a Settled charge within the refund window.
     *         USDC is pulled from vendor (must have approved this contract for USDC)
     *         or from RefundPool. PURPOSE held in escrow is returned to champion.
     */
    function refund(bytes32 chargeId, RefundSource source) external nonReentrant whenNotPaused {
        Charge storage c = charges[chargeId];
        if (c.state == State.None) revert UnknownCharge();
        if (c.state != State.Settled) revert WrongState(State.Settled, c.state);

        bool isAdmin = hasRole(REFUND_ADMIN_ROLE, msg.sender);
        bool isSettlement = hasRole(SETTLEMENT_ROLE, msg.sender);
        bool isVendor = msg.sender == c.vendor;
        if (!isAdmin && !isSettlement && !isVendor) {
            revert AccessControlUnauthorizedAccount(msg.sender, SETTLEMENT_ROLE);
        }
        if (!isAdmin && block.timestamp > uint256(c.capturedAt) + c.refundWindow) {
            revert RefundWindowExpired();
        }

        c.state = State.Refunded;

        // Source funds back to treasury so accounting stays clean.
        if (source == RefundSource.Vendor) {
            usdc.safeTransferFrom(c.vendor, treasury, c.usdcAmount);
        } else {
            require(address(refundPool) != address(0), "no pool");
            refundPool.payRefund(chargeId, treasury, c.usdcAmount);
        }

        // Return held PURPOSE to champion.
        require(purposeToken.transfer(c.champion, c.purposeAmount), "PURPOSE return failed");
        emit ChargeRefunded(chargeId, source, c.usdcAmount);
    }

    /**
     * @notice After the refund window expires on a Settled charge, anyone can
     *         finalize it: burn the held PURPOSE.
     */
    function sweep(bytes32 chargeId) external nonReentrant whenNotPaused {
        Charge storage c = charges[chargeId];
        if (c.state == State.None) revert UnknownCharge();
        if (c.state != State.Settled) revert WrongState(State.Settled, c.state);
        if (block.timestamp <= uint256(c.capturedAt) + c.refundWindow) revert RefundWindowExpired();

        c.state = State.Finalized;
        purposeToken.burn(c.purposeAmount);
        emit ChargeFinalized(chargeId, c.purposeAmount);
    }

    // ------------------------- Internal -------------------------

    function _lock(
        bytes32 chargeId,
        address vendor,
        address champion,
        uint256 purposeAmount
    ) internal {
        if (!hasRole(VENDOR_ROLE, vendor)) revert NotApprovedVendor();
        Charge storage c = charges[chargeId];
        if (c.state != State.None) revert AlreadyExists();

        uint256 usdcAmount = quoteUSDC(purposeAmount);
        require(purposeAmount <= type(uint128).max, "PURPOSE overflow");
        require(usdcAmount <= type(uint128).max, "USDC overflow");

        (uint32 authSecs, uint32 refundSecs) = effectiveWindows(vendor);

        c.vendor = vendor;
        c.champion = champion;
        c.purposeAmount = uint128(purposeAmount);
        c.usdcAmount = uint128(usdcAmount);
        c.lockedAt = uint64(block.timestamp);
        c.authWindow = authSecs;
        c.refundWindow = refundSecs;
        c.state = State.Locked;

        // Pull PURPOSE from champion (requires prior approve).
        require(purposeToken.transferFrom(champion, address(this), purposeAmount), "PURPOSE pull failed");
        // Pull USDC from treasury (requires treasury approve).
        usdc.safeTransferFrom(treasury, address(this), usdcAmount);

        emit ChargeLocked(chargeId, vendor, champion, purposeAmount, usdcAmount);
    }

    function _capture(bytes32 chargeId) internal {
        Charge storage c = charges[chargeId];
        if (c.state == State.None) revert UnknownCharge();
        if (c.state != State.Locked) revert WrongState(State.Locked, c.state);
        c.state = State.Captured;
        c.capturedAt = uint64(block.timestamp);
        emit ChargeCaptured(chargeId, c.capturedAt);
    }
}
