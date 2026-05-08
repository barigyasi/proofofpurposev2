# Proof of Purpose

> **An on-chain youth impact protocol.** Donors fund a transparent USDC
> treasury. Trusted partner orgs (**Catalysts**) propose real-world bounties.
> Youth (**Champions**) show up and do the work. A Catalyst verifies
> attendance in person via QR scan — the scan is the on-chain proof.
> `$PURPOSE` is minted directly to the Champion's wallet, redeemable 1:1
> for USDC at approved local **Vendors**.

Built on **Base**. Open-source under **AGPL-3.0**. Designed to be forked
city-by-city.

📖 **[Whitepaper](./src/pages/Whitepaper.tsx)** &nbsp;·&nbsp;
🌐 **[docs.popmgm.org](https://docs.popmgm.org)** &nbsp;·&nbsp;
🛠 **[Fork it for your city](./FORKING.md)** &nbsp;·&nbsp;
🔐 **[Security policy](./SECURITY.md)** &nbsp;·&nbsp;
🤝 **[Contributing](./CONTRIBUTING.md)**

---

## Why this exists

Most youth-incentive programs are opaque: cash gets handed out, paperwork
piles up, and donors never see where their dollar landed. Proof of Purpose
puts the entire loop on-chain — donation → bounty → verified attendance →
youth reward → local-business spend — so every step is publicly auditable
in real time. No prepaid cards, no spreadsheets, no trust-us.

Champions don't need a wallet, a seed phrase, or a crypto background.
They sign in by email, Google, Apple, or passkey; a smart wallet is created
silently with sponsored gas. From their perspective: tap **ENTER**, do the
work, get paid at a vendor down the street.

## How it works

```text
   DONOR                 CATALYST              CHAMPION              VENDOR
     │                      │                     │                    │
     │ 1. donate USDC       │                     │                    │
     ├─────────────────────▶│                     │                    │
     │                      │ 2. post bounty      │                    │
     │                      ├────────────────────▶│                    │
     │                      │ 3. QR scan          │                    │
     │                      │    on-chain check-in│                    │
     │                      ├────────────────────▶│                    │
     │                      │ 4. end bounty       │                    │
     │                      │    mint $PURPOSE    │                    │
     │                      ├────────────────────▶│                    │
     │                      │                     │ 5. show QR at shop │
     │                      │                     ├───────────────────▶│
     │                      │                     │ 6. backend signer  │
     │                      │                     │    burns $PURPOSE, │
     │                      │                     │    pays USDC 1:1   │
     │                      │                     │◀───────────────────┤
```

## Status

- ✅ **V1** live on Base mainnet, funding flow active.
- 🛠 **V2 contracts** (PurposeTokenV2, BountyManagerV2, VendorRedemptionV2)
  finalized — pending mainnet redeploy. See `contracts/DEPLOYMENT.md`.
- 🛠 **On-chain governance** (1 active monthly membership NFT = 1 vote)
  pending deploy of the thirdweb Vote contract + `vPURPOSE` shadow token.
  Current in-app tally is the interim source of truth.
- ⏸ **Tax-deductibility** for donors paused pending federal clarity for
  on-chain charitable structures (e.g. the **CLARITY Act**).

## Stack

- **Frontend** — React 18, Vite, TypeScript, Tailwind, brutalist design system
- **Wallets** — thirdweb in-app smart wallets (email / Google / Apple /
  passkey, sponsored gas) for users; EOA (MetaMask / Coinbase / WalletConnect)
  for admins
- **Chain** — Base mainnet (chainId 8453), USDC-denominated treasury
- **Backend** — Lovable Cloud: Postgres + RLS, edge functions, storage, auth
- **Settlement** — server-side signer holds `SETTLEMENT_ROLE`; vendors and
  champions never broadcast their own transactions

## Open source

Licensed under **[AGPL-3.0](./LICENSE)**. Forks must stay open. The brand
("Proof of Purpose", `$PURPOSE` wordmark, visual identity in `src/assets/`)
is reserved — please rebrand before launching.

If you want to run this protocol in your city, start with
**[`FORKING.md`](./FORKING.md)** — the full deploy takes about a day on
testnet and another half-day on mainnet.

## Contracts

Live addresses live in [`src/config/contracts.ts`](./src/config/contracts.ts).
Full deploy guide in [`contracts/DEPLOYMENT.md`](./contracts/DEPLOYMENT.md).

## Contact

- General: admin@popmgm.org

