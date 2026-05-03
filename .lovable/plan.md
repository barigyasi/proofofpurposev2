# Finalize Phase 1 + Champion Dashboard (Phase 2)

## Part A — Close out Phase 1

1. **Populate ABIs** with the source you pasted:
   - `src/contracts/abis/PurposeToken.json` — full ERC20Burnable + `mint`, `setBountyManager`, `bountyManager`, `owner`, `transferOwnership`
   - `src/contracts/abis/BountyManager.json` — full ABI from your first paste (`addParticipant`, `approveAdmin`, `completeBounty`, `createBounty`, `removeAdmin`, `updateTreasury`, plus the read methods + events)
   - `src/contracts/abis/VendorRedemptionManager.json` — leave as `[]` placeholder until you paste it (not needed for champion view)

2. **Project memory** — write two notes:
   - `mem://constraints/purpose-token-soulbound`: PurposeToken is **not** soulbound at the contract level. Mitigation: never expose `transfer`/`approve` PURPOSE UI. Burns happen via VendorRedemption only. Backlog: redeploy with `_update` override reverting unless `from == 0` or `to == 0`. You also plan to redeploy `PurposeBountyManager`.
   - `mem://index.md` Core line: "PURPOSE token: never expose transfer/approve in UI."

## Part B — Champion Dashboard (matches your screenshot)

**Route:** `/dashboard` (default landing for any signed-in user without admin/vendor role).

**Layout**

```text
"What's poppin, Champ? 🚀"

┌─ Your $PURPOSE Balance ──────────────────┐
│           <balance, gold, 2dp>           │
│           [ Show Redeem QR ]             │
└──────────────────────────────────────────┘

──── Active Bounties ────
  cards for bounties champ signed up for, not yet completed

──── Available Bounties ────
  cards for open bounties champ hasn't joined
  [View Details]  [Sign Up]
```

**Components**
- `pages/Dashboard.tsx` — role-router: admin→`/admin`, vendor→`/vendor`, else ChampionDashboard
- `components/champion/ChampionDashboard.tsx` — page composition + greeting
- `components/champion/PurposeBalanceCard.tsx` — `balanceOf(account)` on PURPOSE via thirdweb readContract; format from 1e18; gold accent
- `components/champion/RedeemQRDialog.tsx` — QR encodes `{wallet, expires_at, signature}` (champion signs a short-lived nonce client-side; vendor scanner verifies later)
- `components/bounties/BountyCard.tsx` — shared, props: `{ bounty, mode: "active" | "available", onSignUp, onViewDetails }`
- `components/bounties/BountyDetailsDialog.tsx` — title, description, reward, slots, deadline
- `hooks/useBounties.ts` — reads bounties from BountyManager: loop `bountyCount`, call `bounties(i)` + `getParticipants(i)`; split active vs available based on whether `account.address` is a participant and `completed == false`
- `hooks/usePurposeBalance.ts` — wraps `balanceOf`, 15s polling + invalidation after sign-up

**Data flow**
- Bounty list = chain-only for now (no DB mirror — keeps state honest)
- Sign-up calls `addParticipant(bountyId, account.address)` via thirdweb sponsored-gas smart account
  - Note: in the contract you pasted, `addParticipant` requires the caller to be an approved admin. We'll need either (a) a champion-callable `signUpForBounty(bountyId)` in the redeployed BountyManager, or (b) a backend edge function `bounty-signup` that calls `addParticipant` with an admin signer key. **Recommendation: (a) — add a public `signUpForBounty` to your redeploy.** Until redeploy, the Sign Up button calls a `bounty-signup` edge function as a stopgap.

**Styling**
- Existing semantic tokens; balance number `text-primary text-4xl font-bold`
- Section dividers: thin border with centered muted label (matches screenshot)
- Empty state for Active: muted "No active bounties yet."

## Part C — Header + role routing

- `components/layout/Header.tsx`: logo, Vendors / Docs / Dashboard / About / Donate / Logout, theme toggle
- Logout: `supabase.auth.signOut()` + thirdweb disconnect
- Wire `<Header />` into App layout above all routes

## What I'll need from you

- **Stopgap signer for `bounty-signup`** (only if you want Sign Up to work *before* you redeploy): an admin EOA private key set as a Supabase secret `BOUNTY_ADMIN_PRIVATE_KEY`. Skip this if you're fine with Sign Up being disabled until your redeploy ships.
- For the redeployed `PurposeBountyManager`, add a public `signUpForBounty(uint256 bountyId)` that does `bounties[bountyId].participants.push(msg.sender)` with checks for: bounty exists, not completed, not already signed up, max participants not exceeded.

## Out of scope this pass

Vendor scanner + redemption flow, admin pages (applicants/bounties/vendors), donations, transparency page, public marketing pages.