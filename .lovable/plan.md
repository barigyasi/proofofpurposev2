## Add Waitlist view to Super Admin

Give admins a place to see everyone who has joined the waitlist.

### What gets built

1. **New page** `src/pages/AdminWaitlist.tsx`
   - Admin-gated (same pattern as `Admin.tsx`: redirect non-admins via `useSessionRoles`).
   - Fetches `waitlist_signups` ordered by `created_at desc` (RLS already allows admin SELECT).
   - Header with total count + "Export CSV" button (client-side download of name/city/email/created_at).
   - Brutalist table: Name · City · Email · Joined.
   - Empty state when no signups yet.

2. **Route** in `src/App.tsx`
   - `/admin/waitlist` → `<AdminWaitlist />`.

3. **Tile** on `src/pages/Admin.tsx`
   - Add `{ to: "/admin/waitlist", label: "WAITLIST", desc: "Pre-launch signups" }` to the `TILES` array.

### Out of scope

- No DB changes (table + RLS already exist).
- No delete/edit UI — read-only list + CSV export is enough for pre-launch.
- Header stays in waitlist mode (ENTER SOON); admins reach this via direct URL or by logging in through `/login` as today.