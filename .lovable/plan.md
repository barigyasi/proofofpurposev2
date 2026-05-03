## Bounty lifecycle: signup → start → check-in → complete

Restructure the bounty flow so that on-chain `addParticipant` only fires when a champion physically checks in at the event via QR scan, and `completeBounty` mints rewards to everyone who checked in.

### New lifecycle states (`bounties.status`)

```text
open       → champions can sign up (DB only)
running    → admin started the event; check-in QR is live
completed  → admin ended the event; on-chain rewards minted
```

`bounty_signups.status`:
```text
pending    → signed up, not yet checked in
checked_in → scanned QR + addParticipant tx confirmed on-chain
no_show    → event ended without check-in
```

### Schema changes (migration)

- `bounties`: add `min_participants int default 1`, `started_at timestamptz`, `completed_at timestamptz`, `check_in_token text` (random opaque token used in QR), `check_in_token_expires_at timestamptz`
- `bounty_signups`: rename column meaning — keep `added_tx_hash`/`added_at` for the on-chain tx, add `checked_in_at timestamptz`. Status enum widens to include `checked_in`, `no_show`.

### Admin UI (`AdminBounties.tsx`)

For each open bounty:
- Show pending signup count vs `min_participants`
- "START EVENT" button — enabled only when count ≥ min. Generates `check_in_token`, sets status `running` and `started_at`. Shows a big QR linking to `/checkin/<bountyId>?t=<token>` for projection at the event entrance.
- For `running` bounties: live list of who has checked in (addParticipant confirmed) vs still pending. Manual "ADD ON-CHAIN" still available as fallback.
- "END EVENT" button — calls `completeBounty(onChainId)`, marks bounty `completed`, marks remaining pending signups `no_show`. Mints PURPOSE to checked-in participants (the contract handles distribution on completeBounty).

### Champion UI

- Available bounties: only `open` ones they haven't signed up for.
- Active bounties (signed up, status `running`): big "SHOW MY CHECK-IN CODE" button that opens a personal QR encoding `{bountyId, walletAddress, signupId}`. The admin scans this at the event.
- After check-in: card shows "✓ CHECKED IN — reward pending event close".
- After completion: shows reward amount earned.

### Check-in flow (two compatible paths)

**Path A — admin scans champion's personal QR (preferred):**
1. Admin opens `/admin/bounties/<id>/scan` (camera scanner)
2. Scans champion's QR → posts `{signupId, walletAddress}` to edge function `bounty-checkin`
3. Edge function verifies admin role, verifies signup exists + status `pending` + bounty `running`, then calls `addParticipant` on-chain using `BOUNTY_ADMIN_PRIVATE_KEY`, updates row → status `checked_in`, `added_tx_hash`, `checked_in_at`.

**Path B — champion scans event QR:**
1. Event QR encodes `/checkin/<bountyId>?t=<token>`
2. Page reads token, looks up signup by `auth.uid()`, posts to same edge function with token instead of admin auth.
3. Edge function validates token + expiry, then same on-chain add.

Both paths funnel through one edge function so the on-chain write is centralized and gas is sponsored by the admin key.

### Edge function: `bounty-checkin`

Inputs: `{ bountyId: uuid, walletAddress: string, token?: string }`
- Auth: either admin role (via JWT) OR valid `check_in_token` matching the bounty
- Verify bounty status = `running` and not expired
- Verify signup exists and status = `pending`
- Call `addParticipant(onChainId, walletAddress)` using admin private key on Base
- Update `bounty_signups` row → `checked_in`, store tx hash + timestamp

### Files

**New:**
- `supabase/functions/bounty-checkin/index.ts` — gated on-chain check-in
- `src/pages/CheckIn.tsx` — champion-side QR landing page
- `src/pages/AdminBountyScan.tsx` — admin camera scanner
- `src/components/champion/MyCheckInQR.tsx` — personal QR for active bounty

**Modified:**
- migration: add columns to `bounties` and `bounty_signups`
- `useBountyAdmin.ts` — add `startEvent`, `endEvent`; update `completeBounty` to mark signups
- `AdminBounties.tsx` — new lifecycle controls, signup counts, link to scanner
- `ChampionDashboard.tsx` — surface check-in QR for `running` bounties; remove direct on-chain logic
- `useBounties.ts` — include new fields; expose signup count

### Dependencies

- QR generation already present (`RedeemQRDialog` uses it)
- QR scanning: add `html5-qrcode` or `@yudiel/react-qr-scanner` for camera input

### Out of scope (this pass)

- Geofencing the check-in (location verification)
- Multi-day events / repeat check-ins
- Bulk CSV import of attendance

Approve and I'll implement the migration, edge function, and UI changes together.