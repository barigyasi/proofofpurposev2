## Fix Vercel SPA 404s + Wallet Login Errors

### Problem
- `proofofpurpose2.vercel.app` serves Vercel's 404 page on any route refresh or deep link (e.g. `/dashboard`, `/admin`).
- Possible 2xx error during MetaMask wallet login on Vercel due to missing `VITE_SUPABASE_*` env vars (`.env` is gitignored).

### Fix

1. **Add `vercel.json` at project root**
   - Add a catch-all rewrite rule so every non-asset path serves `index.html`.
   - This lets React Router handle routing instead of Vercel looking for files.

2. **Audit Vercel environment variables**
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured in the Vercel dashboard.
   - If missing, the wallet-auth flow and Supabase client will fail silently on the deployed build.

### File change
- `vercel.json` (new)

### Expected result
- Refreshing `/dashboard`, `/admin`, `/login`, etc. on the Vercel domain stays in-app.
- Wallet login completes without 2xx / silent failure.