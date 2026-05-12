# Pre-Mainnet Deployment Audit — V2 Contract Suite

This is a complete audit of everything built for V2 before you test on Remix and deploy to Base mainnet. Items are grouped by severity. Fix the **Critical** and **High** items before deploy; **Medium** and **Low** can be addressed in the first patch after launch.

---

## Critical — fix before mainnet deploy

### 1. `vendor-redeem-sweep` edge function never updates DB status to "finalized"
**What:** After `sweep()` burns PURPOSE on-chain, the edge function only writes `swept_at` and `sweep_tx_hash`. The `status` column stays `"settled"` forever.
**Impact:** DB and on-chain state permanently diverge. Admin dashboards, vendor views, and receipt logic all think the charge is still in the refund window.
**Fix:** In `supabase/functions/vendor-redeem-sweep/index.ts`, add `status: "finalized"` to the update payload.

### 2. `RefundPoolCard` tops up via USDC `transfer()`, bypassing `RefundPool.deposit()`
**What:** The frontend calls `usdc.transfer(poolAddress, amount)` directly. The `RefundPool` contract tracks `totalDeposited` and emits `Deposited` only via its own `deposit()` function (which uses `safeTransferFrom`).
**Impact:** On-chain accounting (`totalDeposited`) under-reports reality. The DB ledger row gets written by the edge function, but anyone reading `RefundPool.totalDeposited()` on-chain sees a lower number.
**Fix:** Change `RefundPoolCard` to (a) `approve(pool, amount)` then call `RefundPool.deposit(amount)`, or keep the direct transfer but add an admin-only `syncDeposit()` helper on the contract that bumps `totalDeposited` manually. Easiest fix: frontend does two-step `approve` + `deposit`.

### 3. `ReceiptNFT._safeMint` can revert on smart contract wallets
**What:** `_safeMint` calls `onERC721Received` on the recipient. Many smart-account wallets (including thirdweb AA wallets) do NOT implement ERC721Receiver.
**Impact:** Settlement succeeds, but the receipt mint reverts. The `try/catch` in `VendorRedemptionV2` catches it and emits `ReceiptMintFailed`, but the champion never gets their proof-of-purchase.
**Fix:** In `ReceiptNFT.sol`, change `_safeMint(champion, tokenId)` to `_mint(champion, tokenId)`. Receipts are soulbound and non-transferable; safe-mint provides no value here.

---

## High — strongly recommend before deploy

