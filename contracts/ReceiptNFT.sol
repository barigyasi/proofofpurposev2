// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ReceiptNFT
 * @notice Soulbound ERC-721 receipts minted to champions when a
 *         VendorRedemptionV2 charge settles. The token's image + metadata are
 *         served off-chain from a configurable baseURI (a Lovable Cloud edge
 *         function that reads `getReceipt(tokenId)` and renders the JSON+SVG).
 *
 *         The receipt *data* — champion, vendor, amounts, chargeId, timestamp,
 *         names — lives on-chain so the art is fully verifiable; only the
 *         rendering is off-chain so we can iterate on the design without
 *         redeploying the contract.
 *
 *         Tokens are non-transferable; mint and burn are still allowed.
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE : admin EOA / multisig (can set baseURI, grant minters)
 *   - MINTER_ROLE        : VendorRedemptionV2 + backend signer (for retry)
 */
contract ReceiptNFT is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Receipt {
        address champion;
        address vendor;
        uint256 usdcAmount;     // 6dp
        uint256 purposeAmount;  // 18dp
        bytes32 chargeId;
        uint64  settledAt;
        string  championName;
        string  vendorName;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Receipt) public receipts;
    /// @notice One receipt per chargeId; reverts on duplicate mint.
    mapping(bytes32 => uint256) public tokenIdForCharge;

    string private _base;

    event ReceiptMinted(
        bytes32 indexed chargeId,
        uint256 indexed tokenId,
        address indexed champion,
        address vendor,
        uint256 usdcAmount,
        uint256 purposeAmount
    );
    event BaseURIUpdated(string baseURI);

    error TransfersDisabled();
    error AlreadyMinted();

    constructor(address admin) ERC721("Proof of Purpose Receipt", "POPR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------- Mint ----------------

    function mintReceipt(
        address champion,
        address vendor,
        uint256 usdcAmount,
        uint256 purposeAmount,
        bytes32 chargeId,
        uint64  settledAt,
        string calldata championName,
        string calldata vendorName
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (tokenIdForCharge[chargeId] != 0) revert AlreadyMinted();
        tokenId = nextTokenId++;
        receipts[tokenId] = Receipt({
            champion: champion,
            vendor: vendor,
            usdcAmount: usdcAmount,
            purposeAmount: purposeAmount,
            chargeId: chargeId,
            settledAt: settledAt,
            championName: championName,
            vendorName: vendorName
        });
        tokenIdForCharge[chargeId] = tokenId;
        // _mint (not _safeMint) so smart-account wallets without ERC721Receiver
        // can still receive soulbound receipts. Tokens are non-transferable anyway.
        _mint(champion, tokenId);
        emit ReceiptMinted(chargeId, tokenId, champion, vendor, usdcAmount, purposeAmount);
    }

    /// @notice Convenience getter that returns the full Receipt struct in one
    ///         eth_call (the auto-generated `receipts(...)` getter returns a
    ///         tuple without the named fields, which is awkward for clients).
    function getReceipt(uint256 tokenId) external view returns (Receipt memory) {
        _requireOwned(tokenId);
        return receipts[tokenId];
    }

    // ---------------- Soulbound ----------------

    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        address from = _ownerOf(tokenId);
        // allow mint (from == 0) and burn (to == 0); block transfers
        if (from != address(0) && to != address(0)) revert TransfersDisabled();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override { revert TransfersDisabled(); }
    function setApprovalForAll(address, bool) public pure override { revert TransfersDisabled(); }

    // ---------------- Metadata (off-chain) ----------------

    /// @notice Admin sets the base URI used by `tokenURI`. Should end in `/`.
    ///         e.g. "https://<project>.functions.supabase.co/receipt-metadata/"
    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _base = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function baseURI() external view returns (string memory) {
        return _base;
    }

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    // tokenURI uses the default ERC721 implementation:
    //   _baseURI() + tokenId.toString()

    // ---------------- ERC165 ----------------

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
