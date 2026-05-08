## Why /admin/donations shows $0.00

The page is correct — the `donations` table in the database is **empty (0 rows)**. Your $4.50 donation hit the on-chain split contract (`0x214a…C8dC`) but was never written to Supabase. That happens when:

- the donation was sent directly on-chain (e.g. from Basescan / a wallet) instead of through `/donate`, or
- the insert from `/donate` failed after the tx confirmed, or
- it pre-dates the recording code.

We need a way to pull donations **from the chain** instead of relying on the app to write them.

## Plan

### 1. New edge function `sync-donations`
- Reads all `Transfer(from, to=DONATION_SPLIT, value)` events on Base USDC (`0x8335…2913`) since the most recent `tx_hash` already in `donations` (or from a configurable start block on first run).
- For each new transfer, upserts a row into `donations` keyed by `tx_hash`:
  - `donor_wallet` = `from`
  - `amount_usdc` = value / 1e6
  - `source` = `"onchain"` (so we can distinguish from `"wallet"` rows the app writes)
  - `status` = `"confirmed"`
  - `tx_hash` = the transfer hash
- Uses an Alchemy / public Base RPC via `fetch` (no new secrets needed if we use a public Base RPC; if rate-limited we can add `BASE_RPC_URL` later).
- Admin-only: verifies the caller's JWT and `has_role(uid, 'admin')` before running.
- DB constraint: add `UNIQUE (tx_hash) WHERE tx_hash IS NOT NULL` so the upsert is safe and re-running can't create duplicates.

### 2. New "SYNC FROM CHAIN" button on `/admin/donations`
- Sits next to the heading.
- Calls the edge function, shows toast with how many rows were inserted, then refetches the list.
- Running it now will backfill the $4.50 and any other historical donation.

### 3. Small UI tweak on `/admin/donations`
- Add a `tx ↗` Basescan link (already there) and label rows by `source` so on-chain-synced ones are visibly tagged.

### Out of scope for this pass
- Automatic cron (we can add a scheduled trigger later once we confirm sync works).
- Champion referral attribution for direct on-chain donations (no way to recover that off-chain context — only `/donate` flow can capture it).