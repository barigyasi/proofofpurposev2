# Receipt Email Delivery (Resend)

Send a branded receipt email to both the **champion** and the **vendor** once a redemption settles, with the on-chain SVG rendered as a high-DPI PNG (inline + attached) and a PDF attachment for printing.

From: `receipts@popmgm.org` (verified directly in Resend; no Lovable email-domain delegation, so no DNS conflict).

## What gets built

### 1. New edge function: `receipt-email`
`supabase/functions/receipt-email/index.ts`

- Input: `{ tokenId, recipients?: ("champion"|"vendor")[] }` (defaults to both)
- Loads the receipt row from `receipts` table (champion email/name, vendor email/name, amount, tx hash, redeemed_at, tokenId)
- Reads on-chain `tokenURI(tokenId)` from `ReceiptNFT`, base64-decodes the JSON, extracts the SVG `image`
- Rasterizes SVG → PNG @ 2x (1200×1600) using `@resvg/resvg-wasm` (Deno-compatible WASM, no native deps)
- Generates a printable A4 PDF using `pdf-lib` (embeds the PNG)
- Sends via Resend REST API (`POST https://api.resend.com/emails`) with:
  - `from: "Purpose Receipts <receipts@popmgm.org>"`
  - HTML body (responsive, brand-styled — navy bg, gold accent, mobile-first table layout used by every email client)
  - Inline PNG (`cid:` reference) for in-body preview
  - Attachments: `receipt-<tokenId>.png` + `receipt-<tokenId>.pdf`
  - Plain-text fallback
- Logs delivery to a new `receipt_email_log` table (status, provider id, error)
- Idempotent: skips if already sent successfully to that recipient (unless `force: true`)

Uses the raw Resend API directly (not the gateway connector) since the user pasted a personal `RESEND_API_KEY`.

### 2. Auto-trigger after settlement
Edit `supabase/functions/vendor-redeem-settle/index.ts`:
- After receipt mint + DB write succeeds, fire-and-forget invoke of `receipt-email` for both recipients
- Wrapped in try/catch so email failure never blocks the settlement response

### 3. Manual retry from admin
Edit `src/components/admin/ReceiptOpsCard.tsx`:
- Add "Resend email" button per receipt row (champion / vendor / both)
- Calls `receipt-email` with `force: true`

### 4. Champion + vendor self-serve resend
- `src/components/champion/ChampionReceiptsStrip.tsx`: "Email me a copy" button on each receipt
- `src/components/vendor/VendorChargesHistory.tsx`: same button on settled rows

### 5. Database
New migration:
```text
receipt_email_log
  - receipt_token_id  bigint
  - recipient_kind    text  ('champion'|'vendor')
  - recipient_email   text
  - status            text  ('sent'|'failed')
  - resend_id         text
  - error             text
  - sent_at           timestamptz
RLS: admins full; champion sees rows where token belongs to them; vendor sees rows where token belongs to their vendor account
```

## Email design (responsive, all clients)

- Single 600px centered table (Outlook-safe), stacks on mobile via `<meta viewport>` + media query
- Header: gold "PURPOSE" wordmark on navy
- Hero: large PNG of the on-chain receipt (centered, max-width 100%)
- Details block: champion name, vendor name, amount in PURPOSE, USDC settled, date, tx hash (linked to Basescan)
- "View on-chain receipt" CTA → `/receipt/:tokenId` page
- Footer: short note that the NFT is soulbound + "View attachments to print"
- Dark-mode CSS hints (`@media (prefers-color-scheme: dark)`) so Apple Mail/Gmail iOS render the navy correctly
- Plain-text version included for spam-filter friendliness

## Technical details

**Dependencies (Deno via npm: specifiers, no install step):**
- `npm:@resvg/resvg-wasm@2.6.2` — SVG → PNG (works in Deno edge runtime)
- `npm:pdf-lib@1.17.1` — PNG → PDF
- Resend: plain `fetch` to `https://api.resend.com/emails` (no SDK needed)

**Secrets used:**
- `RESEND_API_KEY` (just added) ✓
- `CHAIN_RPC` (already configured for V2 functions)
- `RECEIPT_NFT_ADDRESS` (already in deployment env)

**Idempotency:** key = `${tokenId}:${recipientKind}`. The log table's status='sent' rows are checked before send.

**Performance:** WASM cold start ~400ms, render ~150ms, total send <2s per recipient.

## Out of scope (for this round)
- Receipt regeneration if SVG metadata changes (token is immutable, so not needed)
- Bulk re-send across all historical receipts (admin can trigger one-by-one)
- Vendor branding overrides (uses Purpose branding only)

## Files

**New:**
- `supabase/functions/receipt-email/index.ts`
- `supabase/migrations/<timestamp>_receipt_email_log.sql`

**Edited:**
- `supabase/functions/vendor-redeem-settle/index.ts` (auto-trigger)
- `src/components/admin/ReceiptOpsCard.tsx` (resend button)
- `src/components/champion/ChampionReceiptsStrip.tsx` (email-me button)
- `src/components/vendor/VendorChargesHistory.tsx` (email-me button)
- `contracts/DEPLOYMENT.md` (note `RESEND_API_KEY` requirement + `receipts@popmgm.org` verification step in Resend dashboard)
