# Monthly Membership NFT — Plan

## Concept (locked in)

- **Trigger:** Any donation ≥ **$5 USDC** in a given calendar month auto-mints that month's membership NFT to the donor.
- **One per wallet per month.** Donating multiple times in the same month does not stack mints (still 1 vote, still 1 NFT for that month). Donating in a new month mints that new month's piece.
- **Auto-mint, no claim step.** Sponsored gas via the existing smart-wallet stack — donor sees only "Thanks, your May 2026 membership is in your wallet."
- **Transferable** ERC-721 with on-chain **EIP-2981 royalties** routed to `DONATION_SPLIT` (so secondary sales keep funding the mission).
- **Generative per donor:** shared monthly theme/palette, but each token's traits are unique to the wallet that earned it. Art is fully on-chain SVG.
- **Governance is unchanged:** still 1 wallet = 1 vote, capped. Holding/buying the NFT on secondary does **not** grant voting rights — only the original donating wallet votes. (Buyers get the collectible + royalty-funded mission, not governance capture.)
- **Weekly auction idea is dropped.**

## What gets built

### 1. Smart contract: `MembershipNFT.sol` (Base mainnet)

ERC-721 + EIP-2981, owner-gated minter.

```text
mintFor(address donor, uint16 monthKey, bytes32 seed)
  - only callable by approved minter (Treasury-owned EOA / edge function)
  - reverts if (donor, monthKey) already minted
  - stores seed for on-chain tokenURI generation

tokenURI(id) -> data:application/json;base64,...
  - assembles SVG from layered traits selected by hashing(seed, monthKey)
  - month determines palette + headline motif
  - per-wallet seed determines body/accessory/background variants

royaltyInfo(id, salePrice) -> (DONATION_SPLIT, salePrice * 500 / 10000)  // 5%
```

Notes:
- Soulbound is **off** — `_update` not restricted.
- `monthKey` = `YYYYMM` so months are deterministic and queryable.
- Owner can register monthly palettes/motifs ahead of time; falls back to a default palette if a month isn't pre-registered.

### 2. Edge function: `mint-monthly-membership`

Triggered after a confirmed donation insert. Logic:

1. Validate JWT, load donation row by id.
2. If `amount_usdc < 5` → exit.
3. Compute `monthKey` from `created_at` (UTC).
4. Check `membership_mints` table for `(donor_wallet, month_key)` — if exists, exit.
5. Build deterministic `seed = keccak256(donor_wallet || monthKey || salt)`.
6. Call `MembershipNFT.mintFor(...)` using `BOUNTY_ADMIN_PRIVATE_KEY` (reuse existing signer) — sponsored from treasury EOA.
7. Insert into `membership_mints` with token id + tx hash.

Called from `Donate.tsx` right after the existing `supabase.from("donations").insert(...)` succeeds (non-blocking; toast updates to "Membership minted ✓").

### 3. Database

New table `membership_mints`:
```text
id uuid pk
donor_wallet text
month_key int            -- 202605
token_id bigint
tx_hash text
contract_address text
created_at timestamptz
unique(donor_wallet, month_key)
```
RLS: public read, admin-only write (mints inserted by edge function via service role).

Add `MEMBERSHIP_NFT` to `src/config/contracts.ts` once deployed.

### 4. UI

- **Donate page:** add "Donate $5+ this month → get the May 2026 membership NFT" badge above the amount input. After successful donate of ≥$5, show the minted token preview inline.
- **Dashboard / Champion dashboard:** new "Memberships" strip showing the donor's collected months as a horizontal scroll of on-chain SVG previews.
- **About / Index:** short explainer card "Monthly membership · generative · funds the mission on resale."
- **Admin → Treasury:** add a tile showing total memberships minted this month + lifetime, plus secondary-royalty USDC received (read from DONATION_SPLIT events, future iteration).

### 5. Governance update (small)

`Governance.tsx` already enforces 1-vote-per-wallet via the donor record. Add a guardrail: voting eligibility checks the `donations` table (donor_wallet has any confirmed donation), **not** NFT ownership. This makes the NFT freely tradable without leaking votes.

## Out of scope for this pass

- Trait artwork itself — placeholder SVG primitives go in first; swap once you've sourced the layer set from Fiverr / commissioned work.
- Secondary marketplace listing (OpenSea/Magic Eden auto-index it from contract metadata once deployed).
- Royalty-receipt analytics dashboard (separate iteration once funds start flowing).

## Order of work once approved

1. Write & deploy `MembershipNFT` to Base, add address to `contracts.ts`.
2. Migration: `membership_mints` table + RLS.
3. Edge function `mint-monthly-membership` + wire into `Donate.tsx`.
4. UI: Donate badge, Dashboard memberships strip, Treasury tile.
5. Placeholder generative SVG (5 layers, ~6 variants each) so something visible mints day one.

Approve and I'll execute in that order. The contract code itself I'll need you to deploy (or paste the deploy artifact back) — everything else I can ship end-to-end.
