# Contributing

Thanks for considering a contribution to Proof of Purpose.

## Ground rules

- This project is **AGPL-3.0**. By submitting a PR, you agree your
  contribution is licensed under the same terms.
- Be kind. Our Code of Conduct lives at `/about/whitepaper#conduct`.
- Security issues → `SECURITY.md`, **never** a public issue.

## Local setup

```bash
bun install
bun run dev
```

You'll need a Lovable Cloud project (or your own Supabase) for the backend
to function. See `FORKING.md` for the full deploy.

## Branching & PRs

- Branch from `main`.
- Keep PRs small and focused. One logical change per PR.
- Include a short description of **what** changed and **why**.
- If you change the contracts, update `contracts/DEPLOYMENT.md`.
- If you change the schema, include the migration in `supabase/migrations/`.

## Code style

- TypeScript everywhere. No `any` unless you justify it in a comment.
- Use **semantic design tokens** from `src/index.css` and
  `tailwind.config.ts`. Never hardcode colors in components.
- Match existing patterns — look at neighboring files before inventing
  new structure.
- Don't introduce a new dependency without discussion.

## Tests

```bash
bunx vitest run
```

If you add business logic, add a test.

## Out of scope for upstream

We won't accept PRs that:

- Change the brand name, wordmark, or logos.
- Re-add references to "MetaPhysical LLC" or "first on-chain nonprofit".
- Hardcode city-specific copy into shared components (fork it instead).
- Remove RLS policies or weaken role checks.
- Add transfer/approve UI for `$PURPOSE` (it's soulbound by policy).

Forking for your own city? `FORKING.md` is the right doc — go wild there.
