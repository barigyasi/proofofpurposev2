## Goal
Hide the "admin entry" toggle from the public `/login` page and route admin sign-in entirely through a hidden footer trigger. Allowlist gating stays exactly as-is.

## Changes

### 1. New `AdminEntryDialog` component
- File: `src/components/auth/AdminEntryDialog.tsx`
- A shadcn `Dialog` wrapping `<ConnectWalletButton mode="admin" />` plus the same copy that's on Login today ("Connect your admin wallet…").
- Closes itself on successful session; the existing post-auth allowlist check in `ConnectWalletButton` / `wallet-auth` edge function continues to gate which wallets actually become admin.

### 2. Footer with hidden trigger
- File: `src/components/layout/Footer.tsx` (new), rendered globally in `App.tsx` after `<Routes>`.
- Visible content: a thin `// popmgm.org · base mainnet · v0.1` line, semantic-token styled, low contrast.
- The middle `·` is wrapped in a `<button>` with `aria-label="."`, no visible affordance (same color as siblings, no hover, no cursor change).
- Click handler: 3 clicks within 1.5s → opens `AdminEntryDialog`. Counter resets on timeout.
- Works on every page since the footer is global.

### 3. Strip admin toggle from `/login`
- Remove the `adminMode` state, the toggle button, and the conditional copy.
- Page only renders the standard smart-wallet `ConnectWalletButton` (default mode).
- No route changes — `/login` still exists for normal users (currently disabled anyway via waitlist mode in the header).

### 4. No allowlist changes
- Admin allowlist enforcement stays in the existing `wallet-auth` edge function and `AdminGuard`. We're only changing how the connect UI is reached.

## Files touched
- `src/components/auth/AdminEntryDialog.tsx` *(new)*
- `src/components/layout/Footer.tsx` *(new)*
- `src/App.tsx` — mount `<Footer />` once.
- `src/pages/Login.tsx` — remove admin toggle.

## Out of scope (per your message)
- No `WaitlistGate`, no header nav changes, no `/login` deletion, no opening signups.
