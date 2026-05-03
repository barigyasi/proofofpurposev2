
# Proof of Purpose — Phase 1 Bootstrap

Set up the foundation of popmgm.org per the uploaded spec. Phase 1 only — no app pages yet. We stop after wallet login + admin allowlist works end-to-end.

## Scope (Phase 1)

1. **Lovable Cloud** enabled.
2. **Database schema** — full migration from `SCHEMA.md`:
   - `app_role` enum + `user_roles` + `has_role` / `has_any_role` SECURITY DEFINER functions
   - `profiles`, `wallet_auth_nonces`, `pending_applicants`
   - `vendors`, `bounties`, `bounty_rewards`, `vendor_redemptions`, `donations`
   - `bulletin_posts`, `bulletin_comments`, `proposals`, `votes`
   - RLS policies (public read where transparency requires, admin-write via `has_role`)
   - `tg_set_updated_at` trigger
   - Storage buckets: `vendor-documents` (private), `avatars` (public), `bounty-images` (public)
3. **Contracts config** — `src/config/contracts.ts` with all Base mainnet addresses (PURPOSE, BountyManager, VendorRedemption, Treasury, USDC, Donation Split). ABIs folder `src/contracts/abis/` seeded with the minimal ERC20 ABI; placeholders for `PurposeToken.json`, `BountyManager.json`, `VendorRedemptionManager.json` to be pasted in.
4. **thirdweb client** — `src/lib/thirdweb.ts` with v5 client, Base chain, in-app wallet (email + Google + Apple + passkey + external wallet), smart accounts on Base with sponsored gas. `ThirdwebProvider` wired into `App.tsx`.
5. **Edge functions** (all `verify_jwt = false`, validated in code):
   - `wallet-auth-nonce` — issues SIWE-style nonce, stored in `wallet_auth_nonces` (5 min expiry)
   - `wallet-auth` — verifies signature with `viem` (EOAs + ERC-1271 smart accounts), upserts user `{wallet}@wallet.local` with deterministic password derived from service role key, upserts `profiles` row, returns Supabase session, fires `grant-admin`
   - `grant-admin` — idempotent allowlist: `0xa5a484Af10FF67257A06DDbf8DdE6A99a483f098` and `gyasi.eth` (resolved via mainnet RPC, cached); inserts admin role on conflict do nothing
6. **Frontend primitives**:
   - `<ConnectWalletButton />` — drives the nonce → sign → wallet-auth flow and stores Supabase session
   - `<RoleGuard role="admin">` (and array variant) — calls `has_role` RPC
   - `/login` page with the connect button + a tiny status panel (wallet, supabase session, roles) so we can verify end-to-end
7. **Brand tokens** in `index.css` + `tailwind.config.ts`:
   - Background `hsl(220 70% 12%)` deep navy
   - Accent `hsl(43 96% 56%)` gold
   - Semantic tokens only — no inline colors. Update `Index` to a minimal landing placeholder using the new tokens.

## Out of scope (later phases)

- Public pages (Home, About, How It Works, Vendors, Donate, Transparency)
- Champion / Vendor / Donor dashboards
- Admin pages (applicants, bounties, vendors, audit)
- `record-donation`, Coinbase Commerce, CDP Onramp edge functions
- QR scanner / redemption flow

## Things you'll need to provide after approval

- ABI JSON for `PurposeToken`, `BountyManager`, `VendorRedemptionManager` (paste into chat or upload)
- thirdweb client ID (default to the existing `0f6689ee21b2280f8ec05ad7986716e2` unless you say otherwise)

## Tech notes

- Roles strictly in `user_roles`; never on `profiles`. RLS uses `has_role(auth.uid(), 'admin')`.
- Wallet password derivation uses HMAC over `SUPABASE_SERVICE_ROLE_KEY + walletAddress` — wallet address is never the password.
- Admin allowlist resolves `gyasi.eth` once per cold start via public mainnet RPC; resolution failure is non-fatal.
- `wallet_auth_nonces` has RLS enabled with no policies — service role only.
- No client-side admin checks; every gate goes through `has_role` RPC under the user's session.

## Acceptance check (Phase 1 done)

- Visit `/login`, connect with email or external wallet → Supabase session created
- `profiles` row exists with the wallet address
- If wallet matches allowlist (or resolves to `gyasi.eth`), `user_roles` has an `admin` row
- `<RoleGuard role="admin">` renders gated content for that wallet only
