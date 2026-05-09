## Goal

Three changes:
1. Catalyst bounty drafts → support video, multiple images, and slide deck (PPT/PDF) uploads to explain the mission.
2. **Friendly rejection** when a non-admin signs in via the **ADMIN ENTER** flow.
3. **Harden every `/admin/*` page** so non-admins are bounced (currently only `/admin` checks).

---

## 1. Catalyst bounty media uploads

### Storage
- Reuse existing public `bounty-images` bucket for images.
- Add new buckets via migration:
  - `bounty-videos` (public, 100 MB cap, mime `video/*`)
  - `bounty-decks` (public, 25 MB cap, mime `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.ms-powerpoint`)
- RLS on `storage.objects` for both new buckets:
  - Public read.
  - Authenticated insert/update/delete only when the first folder segment equals the user's `auth.uid()` (same pattern used elsewhere).

### Schema (one migration)
Add to `bounty_drafts`:
- `image_urls text[] not null default '{}'`
- `video_url text`
- `deck_url text`
- `deck_filename text` (so we can show "mission.pptx" instead of a hash)

### UI — `CatalystDashboard.tsx` (NEW DRAFT card)
Add three uploader rows under Description, before Reward/Max:
- **Mission images** — multi-file picker (max 6, ≤ 5 MB each, image/*). Thumbnails with remove buttons. Stored under `${userId}/drafts/${draftTempId}/img-N.ext`.
- **Mission video** — single file (≤ 100 MB, video/*). Inline `<video>` preview after upload.
- **Slide deck** — single PPT/PPTX/PDF (≤ 25 MB). Show filename + size + remove.

Upload happens client-side via `supabase.storage.from(...).upload(...)`. URLs collected before insert. Show per-file progress and a clear error toast on size/type rejection (validated client-side with zod).

### UI — display
- `CatalystDashboard` "YOUR DRAFTS" list: small media badges (📷 N · 🎞️ · 📊) when present.
- `Governance` proposal card: render thumbnails strip, embedded `<video controls>`, and a "VIEW SLIDE DECK ↗" link so voters see the catalyst's pitch.
- `AdminBounties` review row: same media block so admins can audit before promoting.

---

## 2. Friendly rejection on ADMIN ENTER

Edit `src/components/auth/ConnectWalletButton.tsx`:
- After `setSession(...)` succeeds, if `mode === "admin"`:
  - Call `supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle()`.
  - If no admin row: `await fullDisconnect()` (which already signs out + disconnects wallet) and `toast.error("This wallet isn't on the admin allowlist. Use standard ENTER instead.")`. Do not redirect — they remain on `/login` with the toggle still in admin mode so they can flip back.
- If admin row present: continue normally, and let `Login.tsx` redirect — but change `Login.tsx` to send admins to `/admin` and everyone else to `/dashboard`.

No backend change — `wallet-auth` already only grants admin to allowlisted addresses, so this is purely a client-side post-check.

---

## 3. Harden admin subpages

Create `src/components/auth/AdminGuard.tsx` — a wrapper that mirrors the existing `Admin.tsx` check:
```
const { session, roles, isLoading } = useSessionRoles();
if (isLoading) return null;
if (!session) → /login
if (!roles.includes("admin")) → /dashboard  +  toast.error("Admins only")
```
Renders `children` when authorized.

Wrap every `/admin/*` route in `src/App.tsx`:
```
<Route path="/admin" element={<AdminGuard><Admin/></AdminGuard>} />
…same for AdminBounties, AdminBountyScan, AdminApplicants, AdminCatalysts,
   AdminVendors, AdminDonations, AdminTreasury, AdminAudit, AdminWaitlist,
   AdminChampions
```
Remove the now-duplicate inline check from `Admin.tsx` to keep one source of truth.

Note: data is already protected by RLS via `has_role(auth.uid(),'admin')`, so this is defense-in-depth on the UI layer — no information leak risk, just a cleaner UX.

---

## Out of scope
- No new edge functions.
- No changes to bounty on-chain flow or governance contracts.
- No changes to vendor / champion / donor flows.
- No file-virus scanning (rely on Supabase storage MIME limits).

## Acceptance
- Catalyst can attach images + video + deck to a draft; they appear in their drafts list, in Governance proposals, and in admin review.
- Non-admin EOA hitting **ADMIN ENTER** sees a clear toast and is signed out, no redirect to dashboard.
- Manually navigating to any `/admin/*` URL as a non-admin redirects to `/dashboard` with a toast.
