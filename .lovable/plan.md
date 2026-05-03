
# Build-out plan

Goal: stand up bounty creation on-chain (test ASAP), introduce a new **Catalyst** role for partner orgs, wire DAO-gated approvals via the `VoteERC20` governor, and finish every remaining page.

---

## Phase 0 — Catalyst role + new schema

1. **DB migration** (one migration, schema only):
   - Add `'catalyst'` to `app_role` enum.
   - New table `catalyst_orgs` (id, user_id, org_name, mission, website, logo_url, contact_email, location, approved bool default false, approved_at, approved_by, created_at, updated_at). RLS: catalyst can select/update own; admin all; public select where approved=true.
   - New table `bounty_drafts` (id, catalyst_id, name, description, reward_purpose numeric, max_participants int, image_url, location, expires_at, status text default 'pending_vote', dao_proposal_id numeric null, created_bounty_id uuid null, on_chain_id bigint null, on_chain_tx_hash text null, created_at, updated_at). RLS: public select; catalyst insert own; admin all.
   - Add `vote_contract_address text` column to a new `governance_config` table (single row) so the governor address can be set after deployment without a redeploy.
   - Storage policies for `bounty-images` (insert by authenticated catalyst/admin; select public).

2. **Edge function `grant-catalyst-role`** (admin-only, service role) — promotes an applicant's wallet to the `catalyst` role and marks `catalyst_orgs.approved=true`.

---

## Phase 1 — Bounty creation on-chain (test path)

Goal: prove createBounty works end-to-end before adding governance.

3. **Admin → Bounties (`/admin/bounties`)**
   - List existing bounties (uses `useBounties`).
   - "CREATE BOUNTY" dialog (super admin only, bypasses DAO): name, description, reward (PURPOSE decimal → wei), max participants, image upload, optional location/expiry.
   - Pre-flight reads `BountyManager.owner()` + `approvedAdmins(addr)`; warn if connected wallet can't write.
   - Sends `createBounty` tx via thirdweb `prepareContractCall` + `useSendTransaction` from connected admin smart wallet (sponsored gas).
   - On confirmation: derive new id from `bountyCount`, mirror into `bounties` table.
   - Row actions: **Complete** (`completeBounty`), **Add participant** (`addParticipant`).

4. **Hook `useBountyAdmin.ts`** wraps the three writes + invalidates `["bounties"]`.

5. **Update `Admin.tsx`** to link the BOUNTIES tile to `/admin/bounties` (drop "soon").

✅ At end of Phase 1 you can create + complete bounties on-chain as super admin and see them appear in champion + admin views.

---

## Phase 2 — Catalyst (partner-org) flow + DAO proposals

6. **Public application page `/apply/catalyst`**
   - Public form: org_name, mission, website, contact_email, location, logo upload, wallet address (auto-filled if connected).
   - Inserts into `catalyst_orgs` (approved=false) + `pending_applicants` (requested_role='catalyst').

7. **Admin → Applicants (`/admin/applicants`)**
   - Lists pending_applicants (champion, vendor, catalyst).
   - Approve → calls `grant-catalyst-role` / `grant-vendor-role` / existing champion path; marks reviewed.
   - Reject → status='rejected'.

8. **Catalyst dashboard (`/catalyst`)** (RoleGuard `catalyst`)
   - "PROPOSE BOUNTY" dialog → inserts `bounty_drafts` row (status='pending_vote') and creates a DAO proposal:
     - Build calldata for `BountyManager.createBounty(name, description, rewardWei, maxParticipants)` using `encodeFunctionData`.
     - Call `Governor.propose([BOUNTY_MANAGER], [0], [calldata], description)` from the catalyst's wallet (only works if they hold ≥ proposalThreshold votes; otherwise super admin proposes on their behalf via fallback edge function).
     - Store returned `proposalId` on the draft.
   - Lists their drafts with state badge derived from `Governor.state(proposalId)` (Pending / Active / Defeated / Succeeded / Executed).

9. **Governance page `/governance`** (RoleGuard anyOf `[admin, catalyst, donor]`)
   - Reads `getAllProposals()` and per-proposal `proposalVotes`, `state`, `proposalDeadline`.
   - Shows linked draft (joined from `bounty_drafts.dao_proposal_id`).
   - Vote buttons: For (1), Against (0), Abstain (2) → `castVoteWithReason`. Disabled if `hasVoted(id, addr)` or no voting weight.
   - "Execute" button when state==Succeeded → `Governor.execute(...)` which causes the governor to call `BountyManager.createBounty` on-chain.
   - Post-execution watcher: edge function `sync-bounty-from-proposal` (or a button "Sync now") reads the new `bountyCount`, mirrors into `bounties`, links to the draft (`created_bounty_id`, `on_chain_id`, `on_chain_tx_hash`), sets draft status='posted'.

