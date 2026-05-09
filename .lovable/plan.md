## What broke
Your on-chain USDC transfer succeeded (tx `0x827b…ffb7`, $20 to the Donation Split). The recording step failed because the `donations` table has a check constraint:

```
source IN ('onramp', 'commerce', 'direct')
```

…but `src/pages/Donate.tsx` (line 52) sends `source: "wallet"`. Postgres rejected the insert with `23514 donations_source_check`, which surfaced as your "recording failed" toast. The donation is real on-chain — only the off-chain row is missing.

## Fix (two parts)

### 1. Code: use an allowed `source` value
In `src/pages/Donate.tsx`, change `source: "wallet"` → `source: "direct"`. "Direct" is the existing label for wallet-initiated transfers (vs. `onramp` = Coinbase Onramp, `commerce` = Coinbase Commerce). One-line change.

### 2. Backfill the missing donation row
Insert the $20 donation we just lost so your treasury totals and your monthly-membership mint are correct:

```sql
INSERT INTO donations (donor_wallet, source, amount_usdc, tx_hash, status)
VALUES (
  '0x8BE23818245AfefE20714148B99c4Dd1b5969f2B',
  'direct',
  20,
  '0x827baa66e7ce789b0fe744896ab6907143ce80dc47b5adbad7ac56a5e677ffb7',
  'confirmed'
);
```

Then call the `mint-monthly-membership` edge function with the new row's id so your May membership NFT mints (since amount ≥ $5).

## Files touched
- `src/pages/Donate.tsx` — single string change.
- One Supabase insert (data, no migration) + one edge-function invocation for the membership mint.

## Out of scope
- No schema/constraint changes. The current `('onramp','commerce','direct')` set is fine — `direct` is the right bucket for a connected-wallet transfer.
- No changes to `mint-monthly-membership` or treasury sync.
