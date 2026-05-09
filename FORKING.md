# Forking Proof of Purpose for your city

Proof of Purpose is open-source under **AGPL-3.0** so any community can run
the same protocol locally. This guide takes you from a fresh fork to a live
deployment.

> **Brand:** the name "Proof of Purpose", the $PURPOSE wordmark, and the
> visual identity in `src/assets/` are **not** part of the AGPL grant.
> Please rebrand before launching publicly. The code, contracts, and
> architecture are yours to reuse.

---

## 0. Prerequisites

- A wallet you control on **Base mainnet** with a small amount of ETH for
  gas (bridge ~$5–10 of ETH from Ethereum or buy on Coinbase → Base).
- A separate **treasury** wallet (we recommend a Safe / multisig).
- A **backend signer** keypair generated fresh for your fork — never reuse
  ours. Generate with `cast wallet new` or any wallet generator and store
  the private key in your secret manager only.
- An account on [Lovable](https://lovable.dev) (recommended — gives you
  Lovable Cloud, edge functions, and Postgres for free) **or** your own
  Supabase project + hosting.

---

## 1. Create your fork

1. Click **Fork** on GitHub, or import this repo into a new Lovable project.
2. Rebrand:
   - `package.json` → `name`
   - `index.html` → `<title>` and meta description
   - `src/index.css` → swap the brand color tokens (`--background`,
     `--primary`, `--accent`)
   - `src/assets/` → replace logos and hero art
   - `README.md` → your project name
3. Pick a license header for your fork. AGPL-3.0 is required for any
   redistribution under this codebase.

---

## 2. Deploy the contracts

Follow `contracts/DEPLOYMENT.md` end-to-end. It walks through all six
contracts in order:

1. `PurposeTokenV2`
2. `BountyManagerV2`
3. `VendorRedemptionV2`
4. `PurposeGovToken` (vPURPOSE shadow vote token)
5. thirdweb **Vote** governor
6. *(mainnet)* OpenZeppelin Timelock

Test on **Base Sepolia** first. Verify every step in the thirdweb dashboard
or Basescan before touching mainnet.

---

## 3. Wire the addresses

Edit `src/config/contracts.ts`:

```ts
export const CONTRACTS = {
  PURPOSE_TOKEN: "0xYOUR_PURPOSE_V2",
  VENDOR_REDEMPTION: "0xYOUR_VENDOR_REDEMPTION_V2",
  BOUNTY_MANAGER: "0xYOUR_BOUNTY_MANAGER_V2",
  TREASURY: "0xYOUR_TREASURY",
  USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // canonical Base USDC
  DONATION_SPLIT: "0xYOUR_DONATION_SPLIT",
} as const;

export const ADMIN_ALLOWLIST = [
  "0xYOUR_ADMIN_EOA",
  // optional ENS, e.g. "yourname.eth"
] as const;
```

The app auto-detects which addresses are populated and routes traffic
accordingly.

---

## 4. Set up the backend

In Lovable Cloud (or your own Supabase project):

1. Apply every migration in `supabase/migrations/` (Lovable Cloud does this
   automatically on first deploy).
2. Add the following **runtime secrets**:

   | Secret | Where to get it |
   |---|---|
   | `BOUNTY_ADMIN_PRIVATE_KEY` | The private key of the wallet you granted `BOUNTY_ADMIN_ROLE` to in step 2. |
   | `REDEMPTION_SIGNER_PRIVATE_KEY` | The private key of the backend signer you granted `SETTLEMENT_ROLE` to. |
   | `THIRDWEB_SECRET_KEY` | thirdweb dashboard → API Keys (server-side key). |
   | `RESEND_API_KEY` *(optional)* | If you want transactional email. |

3. Configure auth providers (Google, Apple, email) in your Lovable Cloud
   project's auth settings.

4. Deploy the edge functions in `supabase/functions/`. Lovable Cloud
   redeploys them automatically on every push.

---

## 5. Approve your first vendor and run a test bounty

1. From your admin EOA, on `VendorRedemptionV2.approveVendor(vendorAddr)`.
2. Visit `/admin/bounties`, create a small test bounty.
3. Sign in as a Champion on a second device, apply, and check in.
4. End the bounty as admin — `$PURPOSE` should mint to the Champion.
5. Have the vendor scan the Champion's redeem QR. The backend signer should
   call `redeemFor(...)` and the vendor wallet should receive USDC instantly.

If any step fails, check edge function logs first — the error almost always
explains itself (wrong allowance, missing role, etc.). See the **Common
gotchas** section in `contracts/DEPLOYMENT.md`.

---

## 6. Going public

- Read `SECURITY.md` and complete the **hardening checklist for forks**.
- Run the in-app security scan in Lovable Cloud and resolve every finding.
- Publish your forked repo with your branding and a clear `README.md`.
- Tell the upstream community! Open an issue or PR linking to your
  deployment so we can list cities running Proof of Purpose.

---

## What you get for free

- 4-role identity model (Champion / Catalyst / Vendor / Donor) with
  smart-wallet onboarding (email / Google / Apple / passkey, sponsored gas).
- On-chain bounty lifecycle with QR check-in.
- Vendor redemption settled by a backend signer (vendors never broadcast).
- USDC donations with auto-split (90% treasury / 8% admin / 2% founder —
  edit the splits in your `DonationSplit` deployment).
- Membership-NFT-based governance via thirdweb Vote (1 active membership =
  1 vote).
- Brutalist, accessible UI with full design-token theming.

## What you should change

- Rebrand. Always rebrand.
- Donation split percentages — set them to whatever your org needs.
- Admin allowlist — replace ours with yours.
- Vendor approval policy — ours is admin-gated; yours can be a council
  vote, a public form, etc.
- Code of Conduct — `/about/whitepaper` ships with ours; rewrite it for
  your community.

---

## Questions

Open a GitHub Discussion on the upstream repo, or email
admin@popmgm.org. We're happy to help new cities launch.
