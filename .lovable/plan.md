# Waitlist Mode for Landing Page

Temporarily replace the three CTA buttons on the home page with a "Join the Waitlist" flow that captures name, city, and email into a new `waitlist_signups` table. Existing buttons stay in code (commented/flagged) so we can flip them back on later when v2 contracts ship.

## 1. Database

New table `public.waitlist_signups`:

- `id` uuid PK default `gen_random_uuid()`
- `name` text not null
- `city` text not null
- `email` text not null
- `created_at` timestamptz not null default `now()`
- unique index on `lower(email)` to prevent dupes

RLS:
- Enable RLS
- `waitlist_insert_anyone` — INSERT, `with check (true)` (public signup, like `donations_insert_anyone`)
- `waitlist_admin_select` — SELECT, `using (has_role(auth.uid(), 'admin'))` (only admins read the list; emails are PII)
- No update/delete policies (admins still get full access via the standard admin pattern if needed — we'll add an admin-only ALL policy too)

## 2. Landing page (`src/pages/Index.tsx`)

Replace the third `<section>` (the GET STARTED / DONATE / PARTNER WITH US buttons) with a `<WaitlistForm />` component. Leave the old buttons in the file inside an `{/* WAITLIST MODE: hide CTAs until v2 launch — restore this block to re-enable */}` comment block so flipping back is a 30-second edit.

Above the form, a short headline like:

```
JOIN THE WAITLIST
Be first in line when Proof of Purpose opens to donors,
champions, and vendors. v2 launching soon.
```

## 3. New component `src/components/WaitlistForm.tsx`

- Brutalist styling matching existing `brutal` / `brutal-primary` classes
- Three inputs: Name, City, Email (all required)
- Zod validation client-side:
  - name: trimmed, 1–100 chars
  - city: trimmed, 1–100 chars
  - email: valid email, ≤255 chars
- On submit: insert into `waitlist_signups` via supabase client
- Handle unique-violation (code `23505`) with a friendly "You're already on the list ✓" toast
- Success state: replace form with a "YOU'RE ON THE LIST" confirmation block
- Uses existing `useToast`, `Input`, `Button`, `Label`

## 4. Header

No change. The `ENTER` button stays so existing users (admins, testers) can still log in.

## Out of scope / preserved

- All routes in `App.tsx` stay registered (`/donate`, `/login`, `/onboarding`, etc.)
- No nav changes
- No admin UI for viewing the waitlist yet — admins can read the table directly via the backend if needed; we can add a simple `/admin/waitlist` page later if you want

## Re-enabling later

When ready: open `src/pages/Index.tsx`, swap the `<WaitlistForm />` back for the commented-out CTA section. The waitlist table and component can stay (useful for future launches).
