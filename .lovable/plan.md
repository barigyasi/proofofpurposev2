## Show participant names on the bounties admin page

Right now `/admin/bounties` lists each signup as a raw `0x…` wallet. Replace it with the person's name, falling back to ENS, then a shortened address.

### Where names come from

For any bounty signup we have `user_id` and `wallet_address`. Resolve the friendly name in this priority order:

1. `champion_applications.champion_name` where `user_id` matches and status is `approved` (most signups will be champions).
2. `profiles.display_name` or `profiles.username` for the same `user_id`.
3. Verified ENS name for the wallet (already wired via `AddressLabel`).
4. Shortened address `0x1234…abcd` as last resort.

### Changes

1. **New hook `src/hooks/useParticipantNames.ts`**
   - Takes an array of `{ user_id?: string; wallet_address: string }`.
   - One batched query each to `champion_applications` (filter by user_ids, status=approved) and `profiles` (filter by user_ids).
   - Returns a `Map<walletLower, string | null>` of resolved names (null = no friendly name found).
   - Cached in component state; re-runs when the input set changes.

2. **`src/components/ParticipantLabel.tsx`**
   - Props: `userId?`, `wallet`, optional `nameOverride`.
   - Renders the resolved name (bold) on top, with the existing `AddressLabel` (ENS / shortened addr, basescan link) as a tiny secondary line so admins can still verify on-chain identity.
   - If no name is found, just renders `AddressLabel` directly (so ENS still wins over raw 0x).

3. **`src/pages/AdminBounties.tsx`**
   - Call `useParticipantNames(allSignups)` once per render.
   - Swap the `<code>{s.wallet_address}</code>` block (line 117) for `<ParticipantLabel userId={s.user_id} wallet={s.wallet_address} nameOverride={names.get(...)} />`.
   - Add `user_id` to the `Signup` type and SELECT.

4. **`src/pages/AdminBountyScan.tsx`**
   - When a scan / manual entry confirms a wallet, look up the name (single query to `champion_applications` then `profiles` by wallet_address). Show "Checked in: **{name}**" with the address as smaller secondary text.

### Out of scope
- Bulletin / Governance / public-facing name display (separate concerns; user only mentioned the bounties page).
- Editing names. Names come from existing `champion_applications` / `profiles` rows.