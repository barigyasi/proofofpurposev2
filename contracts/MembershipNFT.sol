// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title Proof of Purpose — MembershipNFT
 * @notice Soulbound monthly membership pass. One token per wallet (re-minting
 *         the same wallet just extends `expiresAt`). Backend signer mints on
 *         subscription / payment and the same signer mirrors active passes
 *         into vPURPOSE 1:1 for governance.
 *
 *         Tokens are non-transferable. `isActive(wallet)` returns true while
 *         the wallet's pass has not expired — this is the single source of
 *         truth the backend uses to keep vPURPOSE balances in sync.
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE : admin EOA / multisig
 *   - MINTER_ROLE        : backend signer (issues / renews / revokes)
 */
contract MembershipNFT is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    error SoulboundTransfersDisabled();
    error AlreadyHasToken();
    error NoTokenForWallet();
    error InvalidDuration();

    /// tokenId => unix seconds at which the pass expires
    mapping(uint256 => uint256) public expiresAt;

    /// wallet => tokenId (0 means none — token ids start at 1)
    mapping(address => uint256) public tokenOf;

    uint256 public nextId = 1;
    string private _baseTokenURI;

    event MembershipIssued(address indexed wallet, uint256 indexed tokenId, uint256 expiresAt);
    event MembershipRenewed(address indexed wallet, uint256 indexed tokenId, uint256 newExpiresAt);
    event MembershipRevoked(address indexed wallet, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);

    constructor(address admin, string memory baseURI_)
        ERC721("Proof of Purpose Membership", "POPM")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _baseTokenURI = baseURI_;
    }

    // -------- Backend issuance --------

    /// @notice Issue a fresh pass to a wallet that has none. Reverts if wallet
    ///         already holds a token — use `renew` instead.
    function issue(address to, uint256 durationSeconds)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (durationSeconds == 0) revert InvalidDuration();
        if (tokenOf[to] != 0) revert AlreadyHasToken();

        tokenId = nextId++;
        tokenOf[to] = tokenId;
        expiresAt[tokenId] = block.timestamp + durationSeconds;
        _safeMint(to, tokenId);

        emit MembershipIssued(to, tokenId, expiresAt[tokenId]);
    }

    /// @notice Extend a wallet's existing pass. If the pass is already expired
    ///         the new expiry is `now + durationSeconds`; otherwise it is
    ///         `expiresAt + durationSeconds`.
    function renew(address wallet, uint256 durationSeconds)
        external
        onlyRole(MINTER_ROLE)
    {
        if (durationSeconds == 0) revert InvalidDuration();
        uint256 tokenId = tokenOf[wallet];
        if (tokenId == 0) revert NoTokenForWallet();

        uint256 current = expiresAt[tokenId];
        uint256 base = current > block.timestamp ? current : block.timestamp;
        uint256 newExpiry = base + durationSeconds;

        expiresAt[tokenId] = newExpiry;
        emit MembershipRenewed(wallet, tokenId, newExpiry);
    }

    /// @notice Burn a wallet's pass (e.g. refund, fraud). Backend should
    ///         simultaneously burn the matching vPURPOSE balance.
    function revoke(address wallet) external onlyRole(MINTER_ROLE) {
        uint256 tokenId = tokenOf[wallet];
        if (tokenId == 0) revert NoTokenForWallet();

        delete tokenOf[wallet];
        delete expiresAt[tokenId];
        _burn(tokenId);

        emit MembershipRevoked(wallet, tokenId);
    }

    // -------- Views --------

    function isActive(address wallet) external view returns (bool) {
        uint256 tokenId = tokenOf[wallet];
        if (tokenId == 0) return false;
        return expiresAt[tokenId] > block.timestamp;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return bytes(_baseTokenURI).length > 0
            ? string.concat(_baseTokenURI, tokenId.toString())
            : "";
    }

    // -------- Admin --------

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    // -------- Soulbound enforcement --------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow mint (from==0) and burn (to==0); block all wallet-to-wallet transfers.
        if (from != address(0) && to != address(0)) revert SoulboundTransfersDisabled();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert SoulboundTransfersDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundTransfersDisabled();
    }

    // -------- Interface --------

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
