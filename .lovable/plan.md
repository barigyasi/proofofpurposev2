# Plan: PurposeToken V2 + POP POS + Online Vendor Shop

Three coordinated workstreams. Phase 1 ships independently; Phases 2–3 ship together once V2 contracts are deployed.

---

## Phase 1 — Solidity drafts (no deploy yet)

Add a `contracts/` folder at the repo root with Foundry-style sources you can deploy via Remix or Foundry whenever you're ready. **No on-chain action — just code sitting in the repo.**

- `contracts/PurposeTokenV2.sol`
  - OpenZeppelin v5 `ERC20`, `ERC20Burnable`, `ERC20Permit`, `AccessControl`
  - Roles: `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `TRANSFER_ADMIN_ROLE`
  - `mapping(address => bool) public transferAllowed;`
  - Override `_update(from, to, value)`: allow if `from == 0` (mint) or `to == 0` (burn) or `transferAllowed[from]` or `transferAllowed[to]`; else revert `"PURPOSE: non-transferable"`
  - `setTransferAllowed(address, bool)` gated by `TRANSFER_ADMIN_ROLE`
- `contracts/BountyManagerV2.sol` — same logic as today, constructor takes new token, calls `mint` via `MINTER_ROLE`
- `contracts/VendorRedemptionV2.sol` — keeps `approveVendor` / `redeem`; `redeem` does `purposeToken.burnFrom(champion, amount)` then transfers USDC from treasury to vendor
- `contracts/README.md` — deploy order (V2 token → grant MINTER to BountyManagerV2 → deploy VendorRedemptionV2 → seed allowlist with `[BountyManagerV2, VendorRedemptionV2, Treasury]`) and the env vars / addresses to update afterward

You deploy these later from Remix/Foundry. After deploy, ping me with the new addresses and I'll do the contract-address swap (Phase 2 step 1).

---

## Phase 2 — POP POS: confirm-on-phone redemption

Today the vendor scans the champion's static QR and unilaterally enters an amount. New flow mirrors tap-to-pay: **vendor proposes amount, champion confirms on their phone.**

### New flow

```text
1. Vendor opens POP POS → enters $ amount → "Charge"
2. POS shows a QR encoding {redemption_id, vendor_wallet, amount}
3. Champion opens app → "Pay" → scans vendor QR
4. Champion sees: vendor name + logo, amount in PURPOSE, "Approve" / "Cancel"
5. On Approve: champion's smart wallet signs a redemption authorization
   (EIP-712 typed data: vendor, amount, nonce, expires_at)
6. Authorization posted to `redemption-confirm` edge function
7. Vendor POS polls/realtime — receives signed auth
8. Vendor wallet calls `VendorRedemption.redeem(champion, amount, signature)`
   which `burnFrom`s the champion and pays vendor in USDC
