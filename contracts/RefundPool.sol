// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RefundPool
 * @notice Standalone USDC vault used to back vendor refunds. Funded manually
 *         by admin top-ups initially; future versions may route a percentage
 *         of donations here automatically.
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE  : admin EOA / multisig (withdraw, role mgmt)
 *   - REDEMPTION_ROLE     : VendorRedemptionV2 (calls payRefund)
 */
contract RefundPool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REDEMPTION_ROLE = keccak256("REDEMPTION_ROLE");

    IERC20 public immutable usdc;

    uint256 public totalDeposited;
    uint256 public totalPaidOut;
    mapping(address => uint256) public paidPerVendor; // tracked by `to` arg (treasury or vendor)

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event RefundPaid(bytes32 indexed chargeId, address indexed to, uint256 amount);

    constructor(address admin, address usdc_) {
        require(admin != address(0) && usdc_ != address(0), "zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        usdc = IERC20(usdc_);
    }

    /// @notice Deposit USDC into the pool. Anyone may top up.
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Pay a refund. Only callable by VendorRedemptionV2.
    function payRefund(bytes32 chargeId, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(REDEMPTION_ROLE)
    {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        totalPaidOut += amount;
        paidPerVendor[to] += amount;
        usdc.safeTransfer(to, amount);
        emit RefundPaid(chargeId, to, amount);
    }

    /// @notice Admin withdraw (rebalance back to treasury, etc.).
    function withdraw(address to, uint256 amount) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "to=0");
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice USDC balance available to pay out.
    function available() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
