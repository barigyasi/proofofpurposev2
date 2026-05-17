// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ReceiptNFT
 * @notice Soulbound, fully on-chain ERC-721 receipts minted to champions when a
 *         VendorRedemptionV2 charge settles. Image + metadata live on-chain via
 *         a base64-encoded SVG returned from `tokenURI`. Non-transferable.
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE : admin EOA / multisig
 *   - MINTER_ROLE        : VendorRedemptionV2
 */
contract ReceiptNFT is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // SVG palette (kept as contract-level constants to avoid stack pressure in _renderSVG)
    string private constant SVG_BG     = "#0A1729";
    string private constant SVG_FG     = "#FFFFFF";
    string private constant SVG_MUTED  = "#94A3B8";
    string private constant SVG_ACCENT = "#F2C033";

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

    event ReceiptMinted(
        bytes32 indexed chargeId,
        uint256 indexed tokenId,
        address indexed champion,
        address vendor,
        uint256 usdcAmount,
        uint256 purposeAmount
    );

    error TransfersDisabled();
    error AlreadyMinted();

    constructor(address admin) ERC721("Proof of Purpose Receipt", "POPR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

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
        // Use _mint (not _safeMint) so smart-account wallets without ERC721Receiver
        // can still receive soulbound receipts. Tokens are non-transferable anyway.
        _mint(champion, tokenId);
        emit ReceiptMinted(chargeId, tokenId, champion, vendor, usdcAmount, purposeAmount);
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

    // ---------------- Metadata ----------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Receipt memory r = receipts[tokenId];

        string memory imageB64 = Base64.encode(bytes(_renderSVG(tokenId, r)));
        string memory champ = _escape(r.championName);
        string memory vend = _escape(r.vendorName);

        string memory json = string(abi.encodePacked(
            _jsonHead(tokenId, champ, vend, imageB64),
            _jsonAttrs(champ, vend, r)
        ));
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _jsonHead(
        uint256 tokenId,
        string memory champ,
        string memory vend,
        string memory imageB64
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{"name":"POP Receipt #', tokenId.toString(),
            '","description":"Soulbound proof-of-purchase receipt issued by Proof of Purpose. Champion: ',
            champ, ' | Vendor: ', vend,
            '","image":"data:image/svg+xml;base64,', imageB64, '",'
        ));
    }

    function _jsonAttrs(
        string memory champ,
        string memory vend,
        Receipt memory r
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '"attributes":[',
              '{"trait_type":"Champion","value":"', champ, '"},',
              '{"trait_type":"Vendor","value":"', vend, '"},',
              '{"trait_type":"USDC","display_type":"number","value":', _formatUSDC(r.usdcAmount), '},',
              '{"trait_type":"PURPOSE","display_type":"number","value":', _formatPURPOSE(r.purposeAmount), '},',
              '{"trait_type":"Settled At","display_type":"date","value":', uint256(r.settledAt).toString(), '},',
              '{"trait_type":"Soulbound","value":"true"}',
            ']}'
        ));
    }

    function _renderSVG(uint256 tokenId, Receipt memory r) internal pure returns (string memory) {
        return string(abi.encodePacked(
            _svgHeader(tokenId),
            _svgParties(r.champion, r.vendor, r.championName, r.vendorName),
            _svgAmount(r.usdcAmount, r.purposeAmount),
            _svgFooter(r.chargeId, r.settledAt)
        ));
    }

    function _svgHeader(uint256 tokenId) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" font-family="monospace">',
            '<rect width="600" height="600" fill="', SVG_BG, '"/>',
            '<rect x="20" y="20" width="560" height="560" fill="none" stroke="', SVG_ACCENT, '" stroke-width="3"/>',
            '<text x="40" y="70" fill="', SVG_ACCENT, '" font-size="14" letter-spacing="3">PROOF OF PURPOSE</text>',
            '<text x="40" y="100" fill="', SVG_FG, '" font-size="34" font-weight="bold">RECEIPT #', tokenId.toString(), '</text>',
            '<line x1="40" y1="120" x2="560" y2="120" stroke="', SVG_MUTED, '" stroke-width="1"/>'
        ));
    }

    function _svgParties(
        address champion,
        address vendor,
        string memory championName,
        string memory vendorName
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text x="40" y="160" fill="', SVG_MUTED, '" font-size="11" letter-spacing="2">CHAMPION</text>',
            '<text x="40" y="185" fill="', SVG_FG, '" font-size="18">', _escape(championName), '</text>',
            '<text x="40" y="205" fill="', SVG_MUTED, '" font-size="11">', _shortAddr(champion), '</text>',
            '<text x="40" y="245" fill="', SVG_MUTED, '" font-size="11" letter-spacing="2">VENDOR</text>',
            '<text x="40" y="270" fill="', SVG_FG, '" font-size="18">', _escape(vendorName), '</text>',
            '<text x="40" y="290" fill="', SVG_MUTED, '" font-size="11">', _shortAddr(vendor), '</text>',
            '<line x1="40" y1="320" x2="560" y2="320" stroke="', SVG_MUTED, '" stroke-width="1"/>'
        ));
    }

    function _svgAmount(uint256 usdcAmount, uint256 purposeAmount) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text x="40" y="355" fill="', SVG_MUTED, '" font-size="11" letter-spacing="2">AMOUNT</text>',
            '<text x="40" y="410" fill="', SVG_ACCENT, '" font-size="56" font-weight="bold">$', _formatUSDC(usdcAmount), '</text>',
            '<text x="40" y="440" fill="', SVG_FG, '" font-size="14">', _formatPURPOSE(purposeAmount), ' PURPOSE redeemed</text>',
            '<line x1="40" y1="475" x2="560" y2="475" stroke="', SVG_MUTED, '" stroke-width="1"/>'
        ));
    }

    function _svgFooter(bytes32 chargeId, uint64 settledAt) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text x="40" y="505" fill="', SVG_MUTED, '" font-size="10">CHARGE</text>',
            '<text x="40" y="525" fill="', SVG_FG, '" font-size="11">', _shortHex(chargeId), '</text>',
            '<text x="40" y="555" fill="', SVG_MUTED, '" font-size="10">SETTLED (UNIX)</text>',
            '<text x="40" y="575" fill="', SVG_FG, '" font-size="11">', uint256(settledAt).toString(), '</text>',
            '<rect x="430" y="540" width="135" height="32" fill="', SVG_ACCENT, '"/>',
            '<text x="497" y="561" fill="', SVG_BG, '" font-size="12" font-weight="bold" text-anchor="middle">SOULBOUND</text>',
            '</svg>'
        ));
    }

    // ---------------- formatting helpers ----------------

    function _formatUSDC(uint256 amount) internal pure returns (string memory) {
        // 6dp -> "X.YY"
        uint256 whole = amount / 1e6;
        uint256 frac = (amount % 1e6) / 1e4; // 2dp
        return string(abi.encodePacked(whole.toString(), ".", _pad2(frac)));
    }

    function _formatPURPOSE(uint256 amount) internal pure returns (string memory) {
        // 18dp -> "X.YY"
        uint256 whole = amount / 1e18;
        uint256 frac = (amount % 1e18) / 1e16; // 2dp
        return string(abi.encodePacked(whole.toString(), ".", _pad2(frac)));
    }

    function _pad2(uint256 v) internal pure returns (string memory) {
        if (v < 10) return string(abi.encodePacked("0", v.toString()));
        return v.toString();
    }

    function _shortAddr(address a) internal pure returns (string memory) {
        bytes memory full = bytes(Strings.toHexString(uint160(a), 20));
        bytes memory out = new bytes(13); // 0x + 4 + ... + 4
        out[0] = full[0]; out[1] = full[1];
        for (uint256 i = 0; i < 4; i++) out[2 + i] = full[2 + i];
        out[6] = '.'; out[7] = '.'; out[8] = '.';
        for (uint256 i = 0; i < 4; i++) out[9 + i] = full[full.length - 4 + i];
        return string(out);
    }

    function _shortHex(bytes32 b) internal pure returns (string memory) {
        bytes memory full = bytes(Strings.toHexString(uint256(b), 32));
        bytes memory out = new bytes(13);
        out[0] = full[0]; out[1] = full[1];
        for (uint256 i = 0; i < 4; i++) out[2 + i] = full[2 + i];
        out[6] = '.'; out[7] = '.'; out[8] = '.';
        for (uint256 i = 0; i < 4; i++) out[9 + i] = full[full.length - 4 + i];
        return string(out);
    }

    /// @dev JSON/SVG-safe escape: replaces structural chars (`"`, `\`, `<`, `>`),
    ///      ASCII control bytes (0x00-0x1F) and DEL (0x7F) with spaces.
    ///      Non-ASCII UTF-8 bytes pass through (valid in both JSON strings and SVG text).
    function _escape(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length);
        uint256 j;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (
                c == 0x22 || c == 0x5C || c == 0x3C || c == 0x3E ||
                uint8(c) < 0x20 || c == 0x7F
            ) { out[j++] = 0x20; }
            else { out[j++] = c; }
        }
        bytes memory trimmed = new bytes(j);
        for (uint256 i = 0; i < j; i++) trimmed[i] = out[i];
        return string(trimmed);
    }

    // ---------------- ERC165 ----------------

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