9. POS shows ✓ Approved, champion sees ✓ Paid, balances refresh
```

The champion never types an amount — they only confirm what the POS shows them, exactly like Apple Pay.

### Frontend changes

- `src/pages/VendorDashboard.tsx` — replace current "scan champion → type amount" with **POS terminal**:
  - Number-pad input for USD amount
  - "Charge" button generates a `redemption_requests` row, displays QR with `{id, vendor_wallet, amount_purpose}`
  - Subscribes via Supabase Realtime to that row; when `status='approved'`, fires the on-chain `redeem` tx, then marks `status='settled'`
- `src/components/champion/PurposeBalanceCard.tsx` — add **"PAY VENDOR"** button alongside the existing "SHOW REDEEM QR" button (rename existing to "MY WALLET QR" or remove if obsolete)
- New `src/pages/ChampionPay.tsx` — opens camera (`QRScanner`), parses vendor QR, shows confirmation sheet with vendor name/logo (looked up from `vendors` table by wallet) + amount, Approve/Cancel buttons
- New `src/components/champion/PaymentConfirmSheet.tsx` — the tap-to-pay-style confirm UI
- `src/components/vendor/QRScanner.tsx` — keep as-is, reused on champion side

### Backend changes

- New table `redemption_requests`:
  - `id uuid pk`, `vendor_wallet text`, `champion_wallet text nullable` (filled on scan), `amount_purpose numeric`, `amount_usdc numeric`, `status text` (`pending` / `approved` / `settled` / `expired` / `cancelled`), `champion_signature text nullable`, `expires_at timestamptz`, `tx_hash text nullable`, `created_at`, `updated_at`
  - RLS: vendor reads/writes own rows by wallet; champion can update `status` + `champion_signature` for any pending row they scan; admin all
  - Enable Realtime on this table
- New edge function `redemption-confirm` — validates EIP-712 signature server-side, marks row `approved`
- Existing `vendor-redeem-verify` — repurposed or replaced by `redemption-confirm`
- Migration to add the table + enable realtime publication

### Champion approval (one-time)

V2 token requires the champion's smart wallet to `approve(VendorRedemption, max)` once before first redemption (so `burnFrom` works). Add a transparent one-time `approve` step inside `ChampionPay.tsx` — checks `allowance`, sends sponsored-gas approve if zero, then proceeds. Invisible to the user beyond a "preparing wallet…" toast on first redemption.

---

## Phase 3 — Online vendor shop

Champions browse approved vendors, buy items with PURPOSE, vendor fulfills.

### Scope (v1 — keep simple)

- Vendor-managed product catalog (digital codes, gift cards, simple physical items vendor ships themselves)
- No cart — single-item checkout per order (cart can come later)
- No shipping integration — vendor handles fulfillment offline; champion provides shipping address in checkout if vendor requires it

### Schema

- `vendor_products`: `id, vendor_id (fk vendors), title, description, image_url, price_purpose numeric, requires_shipping bool, stock int nullable, active bool, created_at, updated_at`
  - RLS: public select where `active=true`; vendor insert/update own (by `vendor_id` resolved from wallet); admin all
- `vendor_orders`: `id, product_id, vendor_wallet, champion_wallet, amount_purpose, amount_usdc, status` (`pending_approval` / `approved` / `settled` / `fulfilled` / `cancelled` / `refunded`), `shipping_address jsonb nullable`, `champion_signature text`, `tx_hash text`, `fulfillment_note text`, `created_at`, `updated_at`
  - RLS: champion reads/writes own; vendor reads/updates own; admin all
- New storage bucket `vendor-products` (public)

### Pages / components

- `src/pages/Shop.tsx` — public storefront grid grouped by vendor; filters by category
- `src/pages/ShopProduct.tsx` — product detail + "Buy with PURPOSE" button
- `src/pages/ChampionOrders.tsx` — champion's order history
- `src/pages/VendorProducts.tsx` — vendor CRUD on their catalog
- `src/pages/VendorOrders.tsx` — vendor sees incoming orders, marks fulfilled, adds tracking note
- Add nav links: "Shop" (public), "My Orders" (champion), "Products" + "Orders" (vendor)

### Online checkout flow

Same EIP-712 authorize-then-burn pattern as POS:

1. Champion clicks "Buy" → confirm sheet (no QR scan; vendor + amount already known)
2. Champion signs authorization → `vendor_orders` row created with signature, status `approved`
3. Edge function `vendor-order-settle` calls `VendorRedemption.redeem` from a backend signer **OR** vendor's POS picks it up via realtime and settles from vendor wallet (same as POS path — preferred so vendor controls gas/timing)
4. Vendor sees order in `VendorOrders.tsx`, marks fulfilled

Reuses the `VendorRedemption` contract — no new on-chain code beyond V2.

---

## Sequencing / what I'll do when you say go

1. **Now** — write Phase 1 Solidity files + README into `contracts/`. No frontend changes yet. (Pure code drop; safe to ship.)
2. **You deploy V2 contracts** via Remix/Foundry, send me the addresses.
3. **Phase 2 ship**: swap addresses + ABIs in `src/config/contracts.ts` and `src/contracts/abis/`, build POS terminal + champion confirm sheet + `redemption_requests` table + realtime + `redemption-confirm` edge function. Update soulbound-caveat memory.
4. **Phase 3 ship**: shop schema + storefront + vendor catalog + order pages, reusing the Phase 2 confirm-sheet component.

## Open questions before I start Phase 2/3 build

1. **Settlement signer** — when champion approves, should the **vendor's wallet** send the on-chain `redeem` tx (current model, vendor pays gas — though Base gas is pennies), or a **backend signer** holding a hot key (smoother UX, you eat the gas)? POS flow leans vendor-side; online shop leans backend-side. Picking one for both is simpler.
2. **Online shop physical goods** — okay to launch with vendor-handled fulfillment (no Shippo/Stripe) and revisit shipping integration later?
3. **Cart** — single-item checkout v1, add cart in v2? Or do you want cart from the start?

I'll answer these in chat once you approve the plan, then execute.
