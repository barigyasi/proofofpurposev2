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
        _safeMint(champion, tokenId);
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

        string memory image = _renderSVG(tokenId, r);
        string memory json = string(abi.encodePacked(
            '{"name":"POP Receipt #', tokenId.toString(),
            '","description":"Soulbound proof-of-purchase receipt issued by Proof of Purpose. Champion: ',
            _escape(r.championName), ' | Vendor: ', _escape(r.vendorName),
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(image)),
            '","attributes":[',
              '{"trait_type":"Champion","value":"', _escape(r.championName), '"},',
              '{"trait_type":"Vendor","value":"', _escape(r.vendorName), '"},',
              '{"trait_type":"USDC","display_type":"number","value":', _formatUSDC(r.usdcAmount), '},',
              '{"trait_type":"PURPOSE","display_type":"number","value":', _formatPURPOSE(r.purposeAmount), '},',
              '{"trait_type":"Settled At","display_type":"date","value":', uint256(r.settledAt).toString(), '},',
              '{"trait_type":"Soulbound","value":"true"}',
            ']}'
        ));
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _renderSVG(uint256 tokenId, Receipt memory r) internal pure returns (string memory) {
        // brand: navy 220 70% 12% (#0A1729-ish), gold 43 96% 56% (#F2C033-ish)
        string memory headerColor = "#F2C033";
        string memory bg = "#0A1729";
        string memory fg = "#FFFFFF";
        string memory muted = "#94A3B8";
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" font-family="monospace">',
            '<rect width="600" height="600" fill="', bg, '"/>',
            '<rect x="20" y="20" width="560" height="560" fill="none" stroke="', headerColor, '" stroke-width="3"/>',
            '<text x="40" y="70" fill="', headerColor, '" font-size="14" letter-spacing="3">PROOF OF PURPOSE</text>',
            '<text x="40" y="100" fill="', fg, '" font-size="34" font-weight="bold">RECEIPT #', tokenId.toString(), '</text>',
            '<line x1="40" y1="120" x2="560" y2="120" stroke="', muted, '" stroke-width="1"/>',

            '<text x="40" y="160" fill="', muted, '" font-size="11" letter-spacing="2">CHAMPION</text>',
            '<text x="40" y="185" fill="', fg, '" font-size="18">', _escape(r.championName), '</text>',
            '<text x="40" y="205" fill="', muted, '" font-size="11">', _shortAddr(r.champion), '</text>',

            '<text x="40" y="245" fill="', muted, '" font-size="11" letter-spacing="2">VENDOR</text>',
            '<text x="40" y="270" fill="', fg, '" font-size="18">', _escape(r.vendorName), '</text>',
            '<text x="40" y="290" fill="', muted, '" font-size="11">', _shortAddr(r.vendor), '</text>',

            '<line x1="40" y1="320" x2="560" y2="320" stroke="', muted, '" stroke-width="1"/>',

            '<text x="40" y="355" fill="', muted, '" font-size="11" letter-spacing="2">AMOUNT</text>',
            '<text x="40" y="410" fill="', headerColor, '" font-size="56" font-weight="bold">$', _formatUSDC(r.usdcAmount), '</text>',
            '<text x="40" y="440" fill="', fg, '" font-size="14">', _formatPURPOSE(r.purposeAmount), ' PURPOSE redeemed</text>',

            '<line x1="40" y1="475" x2="560" y2="475" stroke="', muted, '" stroke-width="1"/>',

            '<text x="40" y="505" fill="', muted, '" font-size="10">CHARGE</text>',
            '<text x="40" y="525" fill="', fg, '" font-size="11">', _shortHex(r.chargeId), '</text>',

            '<text x="40" y="555" fill="', muted, '" font-size="10">SETTLED (UNIX)</text>',
            '<text x="40" y="575" fill="', fg, '" font-size="11">', uint256(r.settledAt).toString(), '</text>',

            '<rect x="430" y="540" width="135" height="32" fill="', headerColor, '"/>',
            '<text x="497" y="561" fill="', bg, '" font-size="12" font-weight="bold" text-anchor="middle">SOULBOUND</text>',
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

    /// @dev minimal JSON-string escape; receipts only ever hold short names from approved profiles.
    function _escape(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length);
        uint256 j;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == 0x22 || c == 0x5C || c == 0x3C || c == 0x3E) { out[j++] = ' '; }
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
