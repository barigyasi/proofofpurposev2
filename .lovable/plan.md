# Receipt NFT — Plan

A soulbound, fully on-chain ERC-721 receipt minted to the champion the moment a charge settles (after the auth window). The vendor receives a matching PDF + PNG by email and in their dashboard. The image and metadata live entirely on-chain as base64 SVG + JSON, so receipts survive forever with zero hosting dependency.

## What gets built

### 1. Smart contract — `contracts/ReceiptNFT.sol` (new)

ERC-721, soulbound (override `_update` to revert on transfer when `from != 0 && to != 0`). Roles via `AccessControl`:

- `DEFAULT_ADMIN_ROLE` → admin EOA
- `MINTER_ROLE` → granted to `VendorRedemptionV2`

Mint signature:
```solidity
function mintReceipt(
  address champion,
  address vendor,
  uint256 usdcAmount,      // 6dp
  uint256 purposeAmount,   // 18dp
  bytes32 chargeId,
  uint64  settledAt,
  string calldata memo
) external onlyRole(MINTER_ROLE) returns (uint256 tokenId);
```

Stores a packed `Receipt` struct per tokenId. `tokenURI(id)` returns `data:application/json;base64,...` with an embedded `data:image/svg+xml;base64,...` image — fully on-chain, no hosting.

SVG layout (square, brand navy bg + gold accents, no raster assets):
- "PROOF OF PURPOSE — RECEIPT" header
- Champion display name (passed in as `memo` slot 1) + truncated wallet
- Vendor business name + truncated wallet
- USDC amount (large) + PURPOSE amount
- Charge ID (short) + settled-at timestamp
- Token #N + small "soulbound" badge

### 2. VendorRedemptionV2 hook

Inside `settle(chargeId)`, after USDC transfers to vendor, call `receiptNFT.mintReceipt(...)`. Emits `ReceiptMinted(chargeId, tokenId, champion)`. Wrapped in `try/catch` so a receipt failure never blocks settlement; on failure the edge function logs and a manual admin retry exists.

### 3. Database

Migration adds to `vendor_charges`:
- `receipt_token_id BIGINT NULL`
- `receipt_tx_hash TEXT NULL`
- `receipt_minted_at TIMESTAMPTZ NULL`
- `receipt_emailed_at TIMESTAMPTZ NULL`

### 4. Edge functions

- **`vendor-redeem-settle`** (extend): after on-chain settle confirms, parse `ReceiptMinted` log, write `receipt_token_id` / `receipt_tx_hash` / `receipt_minted_at`, then enqueue email job.
- **`receipt-email`** (new): given a charge id, reads `tokenURI`, decodes SVG, renders PNG (sharp/resvg via npm: specifier) + PDF (pdf-lib), sends to vendor email and champion email via existing email infra. Marks `receipt_emailed_at`.
- **`receipt-mint-retry`** (new, admin-only): for the rare case `mintReceipt` reverted; re-issues mint via backend signer.

### 5. Frontend

- **Champion dashboard** — new "Receipts" list: thumbnail (SVG fetched from `tokenURI`), amount, vendor, date, "View on BaseScan" + "Download PDF" buttons.
- **VendorChargesHistory** — when `receipt_token_id` is set, show a small "Receipt #N" pill that opens a dialog with the SVG preview + Download PDF/PNG.
- **Admin** — small `ReceiptOpsCard` on `/admin`: counts of minted vs failed mints, table of charges with `settled_at NOT NULL AND receipt_token_id IS NULL`, retry button per row.
- **Public** — `/receipts/:tokenId` route renders the SVG from `tokenURI` for sharing (read-only, no auth).

### 6. Config

- Add `RECEIPT_NFT: ""` to `CONTRACTS_V2` in `src/config/contracts.ts`.
- Add `RECEIPT_NFT_ADDRESS` env var for edge functions (used by `receipt-email` to call `tokenURI`).
- ABI committed at `src/contracts/abis/ReceiptNFT.json`.

## Decisions locked in
- Mint trigger: **on settle**, after auth window. Refunded charges never get a receipt. Cancelled charges never get one either.
- Recipient: **soulbound to champion**. Vendor and champion both receive PDF + PNG by email.
- Hosting: **fully on-chain SVG** via `tokenURI` data URI. Zero hosting dependency.
- Contract: **separate `ReceiptNFT.sol`**, minted by `VendorRedemptionV2` via `MINTER_ROLE`.

## Out of scope (for this iteration)
- Per-vendor branded receipt templates (single branded template v1).
- Receipt for legacy V1 charges (V2 only — V1 keeps no-receipt behavior).
- IPFS pinning fallback (not needed since metadata is on-chain).
- Allowing champion to "burn" a receipt (soulbound + permanent).

## Deployment checklist (when you're ready)
1. Deploy `ReceiptNFT.sol`, save address.
2. Deploy `VendorRedemptionV2` with `receiptNFT` constructor arg (or `setReceiptNFT(address)` admin setter — recommend the setter so we can deploy the receipt contract independently).
3. `receiptNFT.grantRole(MINTER_ROLE, vendorRedemptionV2)`.
4. Populate `CONTRACTS_V2.RECEIPT_NFT` + add `RECEIPT_NFT_ADDRESS` secret.
5. Flip `V2_LIVE` once all V2 addresses are populated.
