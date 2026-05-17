// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title vPURPOSE — Proof of Purpose Vote Token
 * @notice Shadow ERC20Votes token kept 1:1 in sync with active monthly
 *         membership NFTs by the protocol's backend signer. Used as the voting
 *         power source for the thirdweb Vote contract.
 *
 *         Transfers are BLOCKED — vPURPOSE is purely a checkpointed governance
 *         credit. Mint and burn are the only supply changes, both restricted
 *         to MINTER_ROLE (the backend signer).
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE : admin EOA / multisig
 *   - MINTER_ROLE        : backend signer (mints on membership activation,
 *                          burns on expiry/cancellation)
 */
contract VPurposeToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    error TransfersDisabled();

    constructor(address admin)
        ERC20("Proof of Purpose Vote", "vPURPOSE")
        ERC20Permit("Proof of Purpose Vote")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------- Supply (backend signer) --------

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    // -------- Non-transferable --------

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        // Allow mint (from==0) and burn (to==0); block all other transfers.
        if (from != address(0) && to != address(0)) revert TransfersDisabled();
        super._update(from, to, value);
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert TransfersDisabled();
    }

    // -------- Required overrides --------

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
