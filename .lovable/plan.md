# Surface defeated/expired proposals + Re-propose

Make failed governance proposals visible and recoverable in admin, without manual SQL.

## Changes

### 1. Governance sync — write a terminal status

In the existing governor state polling (wherever `executed_at` is set after a successful execute), add the symmetric path:

- If on-chain `state()` returns `Defeated (3)`, `Canceled (2)`, or `Expired (6)` and the draft is still `pending_vote` / `queued`, set `bounty_drafts.status = 'defeated'` and stamp `outcome_notes` with the on-chain state label.
- Keep `dao_proposal_id` on the row so we have an audit trail.

This makes `useTreasuryHeadroom` automatically stop reserving headroom for those drafts (the recent fix already excludes anything not in active/queued/executing).

### 2. Admin UI — show defeated drafts with a Re-propose action

On `/admin/bounties`, add a collapsed "Defeated / Expired" section below the active list:

- Lists drafts where `status = 'defeated'` (newest first).
- Each row: name, reward, vote counts, on-chain state label, "RE-PROPOSE" button.
- "RE-PROPOSE" clones the draft into a fresh `bounty_drafts` row (new id, `status = 'pending_vote'`, fresh `vote_opens_at` / `vote_closes_at`, cleared `dao_proposal_id` / `on_chain_bounty_id` / `executed_at` / snapshot fields) and toasts success. The old defeated row stays in place for history.

### 3. Past Props page

`/governance/past` already reads from `bounty_drafts`. Confirm defeated rows render with the right badge; add a `DEFEATED` chip variant if missing.

## Technical notes

- No schema migration: `bounty_drafts.status` is a free `text` column, so `'defeated'` is a valid value the moment we start writing it. The trigger `tg_bounty_drafts_protect_cols` already restricts status updates to admins, which is what we want.
- Re-propose runs entirely client-side as an admin insert (admin RLS already allows it). No edge function needed.
- The governor state read should reuse the existing helper in `src/lib/governor.ts` (`PROPOSAL_STATE_LABEL`).
- Scope is intentionally small — no new tables, no edge functions, no contract calls beyond the existing state poll.

## Out of scope

- Auto-deleting defeated drafts.
- Editing draft fields during re-propose (admin can edit the new row afterward like any other draft).
- Pushing the re-proposed draft straight back on-chain — it starts as `pending_vote` and follows the normal flow.