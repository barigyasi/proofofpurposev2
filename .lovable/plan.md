# SEO Pass Plan

## Goal
Make the site fully crawlable, indexable, and shareable with proper titles, descriptions, sitemaps, canonical URLs, and structured data — all in the brutalist near-black + acid-yellow brand.

## What we'll do

### 1. Sitewide foundation (index.html)
- Add `<link rel="canonical" href="/" />`
- Add JSON-LD Organization schema so search engines understand the brand
- Add `og:locale`, `og:site_name` meta tags

### 2. Generate a brutalist OG share image
- Create a 1200×630 PNG: black background, acid-yellow "PROOF OF PURPOSE" in Archivo Black, thick 2px borders, mono tagline — matches the in-app brutalist look
- Update `og:image` and `twitter:image` in `index.html` (currently pointing at the tiny favicon)
- This is what Twitter/LinkedIn/Facebook show when someone pastes the link

### 3. Sitemap
- Create `scripts/generate-sitemap.ts` that lists every public, indexable route
- Wire `predev` and `prebuild` scripts in `package.json` so the sitemap regenerates on every build
- Output to `public/sitemap.xml`
- **Routes included:** `/`, `/about`, `/about/whitepaper`, `/donate`, `/vendors`, `/governance`, `/governance/past`
- **Routes excluded:** `/login`, `/dashboard`, `/onboarding`, `/catalyst`, `/vendor`, `/apply/*`, `/admin/*`, `/receipts/*`, `/bulletin`, `*` — auth-gated, admin-only, or dynamic; should not be indexed

### 4. Per-page SEO with react-helmet-async
- Install `react-helmet-async`
- Wrap the app in `<HelmetProvider>` in `src/main.tsx`
- Add `<Helmet>` blocks to every public page with unique:
  - `<title>` (under 60 chars with keyword)
  - `<meta name="description">` (under 160 chars)
  - `<link rel="canonical">`
  - `<meta property="og:title">`, `og:description`, `og:url`
  - JSON-LD `WebPage` per route; `Article` for the Whitepaper

**Page-by-page titles/descriptions:**

| Page | Title | Description |
|------|-------|-------------|
| `/` | Proof of Purpose — On-chain youth impact | Wallet-primary youth impact on Base. Donors fund. Champions earn PURPOSE. Vendors redeem. |
| `/about` | About — Proof of Purpose | An on-chain nonprofit rewarding youth for real-world community work. Learn how it works. |
| `/about/whitepaper` | Whitepaper — Proof of Purpose | Full protocol documentation: smart contracts, tokenomics, governance, and how to participate. |
| `/donate` | Donate — Proof of Purpose | Fund the mission in USDC on Base. No account needed. Transparent on-chain receipts. |
| `/vendors` | Vendors — Proof of Purpose | Approved local businesses where Champions can spend $PURPOSE tokens. |
| `/governance` | Governance — Proof of Purpose | Vote on bounty proposals. 1 membership = 1 vote. Transparent DAO governance on Base. |
| `/governance/past` | Past Proposals — Proof of Purpose | Archive of closed bounty proposals. See what passed, failed, and made an impact. |

### 5. robots.txt update
- Add `Sitemap: /sitemap.xml` directive so crawlers discover it automatically
- Keep existing `Allow: /` blocks

### 6. Remove the Whitepaper useEffect head hack
- The Whitepaper page currently mutates `document.title` and meta description via `useEffect`
- Replace with `<Helmet>` once `react-helmet-async` is in place

## Technical details
- **Library:** `react-helmet-async` (lightweight, React 18 compatible)
- **Canonicals:** relative paths (`href="/about"` etc.) since no custom domain is set yet
- **JSON-LD types:** `Organization` in `index.html`, `WebPage` per route via Helmet, `Article` for Whitepaper
- **No functional changes:** no edits to auth, admin, dashboards, or business logic — purely metadata and one OG image asset

## Out of scope (later)
- Per-receipt SEO (`/receipts/:tokenId`) — needs SSR/pre-rendering since social crawlers don't run JS for dynamic OG tags
- Per-bounty/proposal SEO — same limitation