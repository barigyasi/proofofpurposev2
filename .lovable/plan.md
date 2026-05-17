## V2 Contract Wiring Plan

All five V2 contracts are live on Base. Here's the wiring to flip the app over.

### 1. Frontend config (`src/config/contracts.ts`)

Populate `CONTRACTS_V2` with the deployed addresses — this flips `V2_LIVE` to `true` and unlocks the champion charge confirm flow, silent approve, and dismisses the `V2StatusBanner`:

```ts
export const CONTRACTS_V2 = {
  PURPOSE_TOKEN:      "0xd9a710A1ED0b73f487C4cF55580B71bBfc6B869f",
  BOUNTY_MANAGER:     "0x19cabb84B1A05D89f5F43D6f589b31dbAfd0F352",
  REFUND_POOL:        "0x8E1f67018ED9545a9A1eb5Fd596D51f04BB217d3",
  VENDOR_REDEMPTION:  "0x54e60C53d3ec7F25fc4cc9e1426b181C455F7c25",
  RECEIPT_NFT:        "0xeCC53349Df9a6739b8330547D57F0986d073EE52",
} as const;
```

### 2. Backend secrets (Lovable Cloud → edge function env)

Add/update these so the settle / lock / cancel / refund / sweep / receipt-retry functions can sign and target V2:

- `PURPOSE_TOKEN_V2_ADDRESS` = `0xd9a710A1ED0b73f487C4cF55580B71bBfc6B869f`
- `BOUNTY_MANAGER_V2_ADDRESS` = `0x19cabb84B1A05D89f5F43D6f589b31dbAfd0F352`
- `VENDOR_REDEMPTION_V2_ADDRESS` = `0x54e60C53d3ec7F25fc4cc9e1426b181C455F7c25`
- `REFUND_POOL_ADDRESS` = `0x8E1f67018ED9545a9A1eb5Fd596D51f04BB217d3`
- `RECEIPT_NFT_ADDRESS` = `0xeCC53349Df9a6739b8330547D57F0986d073EE52`
- `CHAIN_RPC` (optional override) — leave default `https://mainnet.base.org` unless you have a private RPC.

I'll prompt you with the secrets form so you can paste these in once.

### 3. On-chain wiring (you do this from your admin EOA on BaseScan / thirdweb dashboard)

Do these in order — each is a one-shot tx from your admin wallet (`0xa5a4…f098`):

1. **`RefundPool.grantRole(REDEMPTION_ROLE, 0x54e6…7c25)`** — lets VendorRedemptionV2 pull refunds.
2. **`VendorRedemptionV2.setRefundPool(0x8E1f…17d3)`**
3. **`VendorRedemptionV2.setReceiptNFT(0xeCC5…EE52)`**
4. **`ReceiptNFT.grantRole(MINTER_ROLE, 0x54e6…7c25)`** (or whatever the minter-grant function is — confirm against `contracts/ReceiptNFT.sol`).
5. **`PurposeTokenV2.grantRole(BURNER_ROLE, 0x54e6…7c25)`** — so settle() can burn PURPOSE.
6. **`PurposeTokenV2.grantRole(MINTER_ROLE, 0x19ca…0a51)`** — so BountyManagerV2 can mint rewards. (Skip if you set this in the constructor.)
7. **Treasury Safe → `USDC.approve(0x54e6…7c25, max)`** — so settle() can transferFrom treasury to vendor.
8. **Fund RefundPool** with USDC (initial cushion, e.g. $500) — so cancel/refund tx never reverts on empty pool.

I'll re-verify exact role-grant function signatures against the four V2 .sol files before writing the checklist into a follow-up message.

### 4. Verification pass

After wiring + secret-set + code update, I'll:

- Read `V2_LIVE` from the bundle (banner disappears, charge dialog enables Confirm).
- Hit `vendor-redeem-lock` → `vendor-redeem-settle` (with `force: true`) end-to-end against a tiny test charge ($0.01).
- Confirm a ReceiptNFT tokenId comes back on `vendor_charges.receipt_token_id` and the receipt-email function fires.
- Test `vendor-redeem-cancel` and `vendor-redeem-refund` paths against another small charge.
- Test `refund-pool-deposit` admin card.

### Technical notes

- `src/contracts/abis/VendorRedemptionV2.json`, `RefundPool.json`, `ReceiptNFT.json` are already in the repo — no ABI regen needed for the frontend.
- Edge functions already gate on the `*_V2_ADDRESS` env vars and return 503 until set, so order of operations (secrets first, then on-chain wiring, then `V2_LIVE` flip) is safe with no downtime.
- `useSilentRedemptionApprove` will fire on next champion login and silently approve V2 PurposeToken → VendorRedemptionV2 (sponsored gas).

### What I need from you to start

Just say **go** and I'll:
1. Open the secrets form for the five V2 env vars.
2. Patch `src/config/contracts.ts` with the addresses.
3. Hand you back the on-chain wiring checklist with exact function signatures pulled from the .sol files.
