## Plan — minimal ReceiptNFT + off-chain art

Strip `ReceiptNFT.sol` down to the smallest possible soulbound ERC-721, store only the data needed to look up the receipt later, and serve the JSON + SVG from a new `receipt-metadata` edge function that reads on-chain state.

### 1. Slim down `contracts/ReceiptNFT.sol`

Keep:
- Same interface signature for `mintReceipt(...)` (so `VendorRedemptionV2` keeps calling it unchanged — no VR_V2 redeploy needed).
- Same constructor, roles (`DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`), errors, events.
- Soulbound `_update`, `approve`/`setApprovalForAll` reverts.
- Storage: `receipts[tokenId]` (full `Receipt` struct including `championName`/`vendorName`) + `tokenIdForCharge[chargeId]`. Keeping the names on-chain means the edge function never has to trust a DB for the wallet's display.
- `setBaseURI(string)` admin-only setter + `_baseURI()` override.

Remove:
- `_renderSVG`, `_svgHeader`, `_svgChampion`, `_svgVendor`, `_svgAmount`, `_svgFooter`.
- `_jsonHead`, `_jsonAttrs`, the custom `tokenURI`.
- `_formatUSDC`, `_formatPURPOSE`, `_pad2`, `_shortAddr`, `_shortHex`, `_escape`.
- SVG palette constants.
- `Strings` and `Base64` imports.

Result: bytecode well under 24 KB, zero stack pressure, no `viaIR` needed. Default `tokenURI` becomes `<baseURI><tokenId>`.

### 2. Add a public read getter

Add `getReceipt(uint256 tokenId) external view returns (Receipt memory)` so the edge function (and anyone) can fetch all fields in one `eth_call` without decoding the auto-generated tuple getter quirks.

### 3. New edge function `receipt-metadata`

`supabase/functions/receipt-metadata/index.ts`, public (no JWT), `verify_jwt = false` via config.toml.

Route: `GET /receipt-metadata/:tokenId` (also accept `?tokenId=` for flexibility).

Behavior:
- Validate `tokenId` (positive integer, fits in uint256).
- Use viem + the Base mainnet RPC to call `getReceipt(tokenId)` on the ReceiptNFT address (read from env var `RECEIPT_NFT_ADDRESS`, chain from `CHAIN_ID` defaulting to Base mainnet).
- If the token doesn't exist, return 404 JSON.
- Build the OpenSea-style JSON metadata (name, description, image, attributes) in TypeScript — easy to evolve later without redeploying the contract.
- Generate the SVG as a data URL inside the JSON. The SVG is the same brutalist look (near-black bg `hsl(0 0% 4%)`, acid yellow primary `hsl(60 100% 50%)`) per project brand, with: receipt #, champion name + short addr, vendor name + short addr, big $X.YY, PURPOSE redeemed, charge hash, settled timestamp, SOULBOUND badge.
- Set `Cache-Control: public, max-age=3600, s-maxage=86400` so OpenSea/wallets cache it.
- Return JSON with proper CORS headers.

Why an SVG data URL inside JSON (instead of a second `/receipt-image/:id` route): one fewer round trip, easier to reason about, and keeps everything cacheable as one document.

### 4. Wire-up

- After deploying the slimmed `ReceiptNFT`, admin calls `setBaseURI("https://<project>.supabase.co/functions/v1/receipt-metadata/")` once.
- Re-grant `MINTER_ROLE` to `VendorRedemptionV2` and to the backend signer (same procedure as before).
- Update `VR_V2.setReceiptNFT(<new>)`.
- Update `src/config/contracts.ts` and `src/contracts/abis/ReceiptNFT.json` with the new address + ABI.

### 5. Frontend `/receipt/:tokenId` page (light touch)

The existing `src/pages/Receipt.tsx` already reads chain state — point it at the new contract address and keep using the same data. The NFT image people see in their wallet / OpenSea comes from the edge function automatically; the in-app receipt page can keep rendering its own React version for a better UX.

### Technical details

- `Receipt` struct stays as-is so VR_V2's `mintReceipt(...)` call site keeps working unchanged → **no VR_V2 redeploy required**.
- Storing `championName`/`vendorName` on-chain is the only "expensive" choice; it's already what's happening today and it guarantees the receipt art is verifiable on-chain without trusting our DB.
- Edge function uses `npm:viem` for the read call; no signing, no secrets beyond the public RPC URL.
- If you ever want to flip to IPFS later, it's a one-line change to `setBaseURI` — the contract doesn't care where the metadata lives.

### What you'll do after I ship the code

1. Recompile new `ReceiptNFT.sol` in Remix (0.8.24, optimizer on, runs 200) — will be tiny.
2. Deploy `ReceiptNFT(admin)` on Base.
3. Admin calls `setBaseURI("https://szlnvjzluzplpvzigboo.supabase.co/functions/v1/receipt-metadata/")`.
4. Admin calls `grantRole(MINTER_ROLE, <VR_V2>)` and `grantRole(MINTER_ROLE, <backend signer>)`.
5. Admin calls `VR_V2.setReceiptNFT(<new ReceiptNFT>)`.
6. Paste the new address — I'll update `src/config/contracts.ts` + ABI.