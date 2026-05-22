## Goal

Stop counting failed or expired bounty proposals toward the app-wide `committed` / `headroom` totals.

## Changes

1. Update the shared headroom calculation in `src/hooks/useTreasuryHeadroom.ts` so draft rewards reserve headroom only when they are still actively in flight:
   - `pending_vote` and the vote window is still open
   - `queued`
   - `executing`

2. Remove the current fallback that counts any draft with a `dao_proposal_id`, since that incorrectly keeps failed proposals reserved forever.

3. Keep all existing UI components wired to the same shared hook so the fix automatically propagates to:
   - landing page treasury stat
   - admin bounty headroom card
   - create bounty dialog
   - catalyst dashboard projections
   - any submit/preflight checks using `readTreasuryHeadroom()`

## Expected result

The stale `25 committed` value disappears everywhere a failed proposal was being included, while still preserving reservations for live votes and queued/executing proposals.

## Technical notes

- No database migration is needed for this fix.
- This is a frontend/shared-query logic correction only.
- A future cleanup could add an explicit terminal status like `defeated`/`expired` in the governance sync flow, but that is not required for this app-wide display fix.