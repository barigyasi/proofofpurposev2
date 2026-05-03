// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PurposeTokenV2
 * @notice Restricted-transfer ERC20 used as community credit for Proof of Purpose.
 *
 * Transfer rules (enforced in _update):
 *   - Mints (from == 0) are always allowed for MINTER_ROLE callers (BountyManager).
 *   - Burns (to == 0) are always allowed (champion redemption via VendorRedemption).
 *   - Peer-to-peer transfers are blocked UNLESS either `from` or `to` is on the
 *     `transferAllowed` whitelist (e.g. VendorRedemption, Treasury, migration helper).
 *
 * This makes PURPOSE behave as a soulbound community credit while preserving
 * the controlled redemption / clawback / migration paths the app needs.
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE   : multisig / deployer; can grant/revoke other roles.
 *   - MINTER_ROLE          : BountyManagerV2 (mints rewards on bounty completion).
 *   - TRANSFER_ADMIN_ROLE  : manages the `transferAllowed` whitelist.
 */
contract PurposeTokenV2 is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRANSFER_ADMIN_ROLE = keccak256("TRANSFER_ADMIN_ROLE");

    /// @notice Addresses that may send OR receive PURPOSE in a peer-to-peer transfer.
    mapping(address => bool) public transferAllowed;

    event TransferAllowedSet(address indexed account, bool allowed);

    error TransferRestricted();

    constructor(address admin)
        ERC20("Proof of Purpose", "PURPOSE")
        ERC20Permit("Proof of Purpose")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TRANSFER_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Mint (BountyManager only)
    // ---------------------------------------------------------------------

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // ---------------------------------------------------------------------
    // Transfer whitelist
    // ---------------------------------------------------------------------

    function setTransferAllowed(address account, bool allowed)
        external
        onlyRole(TRANSFER_ADMIN_ROLE)
    {
        transferAllowed[account] = allowed;
        emit TransferAllowedSet(account, allowed);
    }

    function setTransferAllowedBatch(address[] calldata accounts, bool allowed)
        external
        onlyRole(TRANSFER_ADMIN_ROLE)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            transferAllowed[accounts[i]] = allowed;
            emit TransferAllowedSet(accounts[i], allowed);
        }
    }

    // ---------------------------------------------------------------------
    // Restricted transfer hook
    // ---------------------------------------------------------------------

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
    {
        // Allow mints, burns, and any transfer touching a whitelisted address.
        if (
            from == address(0) ||
            to == address(0) ||
            transferAllowed[from] ||
            transferAllowed[to]
        ) {
            super._update(from, to, value);
            return;
        }
        revert TransferRestricted();
    }
}