### 4. `ReceiptNFT._escape` is too narrow for SVG/JSON safety
**What:** The helper only strips `"`, `\`, `<`, `>`. Control characters (`\n`, `\t`, `\r`), backspace, and other bytes pass through and can break the base64 JSON/SVG payload.
**Impact:** A champion or vendor name with a newline or tab corrupts the on-chain tokenURI, making the receipt unrenderable on OpenSea/BaseScan.
**Fix:** Also strip/replace characters `0x00-0x1F` (control range) and `0x7F`. Convert newlines to spaces in `_escape`.

### 5. No `receipt-email` edge function built
**What:** The plan specified a `receipt-email` function that renders PNG + PDF and emails vendor + champion. The file does not exist in `supabase/functions/`.
**Impact:** Vendors and champions never receive the promised email copy of the receipt. Only the on-chain SVG exists.
**Fix:** Build `supabase/functions/receipt-email/index.ts` (or accept that v1 receipts are on-chain-only and email comes in a follow-up).

### 6. `EscrowOpsCard` missing "finalized" state
**What:** The admin card counts `locked`, `captured`, `settled`, `refunded`, `cancelled` but omits `finalized`.
**Impact:** After sweep, charges disappear from the admin mental model (they leave "settled" but never show up elsewhere).
**Fix:** Add `"finalized"` to the `STATES` array in `EscrowOpsCard.tsx`.

### 7. `mint-monthly-membership` has a live TODO — no on-chain vPURPOSE minting
**What:** The edge function records membership intent in DB but the on-chain mint is commented out with `TODO`. The vPURPOSE shadow token (which feeds the thirdweb Vote governor) never gets minted.
**Impact:** Governance weight is still entirely off-chain (Supabase tally). The on-chain governor has zero voting power attached.
**Fix:** When `PURPOSE_GOV_ADDRESS` is configured, call `vPURPOSE.mint(donorWallet, 1e18)` and `vPURPOSE.delegate(donorWallet)` in the same job. Also burn the previous month's vPURPOSE on rollover.

---

## Medium — fix in first patch after launch

### 8. `VendorRedemptionV2.sweep()` lacks `whenNotPaused`
**What:** Unlike `lock`, `capture`, and `settle`, `sweep` and `refund` don't use `whenNotPaused`. During an emergency pause, no new charges settle, but old charges can still be finalized (burning PURPOSE) or refunded.
**Impact:** Limited — refunds during pause may actually be desirable. But if you want a full freeze, sweep should also pause.
**Fix:** Add `whenNotPaused` to `sweep()` (and optionally `refund()`) if you want a full stop. Document the decision either way.

### 9. `VendorRedemptionV2.cancel()` also lacks `whenNotPaused`
**What:** Same as above — cancellations can happen during pause.
**Impact:** A vendor or admin can cancel a locked charge even while the system is paused. This is probably acceptable emergency behavior, but make it explicit.
**Fix:** Either add `whenNotPaused` or document in DEPLOYMENT.md that cancel/refund/sweep are intentionally pause-exempt.

### 10. `bounty-checkin` edge function has an unused hardcoded address
**What:** Line 12 hardcodes `0x7f54d4c8b2f0e75c8aef7e8efbd4a52a7a9a23b0` in `BOUNTY_MANAGER` but the actual used address is on line 91 from the env var.
**Impact:** Low — the constant is never referenced. But it's confusing and could be copy-pasted elsewhere later.
**Fix:** Remove the unused `BOUNTY_MANAGER` constant.

### 11. `vendor-redeem-settle` uses `mainnet.base.org` RPC for both settle and receipt log parsing
**What:** All V2 edge functions hardcode `https://mainnet.base.org`. This is fine for mainnet but means you can't test the same functions on Base Sepolia without editing code.
**Impact:** You'll need to edit every edge function to test on testnet, then revert for mainnet.
**Fix:** Make the RPC URL an env var (`CHAIN_RPC`) so the same deployed functions work on both chains by flipping a secret.

### 12. No `V2_LIVE` graceful degradation for bounty-checkin
**What:** `bounty-checkin` always uses the env var bounty manager address (or V1 fallback). It doesn't check `V2_LIVE` or use a V2 address.
**Impact:** After V2 deploy, bounty check-ins may still point to the old V1 contract.
**Fix:** Add `BOUNTY_MANAGER_V2_ADDRESS` env var and a check: if V2 address is set, use it; otherwise fall back to V1.

---

## Low — polish / nice-to-have

### 13. `ReceiptNFT` has no `supportsInterface` check for ERC721 in `_update`
**What:** `_update` correctly reverts on transfers, but `approve` and `setApprovalForAll` also revert. Marketplaces may not handle the revert gracefully.
**Impact:** Cosmetic — marketplaces will show the NFT as non-tradable.
**Fix:** Already correct behavior for soulbound. No change needed.

### 14. `RefundPool.paidPerVendor` key is the `to` address (treasury), not the vendor
**What:** The mapping comment says "tracked by `to` arg (treasury or vendor)" but in practice `payRefund` always passes `treasury` as `to`.
**Impact:** The accounting field is mislabeled. Not a functional bug.
**Fix:** Clarify the comment or track by actual vendor address.

### 15. Missing `auth_window_seconds` / `refund_window_seconds` default in DB when charge is created
**What:** Charges created by the POS/online-shop flow may not have these columns set.
**Impact:** Edge functions fall back to hardcoded `24*3600` and `7*24*3600`. Fine if defaults match the contract, but fragile if contract defaults change.
**Fix:** When inserting a `vendor_charges` row, also write the current default windows from the contract (or from a config table).

