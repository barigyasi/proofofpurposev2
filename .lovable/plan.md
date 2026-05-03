## Plan — Fix bounty creation against the live contract

The deployed `BountyManager` only exposes `createBounty(uint256 rewardAmount) returns (uint256)`. Our app is calling a 4-arg version that doesn't exist on-chain → revert. We'll align the frontend with the live ABI and store the rich metadata (name, description, image, max participants, location, expiry) in the backend `bounties` table only.

### Changes

1. **`src/contracts/abis/BountyManager.json`** — replace with the actual deployed ABI: `createBounty(uint256) returns (uint256)`, `BountyCreated(uint256 bountyId, uint256 rewardAmount)` event, plus `owner()`, `approvedAdmins(address)`, `addParticipant`, `completeBounty`, `getParticipants`, `bounties(uint256)` if present (we'll keep view shape minimal — just `(rewardAmount, completed)` or whatever the live one returns; off-chain table holds the rest).

2. **`src/hooks/useBountyAdmin.ts`**
   - `createBounty()` calls `function createBounty(uint256 rewardAmount) returns (uint256)` with `toPurposeWei(reward)`.
   - After `sendTransaction`, `waitForReceipt`, then decode logs with viem's `decodeEventLog` to pull `bountyId` from the `BountyCreated` event (no more `bountyCount()` follow-up read).
   - Insert full metadata into `public.bounties` (`title`, `description`, `reward_amount`, `image_url`, `location`, `expires_at`, `on_chain_id = bountyId`, `on_chain_tx_hash`, `created_by`, `status='open'`).
   - Drop the `bountyCount()` and `approvedAdmins()` reads from `preflight()` if those selectors aren't on the live contract — fall back to comparing against `owner()` only, plus our app's `admin` role.

3. **`src/hooks/useBounties.ts`** — stop reading the bounty list from chain. Source of truth becomes the `bounties` table (`select * order by created_at desc`). Optional per-row enrichment: read `getParticipants(on_chain_id)` if the live contract supports it; otherwise just show off-chain metadata.

4. **`src/pages/AdminBounties.tsx`** — render from the new backend-driven `useBounties()`. Keep the "complete" / "add participant" actions but guard them behind a try/catch so a missing on-chain method shows a friendly toast instead of crashing.

5. **`src/components/bounties/CreateBountyDialog.tsx`** — keep the form; just fix the React `forwardRef` warning by wrapping `DialogFooter` usage so the Button isn't given a ref it can't forward (small cleanup), and pass `maxParticipants` to the backend insert (not the contract).

### Out of scope
- No contract redeploy. We adapt to the live `createBounty(uint256)`.
- No DAO/governance changes.

Approve and I'll implement.