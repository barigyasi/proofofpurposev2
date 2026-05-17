# Governance: on-chain cutover + donor surfaces

Right now bounty drafts use a Supabase tally and an admin manually clicks "Post on chain". This plan moves voting onto the deployed `POPGovernor` (Governor Bravo-style) backed by `vPURPOSE`, enforces "1 active membership = 1 vote", and gives donors a clear home for governance.

Ship in 3 focused phases so each is testable before the next. Phase 1 has zero contract risk; phase 2 is the on-chain wiring; phase 3 is polish.

---

## Phase 1 — Donor governance surfaces + membership gate (no contract changes)

**Goal:** donors immediately see where to vote, and only people with an active membership NFT + self-delegated voting power can actually cast a vote.

1. **Donor dashboard "GOVERNANCE" card** on `/dashboard`
   - Shows: # active proposals, your voting power (membership count), self-delegate status, big CTA to `/governance`.
   - Hidden if user has no donor/catalyst/admin role.

2. **Post-mint nudge on `/donate`**
   - After successful membership mint, show "Activate voting power" (self-delegate button, already built) + "Go to Governance" CTA.

3. **Header nav: add "GOVERNANCE"** for donor/catalyst/admin roles (currently buried).

4. **Vote gating in `/governance`** (`useDraftVotes.castVote` + UI):
   - Require: connected EOA, at least one **active** `membership_mints` row for that wallet, and `vPURPOSE.delegates(wallet) == wallet`.
   - If any check fails → disabled button with inline reason ("Mint a membership", "Activate voting power").
   - Vote weight = count of active memberships for that wallet (server-validated via RPC).

5. **New RPC `eligible_vote_weight(_wallet text)`** (SECURITY DEFINER) → returns int count of active membership_mints. Used both by UI and by an RLS check on `bounty_draft_votes` insert.

## Phase 2 — On-chain proposal lifecycle

**Goal:** "Post for vote" creates a real Governor proposal; voting writes on-chain; execute mints the bounty automatically.

1. **`governor-propose` edge function** (admin-only)
   - Input: `draft_id`
   - Encodes `BountyManagerV2.createBounty(rewardWei)` calldata
   - Calls `POPGovernor.propose([bountyManager], [0], [calldata], description)` from backend signer (gas paid by treasury)
   - Stores returned `proposalId` in `bounty_drafts.dao_proposal_id` + tx hash
   - Replaces today's manual "Post on chain" step on admin draft cards

2. **On-chain vote in `useDraftVotes.castVote`**
   - If `draft.dao_proposal_id` is set → call `POPGovernor.castVote(proposalId, support)` from user's smart wallet (sponsored gas)
   - Mirror to Supabase for UI snappiness (still useful for live counters), but on-chain is source of truth
   - Read live `proposalVotes(proposalId)` via thirdweb `useReadContract` and show under each draft

3. **`governor-execute` edge function** (anyone w/ admin role can trigger; or auto-poll)
   - When `state(proposalId) == Succeeded`, calls `governor.queue(...)` then `governor.execute(...)`
   - On success, reads `BountyCreated` event → writes `on_chain_bounty_id` + `on_chain_tx_hash` + `status='open'` on the draft and creates the matching `bounties` row
   - Champions then see it on their dashboard (existing flow already keys off `on_chain_bounty_id`)

4. **Governor + vPURPOSE ABIs + helper module** `src/lib/governor.ts` with state enum, calldata encoder, vote-period reads.

5. **Status badges on draft cards**: `Drafting → Voting (on-chain) → Succeeded → Queued → Executed → Live bounty`.

## Phase 3 — Polish

1. **Proposal detail page** `/governance/:proposalId` with on-chain quorum/turnout/timing pulled live.
2. **Backfill**: drafts created before cutover keep the Supabase tally path; new drafts go on-chain. A small banner explains.
3. **Memory + governance_config update**: write `vote_contract_address` + `vote_token_address` rows; flip the "interim" wording in the project memory once phase 2 is verified on Base.

---

## Technical details

- **Contracts (already deployed, Base mainnet)**:
  - `POP_GOVERNOR: 0x137CDAE27838Ddb13572dDDf6bb13E982D968E97`
  - `VPURPOSE_TOKEN: 0x437718C580C109610Bc5a74A439a7Fb6ad83835e`
  - `BOUNTY_MANAGER_V2: 0x19cabb84B1A05D89f5F43D6f589b31dbAfd0F352`
  - Governor must hold `BOUNTY_ADMIN_ROLE` on BountyManagerV2 (one-time `grantRole` from current admin; verify before phase 2 ships).
- **Voting power**: vPURPOSE is ERC20Votes; we already mint 1 vPURPOSE per membership and added a self-delegate button. UI gate uses `delegates(wallet)`; on-chain `getVotes` is automatically right.
- **Backend signer**: existing `BOUNTY_ADMIN_PRIVATE_KEY` reused for `propose`/`queue`/`execute`. No new secrets.
- **Eligibility RPC** prevents bypassing the membership gate by hitting Supabase directly.
- **Sponsored gas**: votes are smart-wallet calls → free for donors.

```text
draft  ──propose──▶  Governor.proposalId  ──castVote(vPURPOSE weight)──▶
   Succeeded ──queue──▶  Timelock ──execute──▶  BountyManager.createBounty
   ──▶  on_chain_bounty_id set ──▶ champion sees it on /dashboard
```

---

## What I'll do first

Ship **Phase 1** in this turn (surfaces + gate + RPC). It's self-contained, gives donors immediate value, and de-risks Phase 2 (we'll already know exactly who's eligible). Phase 2 lands next turn after you confirm a Governor role grant on BountyManagerV2.
