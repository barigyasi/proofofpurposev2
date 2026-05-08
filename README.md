# Proof of Purpose

A wallet-primary, on-chain youth impact protocol on **Base**.

Donors fund a transparent USDC treasury. Trusted partner orgs (**Catalysts**)
propose bounties. Youth (**Champions**) complete them and earn `$PURPOSE` —
a soulbound community credit redeemable only at approved local **Vendors**
at 1:1 USDC.

📖 **[Read the full whitepaper →](https://docs.popmgm.org)** &nbsp;·&nbsp;
🛠 **[Fork it for your city →](./FORKING.md)** &nbsp;·&nbsp;
🔐 **[Security policy →](./SECURITY.md)**

---

## Status

Tax-deductibility for donors is on hold pending federal clarity for on-chain
charitable structures (e.g. the **CLARITY Act**). Until then, donations are
not represented as tax-deductible.

The V2 contracts (PurposeTokenV2, BountyManagerV2, VendorRedemptionV2) are
finalized but not yet deployed to Base mainnet — see
`contracts/DEPLOYMENT.md` for the deploy order.

## Stack

- React 18 · Vite · TypeScript · Tailwind
- Base mainnet (chainId 8453)
- thirdweb (smart wallets + contract reads/writes)
- Lovable Cloud (Postgres + Edge Functions + Storage + Auth)

## Contracts (Base 8453)

See `src/config/contracts.ts` for live addresses, and
`contracts/DEPLOYMENT.md` for the full deploy guide.

## Open source

Proof of Purpose is licensed under **AGPL-3.0** — see [`LICENSE`](./LICENSE).

If you'd like to run the same protocol in your own city, start with
[`FORKING.md`](./FORKING.md). Pull requests welcome — see
[`CONTRIBUTING.md`](./CONTRIBUTING.md).
