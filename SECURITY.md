# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email: **admin@popmgm.org** (PGP key on request).

We aim to acknowledge within 48 hours and ship a fix or mitigation within 14
days for high-severity issues. Coordinated disclosure preferred.

## Scope

In scope:

- Smart contracts in `contracts/` and any contract this project deploys to Base.
- Edge functions in `supabase/functions/`.
- Postgres schema and RLS policies (migrations in `supabase/migrations/`).
- The web app in `src/`.

Out of scope:

- Findings that require a compromised admin EOA, compromised backend signer
  key, or physical access to a user's device.
- Social engineering of Catalysts, Vendors, or Champions.
- Denial-of-service that requires sustained, high-volume traffic against the
  hosted Lovable Cloud backend.

## What we treat as **not** a vulnerability (intentional design)

- The Supabase **anon / publishable key** in the repo and `src/integrations/supabase/client.ts`. It is a public token; access is gated by row-level security.
- Public `SELECT` access on tables that intentionally expose public data
  (e.g. open bounties, public donor wall, treasury totals).
- $PURPOSE balances being readable on-chain — the token is meant to be a
  publicly verifiable community credit.

## Secrets — never commit these

The following live only in Lovable Cloud (or your fork's equivalent secret
store) and **must never** appear in the repo, in client code, or in logs:

- `BOUNTY_ADMIN_PRIVATE_KEY`
- `REDEMPTION_SIGNER_PRIVATE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- thirdweb **secret** key (the publishable client ID is fine in code)
- OAuth client secrets (Google / Apple)
- Any wallet private key or mnemonic

If a secret is ever committed: rotate it immediately, then file a report.

## Hardening checklist for forks

Before going live in a new city, a fork **must**:

1. Replace every contract address in `src/config/contracts.ts` with addresses
   you deployed and control. Do not point a fork at our mainnet contracts.
2. Replace `ADMIN_ALLOWLIST` in `src/config/contracts.ts` with your own
   admin wallets.
3. Generate a fresh backend signer keypair for `REDEMPTION_SIGNER_PRIVATE_KEY`
   and `BOUNTY_ADMIN_PRIVATE_KEY` (never reuse ours).
4. Run the security scan in Lovable Cloud (or run `supabase db lint` on the
   migrations) and resolve every finding before opening signups.
5. Review every RLS policy against `mem://` and the schema in
   `supabase/migrations/` — especially `user_roles`, which must remain
   role-protected via the `has_role()` security-definer function.
