# Super Admin Role-View Switcher

Let admins preview the app exactly the way each role sees it, without losing their admin powers, via a dropdown in the header.

## How it works

- A new `RoleViewContext` stores a `viewAs` value (`admin | champion | vendor | catalyst | donor`), persisted in `sessionStorage`.
- The header shows a "VIEWING AS ▾" dropdown **only when the signed-in user has the `admin` role**.
- When an admin picks a view (e.g. "Champion"), every role-gated page treats them as that role and routes them to the matching dashboard.
- Switching back to "Admin" restores the normal admin experience.
- Non-admins never see the switcher and behavior is unchanged for them.

## UI

```text
[ PROOF OF PURPOSE ]   Vendors  Dashboard  Governance ...   [VIEWING AS: CHAMPION ▾]  [LOGOUT] [☀]
```

Dropdown options: Admin · Champion · Vendor · Catalyst · Donor.
A small gold pill ("PREVIEW MODE") shows under the header whenever `viewAs !== "admin"` so it's obvious the admin is impersonating a view.

## Pages affected

Each page already gates on `roles.includes(...)`. We replace those checks with a single `useEffectiveRoles()` hook that, for admins, returns roles based on `viewAs`:

- `viewAs="admin"` → real roles (admin keeps full access)
- `viewAs="champion"` → `["champion"]`
- `viewAs="vendor"` → `["vendor"]`
- `viewAs="catalyst"` → `["catalyst"]`
- `viewAs="donor"` → `[]` (donors have no role row; they just browse + donate)

Pages updated to use `useEffectiveRoles()` instead of `useSessionRoles()` for routing/visibility decisions:
`Dashboard`, `CatalystDashboard`, `VendorDashboard`, `Onboarding`, `Admin*` pages (they still require the *real* admin role to access — preview mode does not unlock admin pages for non-admins, but admins viewing as champion will be redirected from `/admin/*` to `/dashboard` so the preview feels real).

## Technical changes

1. **`src/context/RoleViewContext.tsx`** (new) — provider + `useRoleView()` hook, sessionStorage-backed.
2. **`src/hooks/useEffectiveRoles.ts`** (new) — wraps `useSessionRoles`; if real roles include `admin` and `viewAs !== "admin"`, returns the synthetic role array. Also exposes `isAdminPreview` and `realRoles`.
3. **`src/App.tsx`** — wrap routes with `<RoleViewProvider>`.
4. **`src/components/layout/Header.tsx`** — add a shadcn `Select` (or simple `<DropdownMenu>`) shown only when `realRoles.includes("admin")`. Changing the value navigates to the appropriate home (`/admin`, `/dashboard?as=champion`, `/vendor`, `/catalyst`, `/donate`). Show a "PREVIEW MODE" banner when `isAdminPreview`.
5. **Replace `useSessionRoles` with `useEffectiveRoles`** in: `Dashboard.tsx`, `CatalystDashboard.tsx`, `VendorDashboard.tsx`, `Onboarding.tsx`. Admin pages keep `useSessionRoles` for their hard gate but also read `viewAs` to redirect to `/dashboard` when an admin is previewing a non-admin role.
6. Champion preview path: `Dashboard.tsx` already supports `?as=champion`. In preview mode it will skip the "pending application" gate and render `<ChampionDashboard />` directly so the admin sees real UI.

## Out of scope

- No changes to RLS or any backend logic. Preview is purely a client-side UI affordance — the admin's actual permissions are unchanged on the server.
