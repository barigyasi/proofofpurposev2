// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPurposeBurnable {
    function burnFrom(address account, uint256 amount) external;
}

/**
 * @title VendorRedemptionV2
 * @notice Champions redeem PURPOSE for USDC at approved vendors.
 *         The contract burns PURPOSE from the champion (requires prior
 *         `approve(VendorRedemption, amount)` from the champion's smart wallet)
 *         and pays USDC to the vendor from the treasury.
 *
 * Rates and treasury can be tuned by DEFAULT_ADMIN_ROLE. VENDOR_ADMIN_ROLE
 * approves/revokes vendors. Champions never need to interact with this
 * contract directly — the POP POS / online checkout build the tx.
 */
contract VendorRedemptionV2 is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VENDOR_ADMIN_ROLE = keccak256("VENDOR_ADMIN_ROLE");
    bytes32 public constant VENDOR_ROLE = keccak256("VENDOR_ROLE");
    /// @notice Backend hot-key that settles authorized redemptions on behalf of any approved vendor.
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    IPurposeBurnable public immutable purposeToken;
    IERC20 public immutable usdc;
    address public treasury;

    /// @notice USDC paid per 1 PURPOSE (both 6-decimal scaled where applicable).
    /// @dev    payout = amountPurpose * rateNumerator / rateDenominator
    ///         Default 1 PURPOSE -> 1 USDC means num=1e6, denom=1e18.
    uint256 public rateNumerator;
    uint256 public rateDenominator;

    event VendorApproved(address indexed vendor);
    event VendorRevoked(address indexed vendor);
    event TreasuryUpdated(address indexed treasury);
    event RateUpdated(uint256 numerator, uint256 denominator);
    event Redeemed(
        address indexed vendor,
        address indexed champion,
        uint256 purposeBurned,
        uint256 usdcPaid
    );

    error NotApprovedVendor();

    constructor(
        address admin,
        address purpose_,
        address usdc_,
        address treasury_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VENDOR_ADMIN_ROLE, admin);
        purposeToken = IPurposeBurnable(purpose_);
        usdc = IERC20(usdc_);
        treasury = treasury_;
        rateNumerator = 1e6;     // 1 USDC (6 dec)
        rateDenominator = 1e18;  // per 1 PURPOSE (18 dec)
    }

    // ----------------------------- Admin -----------------------------

    function approveVendor(address vendor) external onlyRole(VENDOR_ADMIN_ROLE) {
        _grantRole(VENDOR_ROLE, vendor);
        emit VendorApproved(vendor);
    }

    function revokeVendor(address vendor) external onlyRole(VENDOR_ADMIN_ROLE) {
        _revokeRole(VENDOR_ROLE, vendor);
        emit VendorRevoked(vendor);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setRate(uint256 numerator, uint256 denominator)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(denominator > 0, "denom=0");
        rateNumerator = numerator;
        rateDenominator = denominator;
        emit RateUpdated(numerator, denominator);
    }

    // ---------------------------- Redeem ----------------------------

    /**
     * @notice Burn `amountPurpose` from `champion` and pay vendor in USDC.
     * @dev Caller must be an approved vendor. Champion must have given this
     *      contract an ERC20 allowance >= amountPurpose for PURPOSE.
     */
    function redeem(address champion, uint256 amountPurpose)
        external
        nonReentrant
        onlyRole(VENDOR_ROLE)
        returns (uint256 usdcPaid)
    {
        usdcPaid = _settle(msg.sender, champion, amountPurpose);
    }

    /**
     * @notice Settle a redemption on behalf of an approved vendor.
     *         Used by the backend settlement signer after the champion
     *         confirms a POP POS charge or online-shop checkout off-chain.
     */
    function redeemFor(address vendor, address champion, uint256 amountPurpose)
        external
        nonReentrant
        onlyRole(SETTLEMENT_ROLE)
        returns (uint256 usdcPaid)
    {
        if (!hasRole(VENDOR_ROLE, vendor)) revert NotApprovedVendor();
        usdcPaid = _settle(vendor, champion, amountPurpose);
    }

    function _settle(address vendor, address champion, uint256 amountPurpose)
        internal
        returns (uint256 usdcPaid)
    {
        purposeToken.burnFrom(champion, amountPurpose);
        usdcPaid = (amountPurpose * rateNumerator) / rateDenominator;
        usdc.safeTransferFrom(treasury, vendor, usdcPaid);
        emit Redeemed(vendor, champion, amountPurpose, usdcPaid);
    }

    function quoteUSDC(uint256 amountPurpose) external view returns (uint256) {
        return (amountPurpose * rateNumerator) / rateDenominator;
    }
}
