
## Goal

Make catalyst and vendor onboarding mirror the champion flow:

```text
sign up → smart wallet (auto) → /onboarding role pick → /apply/{role} → role dashboard (locked, "pending approval") → admin approves → role dashboard fully active
```

Today the sign-in + smart-wallet + role pick steps already exist (Login → Onboarding). The gaps:

1. After submitting an application, users get bounced back to `/dashboard` and have nowhere to land — the role dashboards block anyone without the granted role.
2. There's no "pending approval" state on the vendor or catalyst dashboard.
3. `Dashboard.tsx` doesn't know about pending vendor/catalyst applications, so it sends them to `/onboarding` again.

## Changes

### 1. `src/hooks/useApplicationStatus.ts` (new)
Tiny hook that returns `{ vendor: 'none'|'pending'|'approved', catalyst: 'none'|'pending'|'approved' }` for the current user, derived from `vendors` and `catalyst_orgs` rows (matched by `user_id` for catalyst; for vendors, by `wallet_address` of the active account, since `vendors` has no `user_id`).

Note: `vendors` table has no `user_id` column. We'll match by the connected smart-wallet address, which is what the apply form already writes. (Long-term we should add `vendors.user_id`, but not required for this change.)

### 2. `src/pages/ApplyVendor.tsx` & `src/pages/ApplyCatalyst.tsx`
- After successful submit, redirect to `/vendor` (or `/catalyst`) instead of `/dashboard`.
- Keep the existing wallet/auth guards.

### 3. `src/pages/VendorDashboard.tsx`
- Replace the strict `roles.includes("vendor")` redirect with: allow access if either `roles.includes("vendor")` OR a `vendors` row exists for the connected wallet.
- If the row exists but `approved === false` (or no role yet), render a **locked state**:
  - Same page shell (header, branding) so they recognize it as their dashboard.
  - Big "PENDING APPROVAL" card explaining the team is reviewing their application; show submitted business name.
  - Disable the "SCAN CHAMPION QR" button (greyed, with tooltip "Available once approved").
- Approved vendors get the existing terminal UI.

### 4. `src/pages/CatalystDashboard.tsx`
- Same pattern: allow access if a `catalyst_orgs` row exists for `user_id`.
- Locked state: show org name + "Awaiting admin approval. You can't propose bounties yet." Disable the NEW DRAFT form (inputs + button).
- Approved catalysts get the full draft form.

### 5. `src/pages/Dashboard.tsx` routing
After loading roles, also peek at `vendors`/`catalyst_orgs` for the signed-in user:
- pending vendor row → `navigate('/vendor')`
- pending catalyst row → `navigate('/catalyst')`
This way a returning pending applicant lands on their role dashboard, not `/onboarding`.

### 6. Onboarding copy (`src/pages/Onboarding.tsx`)
Minor: tweak the vendor/catalyst card descriptions to set expectations ("Apply → review → unlock dashboard").

## Out of scope
- No DB schema changes. (We can add `vendors.user_id` later for cleaner ownership.)
- No changes to admin approval flow — `AdminVendors` and `AdminCatalysts` already grant the role on approval, which auto-unlocks the dashboard on next load.
- No changes to the V2 contract work in `contracts/`.

## Files touched
- new: `src/hooks/useApplicationStatus.ts`
- edit: `src/pages/ApplyVendor.tsx`
- edit: `src/pages/ApplyCatalyst.tsx`
- edit: `src/pages/VendorDashboard.tsx`
- edit: `src/pages/CatalystDashboard.tsx`
- edit: `src/pages/Dashboard.tsx`
- edit: `src/pages/Onboarding.tsx` (copy only)