---

## Deployment checklist (exact order)

Use this instead of DEPLOYMENT.md for the actual deploy day.

### Pre-deploy (before you touch Remix)
- [ ] Fix items #1–7 above in code.
- [ ] Decide on #8 and #9 (pause behavior) and document the decision.
- [ ] Add `CHAIN_RPC`, `VENDOR_REDEMPTION_V2_ADDRESS`, `RECEIPT_NFT_ADDRESS`, `REFUND_POOL_ADDRESS`, `PURPOSE_TOKEN_V2_ADDRESS`, `BOUNTY_MANAGER_V2_ADDRESS`, `PURPOSE_GOV_ADDRESS`, `GOVERNOR_ADDRESS` to secrets.
- [ ] Run `supabase--test_edge_functions` on all V2 functions.
- [ ] Re-read `contracts/DEPLOYMENT.md` and update it with any decisions you made.

### Testnet deploy (Base Sepolia)
1. Deploy `PurposeTokenV2(admin)`
2. Deploy `BountyManagerV2(admin, purposeV2)`
3. On `PurposeTokenV2`: `grantRole(MINTER_ROLE, bountyManagerV2)`
4. Deploy `VendorRedemptionV2(admin, purposeV2, USDC_Sepolia, treasury)`
5. On `PurposeTokenV2`: `setTransferAllowedBatch([vendorRedemptionV2, treasury], true)`
6. From **treasury wallet**: `usdc.approve(vendorRedemptionV2, max)`
7. On `VendorRedemptionV2`: `grantRole(SETTLEMENT_ROLE, backendSigner)`
8. On `VendorRedemptionV2`: `approveVendor(testVendor)`
9. Deploy `RefundPool(admin, USDC_Sepolia)`
10. On `VendorRedemptionV2`: `setRefundPool(refundPoolAddress)`
11. On `RefundPool`: `grantRole(REDEMPTION_ROLE, vendorRedemptionV2)`
12. Deploy `ReceiptNFT(admin)`
13. On `ReceiptNFT`: `grantRole(MINTER_ROLE, vendorRedemptionV2)`
14. On `VendorRedemptionV2`: `setReceiptNFT(receiptNFTAddress)`
15. Deploy `vPURPOSE` via thirdweb Token prebuilt
16. On `vPURPOSE`: `grantRole(MINTER_ROLE, backendSigner)`
17. Deploy thirdweb Vote governor
18. End-to-end test: bounty → check-in → end → champion approves → POS charge → sign → lock → capture → wait auth window → settle → receipt minted → verify on BaseScan Sepolia

### Mainnet deploy (repeat in exact same order)
- Same 17 steps, using Base mainnet addresses.
- After mainnet addresses are known, paste them into chat and Lovable will update `CONTRACTS_V2` + `V2_LIVE`.

---

## What is NOT built yet (out of scope for this deploy)

Governance frontend cutover from Supabase tally to on-chain `propose/castVote/execute`. The backend (`vPURPOSE` minting) and contracts (VoteERC20) are ready, but the UI still reads from `bounty_draft_votes`. That can be the first post-launch feature.

Receipt email delivery (PNG/PDF generation). The on-chain SVG receipt works; email is a follow-up.

Timelock. Recommended for mainnet but adds 24-hour delay to all admin actions. Deploy without it for launch, add in a governance-upgrade patch.

---

## Questions for you before I implement the fixes

1. **Pause behavior**: Do you want `refund`, `cancel`, and `sweep` to be callable during a contract pause, or should they also freeze? (Emergency refunds during pause seems useful, but it's your call.)

2. **Receipt email**: Do you want me to build the `receipt-email` edge function now, or is on-chain-only acceptable for launch?

3. **vPURPOSE / governance cutover**: Should I wire the on-chain vPURPOSE minting into `mint-monthly-membership` before deploy, or is off-chain tally fine for the first weeks?