10. **Donor "voting weight" pre-req**
    - The governor's `_token` must be an ERC20Votes that we can mint to donors/catalysts/admin. Two options:
      - **(default)** new lightweight `PoPVote` ERC20Votes token deployed alongside the governor; non-transferable; minted by super admin to `donor`/`catalyst` wallets in proportion to USDC donated / org standing. Until you deploy it, the UI will show "voting opens once governance launches" and gate proposing/voting behind the contract address being set in `governance_config`.
    - Until governor is deployed, `/governance` shows a friendly "Coming soon — DAO contract not yet configured" state and Phase-1 admin bounty creation remains available.

---

## Phase 3 — Vendor flow + QR redemption

11. **Vendor signup (`/apply/vendor`)** — form into `vendors` (approved=false) + `pending_applicants`.
12. **Admin → Vendors (`/admin/vendors`)** — approve calls `VendorRedemption.approveVendor`, sets `approved=true`/`approved_tx_hash`, grants `vendor` role via new edge fn `grant-vendor-role`.
13. **Vendor dashboard (`/vendor`)** — "SCAN QR" using `html5-qrcode`. On scan: parse `{wallet, expires_at, signature}`, verify expiry, call edge fn `vendor-redeem-verify` (verifies signature with viem `verifyMessage` + role check), then vendor wallet sends `VendorRedemption.redeem(champion, amountWei)` via thirdweb. On confirmation, insert `vendor_redemptions`.

---

## Phase 4 — Public surface

14. **`/`** — hero + CTAs (Donate / Apply as Champion / Apply as Catalyst / Become a Vendor).
15. **`/vendors`** — public approved-vendor directory.
16. **`/donate`** — USDC amount → wallet `transfer` to `DONATION_SPLIT`. After tx confirms, edge fn `record-donation` reads receipt and inserts `donations` row + (optionally) mints PoPVote weight to donor.
17. **`/about`** — mission, how PURPOSE works, links to BaseScan for all contracts.
18. **`/bulletin`** — feed using `bulletin_posts` + `bulletin_comments`.

---

## Phase 5 — Admin polish

19. **Admin → Catalysts (`/admin/catalysts`)** — manage approved orgs, revoke role.
20. **Admin → Donations (`/admin/donations`)** — donations table + totals.
21. **Admin → Treasury (`/admin/treasury`)** — read USDC balance of TREASURY + total PURPOSE supply.
22. **Admin → Audit log (`/admin/audit`)** — combined stream (bounty txs, redemptions, vendor approvals, donations, proposals).

---

## Phase 6 — Routing/auth glue

23. Update `App.tsx` with all new routes; wrap admin/vendor/catalyst routes with role-aware redirects.
24. Update `Header.tsx` nav: add **Apply ▾** (Champion / Vendor / Catalyst), **Governance**, **Bulletin**.
25. Update `Dashboard.tsx` redirector to also send `catalyst` → `/catalyst`.
26. Update memory: add Catalyst role + governance flow.

---

## Technical details

- **Contracts on Base 8453**:
  - `BountyManager 0x0F2C…0a51`: `createBounty`, `completeBounty`, `addParticipant`, `approvedAdmins`, `owner`. Governor address must be added via `approveAdmin(governor)` before execute() can call `createBounty`.
  - `VendorRedemption 0x3391…229E`: `approveVendor`, `redeem` (names confirmed from ABI before wiring).
  - `USDC 0x8335…2913`: `transfer` for donations.
  - **VoteERC20** (TBD address) — stored in `governance_config.vote_contract_address`.
  - **PoPVote ERC20Votes** (TBD) — voting-weight token.

- **New ABIs**: drop `VoteERC20.json` (provided) into `src/contracts/abis/` and a minimal `ERC20Votes.json` (delegate, getVotes, mint).

- **New edge functions**: `grant-catalyst-role`, `grant-vendor-role`, `record-donation`, `sync-bounty-from-proposal`, `vendor-redeem-verify`.

- **New deps**: `html5-qrcode` for vendor scanner. No native binaries.

- **Auth invariants kept**: roles only in `user_roles`, super-admin allowlist server-side, PURPOSE never exposed via transfer/approve UI, RLS uses `has_role()`/`has_any_role()`.

- **Governance graceful degradation**: If `governance_config.vote_contract_address` is null, /governance and Catalyst "Propose" UIs show "DAO not yet live" and super-admin keeps the manual `/admin/bounties` create path.

After Phase 1, you'll be able to mint a real bounty on Base from the admin wallet. We then layer Catalysts → DAO → vendor scanner → public pages → admin polish.
