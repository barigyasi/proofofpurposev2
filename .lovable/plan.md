
# V2 Redemption Escrow + Refund Pool

Since V2 is **not yet deployed**, the escrow state machine ships *inside* `VendorRedemptionV2.sol` from day one. No live contracts are touched.

---

## Smart contracts

### 1. `VendorRedemptionV2.sol` (rewrite before deploy)

State machine per `chargeId` (bytes32, supplied by backend = vendor_charges.id):

```text
                  cancel()
        ┌─────────────────────┐
        ▼                     │
   ┌────────┐  capture()  ┌────────┐  settle()   ┌─────────┐
──▶│ Locked │────────────▶│Captured│────────────▶│ Settled │──┐
   └────────┘             └────────┘             └─────────┘  │
                                                              │ refund()
                                                              ▼
                                                         ┌─────────┐
                                                         │Refunded │
                                                         └─────────┘
```

**Storage per charge:** `vendor`, `champion`, `purposeAmount`, `usdcAmount`, `lockedAt`, `capturedAt`, `state`, `authWindowOverride`, `refundWindowOverride`.

**Per-vendor config** (admin-set): `authWindow`, `refundWindow`, falls back to global defaults.

**Functions (all role-gated `SETTLEMENT_ROLE` = backend signer):**
- `lock(chargeId, vendor, champion, purposeAmount)` — pulls PURPOSE from champion + USDC quote from treasury **into this contract**. State→Locked.
- `capture(chargeId)` — marks fulfilled, starts auth countdown. State→Captured. (Optional shortcut: `lockAndCapture` for in-person POS where there's no separate fulfillment step.)
- `cancel(chargeId)` — only while Locked or within auth window of Captured. Returns PURPOSE to champion + USDC to treasury. State→Cancelled.
- `settle(chargeId)` — callable after auth window expires (or admin force). Pays USDC to vendor; **PURPOSE stays in escrow** until refund window closes. State→Settled.
- `refund(chargeId, source)` — callable by vendor or admin within refund window. `source = Vendor | Pool`. Pulls USDC from chosen source back to treasury, returns the held PURPOSE to champion. State→Refunded.
- `sweep(chargeId)` — anyone, after refund window expires on a Settled charge. Burns the held PURPOSE via `purposeToken.burnFrom(address(this), amount)`. State→Finalized.

**Admin setters:** `setDefaultWindows`, `setVendorWindows(vendor,...)`, `setTreasury`, `setRefundPool`, `pause/unpause`.

**Roles needed on `PurposeTokenV2`:** `BURNER_ROLE` granted to this contract at deploy (no mint role — refunds replay original tokens).

### 2. `RefundPool.sol` (new, standalone)

Plain USDC vault. Functions:
- `deposit(amount)` — anyone (admin manually tops up; later: 0xSplits sends here automatically).
- `payRefund(chargeId, vendor, amount)` — only `REDEMPTION_ROLE` (granted to VendorRedemptionV2).
- `withdraw(to, amount)` — admin only (treasury rebalance).
- View: `available()`, total paid, per-vendor paid.

### 3. `PurposeTokenV2.sol`

Unchanged from the version already in `contracts/`. Just grant `BURNER_ROLE` to VendorRedemptionV2 at deploy.

---

## Backend (Supabase)

### Schema additions to `vendor_charges`

New columns (nullable): `locked_at`, `captured_at`, `refunded_at`, `cancelled_at`, `swept_at`, `lock_tx_hash`, `capture_tx_hash`, `cancel_tx_hash`, `refund_tx_hash`, `refund_source` (`vendor`/`pool`), `auth_window_seconds`, `refund_window_seconds`.

Status enum expands: `pending | confirmed | locked | captured | settled | refunded | cancelled | failed | expired`.

### New table `vendor_refund_config`
`vendor_wallet PK, auth_window_seconds, refund_window_seconds, updated_at`. Admin-managed mirror of on-chain per-vendor windows.

### New table `refund_pool_ledger`
`id, kind (deposit|payout|withdraw), amount_usdc, charge_id, tx_hash, actor, created_at`. Pure ledger for the admin pool card.

### Edge functions

- **`vendor-redeem-lock`** — replaces today's settle path. Verifies champion sig, calls `lock()` (or `lockAndCapture` for POS), writes `lock_tx_hash`, status→`locked`/`captured`.
- **`vendor-redeem-capture`** — vendor "Mark fulfilled" (online shop). Calls `capture()`.
- **`vendor-redeem-cancel`** — vendor or champion cancel within window.
- **`vendor-redeem-settle`** — cron-driven; finds Captured charges past auth window, calls `settle()`.
- **`vendor-redeem-refund`** — vendor or admin initiates. Picks source (vendor wallet via approval, or pool). Calls `refund()`.
- **`vendor-redeem-sweep`** — cron; burns PURPOSE on Settled charges past refund window.
- **`refund-pool-deposit`** — admin top-up (USDC transfer + ledger row).

Two cron jobs (`pg_cron`): every minute auto-settle eligible captured charges; every 5 min sweep finalized.

---

## Frontend

### Vendor dashboard (`src/pages/VendorDashboard.tsx`)
POS flow stays simple — scan QR, enter amount, champion confirms → backend calls `lockAndCapture` (auth window starts immediately). Charge row gains:
- Status pill: `Awaiting settle (Xh left)` / `Settled` / `Refundable (Xd left)` / `Refunded`
- **Issue Refund** button (visible while Settled & within refund window) → modal with reason + source selector (default: pool if funded, else vendor wallet).
- **Cancel** button (visible while Locked/Captured pre-settle).

### Champion (`ChampionChargeWatcher.tsx` + ChampionDashboard)
- Confirm dialog copy clarifies "Funds held until vendor confirms — refundable for X days after."
- New "Recent payments" list with status + refund link if applicable.

### Admin
- New `EscrowOpsCard` on `/admin`: counts in each state, force-settle / force-cancel / force-refund overrides.
- New `RefundPoolCard`: pool balance, top-up button, ledger preview, link to full ledger page.
- New `/admin/refunds` page: table of all refunds + filters.
- Per-vendor windows editor in `AdminVendors.tsx`.

### Config
`src/config/contracts.ts` — populate `CONTRACTS_V2.{PURPOSE_TOKEN, VENDOR_REDEMPTION, BOUNTY_MANAGER}` + add `REFUND_POOL`. Flip `V2_LIVE` automatically.

---

## Decisions locked in

- **USDC custody:** pulled into VendorRedemptionV2 on `lock()`.
- **Refund mechanics:** PURPOSE held in escrow until refund window closes, then burned by `sweep()`. No mint role needed.
- **Windows:** global defaults (24h auth / 7d refund) **+ per-vendor overrides** stored on-chain and mirrored in `vendor_refund_config`.
- **Refund Pool funding:** manual admin top-ups for v1; ledger built so future board vote can route a % of the 10% ops split here automatically. No 0xSplits reconfig now.

---

## Out of scope

- Champion-initiated refunds (only vendor/admin in v1; champion cancel only pre-settle).
- Multi-currency (USDC only).
- Migrating in-flight V1 charges — V1 keeps running, V2 is for new charges only.
- Automated refund-pool funding from donation split (deferred to post-board-formation vote).

---

## Rollout order

1. Write `RefundPool.sol` + rewrite `VendorRedemptionV2.sol`; update `contracts/DEPLOYMENT.md`.
2. Migration: extend `vendor_charges`, create `vendor_refund_config` + `refund_pool_ledger`.
3. New/updated edge functions + cron jobs.
4. Admin UI (escrow ops + refund pool + per-vendor windows).
5. Vendor + champion UI updates.
6. After you deploy contracts on Base, paste addresses into `CONTRACTS_V2` + `REFUND_POOL` and grant `BURNER_ROLE` / `REDEMPTION_ROLE`.
