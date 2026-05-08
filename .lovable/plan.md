## Goal

Trim the existing `/about` page (remove "MetaPhysical LLC" attribution and "first on-chain nonprofit" claims) and add a deeper "Read the full whitepaper" link to a new in-depth page that adapts the content from docs.popmgm.org to this app's actual stack and terminology.

## Changes

### 1. Trim `src/pages/About.tsx`
- Remove the line attributing the build to MetaPhysical LLC and the "first nonprofit to operate end-to-end on-chain" sentence.
- Remove the bottom "© MetaPhysical LLC" footer line.
- Keep: headline, "// an on-chain nonprofit" tag, the high-level paragraph, the tax-deductibility note, the "How it works" 4-step list, and the contracts list.
- Add a prominent CTA link near the top (under the intro paragraphs) and at the bottom: **READ THE FULL WHITEPAPER →** linking to `/about/whitepaper`.

### 2. New page `src/pages/Whitepaper.tsx` at route `/about/whitepaper`
Long-form, brutalist-styled (matches existing About: `font-display` headers, `font-mono` micro-labels, `border-y-2 border-foreground` section dividers, semantic tokens only). Single H1, semantic HTML, sticky in-page TOC on desktop.

Sections (adapted from docs.popmgm.org, **rewritten to match this app's real stack and terminology** — no Firebase, no Next.js, no Mantine; Catalysts are partner orgs, Admins are protocol admins):

1. **Executive Summary** — Champions earn rewards for community tasks, on Base, four roles.
2. **Roles** — Champions, Catalysts (partner orgs / "Admins" in the docs), Vendors, Donors. Plus protocol Admins.
3. **System Architecture** — React 18 + Vite + TypeScript + Tailwind, thirdweb smart wallets (gasless, email/Google/Apple/passkey), Base mainnet contracts, Lovable Cloud (Postgres + Edge Functions + Storage + Auth) — replacing the docs' Next.js/Firebase mentions.
4. **Smart Contract Infrastructure** — $PURPOSE token (soulbound community credit, V2), Treasury, Donation Split (90% treasury / 8% admin multisig / 2% founder), VendorRedemption, BountyManager, emergency pause/freeze. Link each to Basescan via `CONTRACTS`.
5. **Functionality & Logic** — Onboarding flow, bounty lifecycle, redemption flow (backend signer settles via `redeemFor`), donations (USDC via thirdweb).
6. **Tokenomics** — Soulbound, 1 $PURPOSE = 1 USDC of verified impact, funding model.
7. **Governance** — 1 active monthly membership NFT = 1 vote (vPURPOSE shadow token + thirdweb Vote contract; current Supabase tally is interim).
8. **Security** — role-based access, RLS, audit logs, contract pausability, redemption settlement model.
9. **Getting Started by Role** — Champions (with guardian-consent note for under-18), Catalysts, Vendors, Donors. Each links to the relevant `/apply/*` or `/donate` page.
10. **Code of Conduct & Program Rules** — general / Catalyst (rename from "Admin") / Champion / Vendor.
11. **Audit & Oversight** — enforcement table (1st/2nd/3rd offense).
12. **Roadmap** — multi-city expansion, DAO governance cutover, mobile, vendor self-onboarding, public analytics.
13. **Footer link** — "Canonical docs: docs.popmgm.org" (external).

### 3. Wire route
- Register `/about/whitepaper` → `Whitepaper` in `src/App.tsx`.

### 4. SEO
- `<title>` ~"Whitepaper · Proof of Purpose" (<60 chars)
- `<meta name="description">` ~155 chars summarizing the whitepaper
- Single H1, semantic `<section>` and `<h2>` headings, `id` anchors for TOC links, internal links to existing app routes.

## Out of scope
- No business-logic or contract changes.
- No content changes to `docs.popmgm.org` itself.
- No new dependencies.
