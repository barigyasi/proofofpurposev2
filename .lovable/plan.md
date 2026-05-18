
# Donor/Catalyst Blog — Plan

## What we're building

A members-only blog inside the app. Donors and Catalysts (and admins) can read; admins and catalysts can write, with admin approval required before anything goes live. Posts are organized by category + tags, with one featured post pinned at the top of the index. Fast on mobile, easy on the eyes.

## User-facing surfaces

**`/stories`** — Blog index (gated to donor/catalyst/admin)
- Hero featured post card (full-width on mobile, 2-col split on desktop)
- Category chips (All · Champion Stories · Bounty Recaps · Updates · …)
- Search bar + tag filter
- Responsive grid of post cards (1 col mobile, 2 col tablet, 3 col desktop)
- Infinite scroll / "load more"

**`/stories/:slug`** — Article page
- Cover image, category chip, title, author (display name + avatar), publish date, est. read time
- Long-form body (markdown rendered with Tailwind Typography `prose`)
- Sticky share bar on mobile, floating ToC on desktop
- "More like this" — 3 related posts by category at the bottom

**`/stories/submit`** — Catalyst submission form (gated to catalyst/admin)
- Title, category, tags, cover image upload, markdown body editor with live split preview
- Save draft / Submit for review
- "My submissions" list with status badges (draft / pending / approved / rejected) + admin feedback note

**`/admin/blog`** — Admin authoring + moderation
- Tabs: **All posts**, **Pending review**, **Drafts**, **Published**
- Inline create/edit (same editor as catalysts, plus: publish, schedule, set as featured, edit slug)
- Review queue: preview submission → Approve & publish / Request changes (with note) / Reject
- Toggle a post's "featured" flag (only one featured at a time)

**Header nav** (donor + catalyst views): add **STORIES** between Bulletin and About.

## Design language

Stays on the brutalist system already in `index.css` / `tailwind.config.ts` — semantic tokens only:
- Card surfaces use `bg-card` + `border-2 border-foreground` (the existing `.brutal` utility)
- Featured card uses `bg-primary text-primary-foreground` for the acid-yellow pop
- Category chips: `border border-foreground px-2 py-1 font-mono text-xs uppercase tracking-widest`
- Headings: existing `font-display`; body uses Tailwind `prose prose-invert` with overrides to match
- Mobile-first: 16px base, comfortable line-height, max-width ~68ch for the article body
- Snappy load: cover images go through Supabase Storage with `?width=` transforms, `loading="lazy"`, and a skeleton placeholder; route is code-split so the editor only loads when authoring

No new fonts, no new color tokens — just compose what we have.

## Authoring + media

- **Editor**: lightweight markdown textarea with split-pane live preview using `react-markdown` + `remark-gfm`. Sanitized via `rehype-sanitize` so user-submitted HTML can never inject scripts.
- **Cover images**: new public storage bucket `blog-covers`; uploads scoped to `userId/filename` so RLS lets owners overwrite their own; admins can upload anywhere.
- **Inline images**: same bucket, inserted as markdown.
- **Slugs**: auto-generated from title (kebab-case + 6-char hash), editable by admins.

## Notifications

- When a catalyst submits → admins get a row in their existing notifications and an email via `admin-notify` (reuse the function, add a `kind: 'blog_submission'`).
- When an admin approves/rejects → submitter gets an email via a new `blog-decision` edge function (uses existing Resend secret).

## Technical details

### Database (new migration)

Two enums:
- `blog_post_status` = `draft | pending | approved | rejected | published | archived`
- `blog_category` = `champion_story | bounty_recap | update | announcement | feature` (admin can add more later via UI, but keeping it enum-locked for v1 gives nice filters)

Tables:
- **`blog_posts`** — id, slug (unique), title, excerpt, cover_url, body_md, category, tags (text[]), status, is_featured, author_id, published_at, review_note, scheduled_for, created_at, updated_at, read_time_minutes (computed in app or trigger)
- **`blog_post_views`** — id, post_id, viewer_id (nullable), viewed_at — for "popular this week" later; insertable by anyone signed in

RLS:
- SELECT on `blog_posts`: `status = 'published'` AND viewer has role donor/catalyst/admin (via `has_any_role`); authors can always see their own posts.
- INSERT: author must be catalyst or admin, `author_id = auth.uid()`, status forced to `draft` or `pending` (admins can insert `published`).
- UPDATE: authors can edit own posts while status in (`draft`,`pending`,`rejected`); admins can update anything.
- DELETE: author own + admin.
- Trigger `tg_blog_posts_protect_cols` (SECURITY DEFINER, EXECUTE revoked from anon/auth) prevents non-admins from changing `status`, `is_featured`, `published_at`, `slug`, `review_note`. Mirrors the pattern already used by `tg_bounty_drafts_protect_cols`.
- Unique partial index: only one post can have `is_featured = true AND status = 'published'`.

Storage:
- Bucket `blog-covers` (public read). Owner-folder write/update/delete, admin override — same shape as the existing `bounty-images` policies.

### Frontend

- New routes wired in `src/App.tsx`, all wrapped in `AuthGuard` + a small `RoleGate` for donor/catalyst/admin.
- New pages: `src/pages/Stories.tsx`, `StoryDetail.tsx`, `StorySubmit.tsx`, `AdminBlog.tsx`.
- New components in `src/components/blog/`: `PostCard`, `FeaturedPostCard`, `CategoryChips`, `MarkdownEditor` (split-pane), `MarkdownView` (with sanitization + prose styles), `SubmissionStatusBadge`, `CoverUploader` (reuses pattern from `DraftMediaUploader`).
- New hooks: `useBlogPosts` (filtered list w/ pagination), `useBlogPost(slug)`, `useMyBlogSubmissions`, `usePendingBlogReviews`.
- Markdown deps: `react-markdown`, `remark-gfm`, `rehype-sanitize`, `@tailwindcss/typography` (plugin add).
- Code-split: lazy-import the editor + markdown renderer so the article page itself stays tiny.

### Edge functions

- New `blog-decision` — sends approve/reject email to the submitter via Resend.
- Extend `admin-notify` with `kind: 'blog_submission'` payload.

### SEO

Since reading is gated, posts aren't indexed. We still set proper `<title>`/`<meta description>` via the existing `Seo` component for nice link previews when donors share to each other.

## Out of scope (v1)

- Comments / reactions
- Public sharing pages
- Linking posts to specific champions/bounties (you chose freeform)
- Rich-text WYSIWYG (markdown only)
- Multi-language

Easy to bolt on later without schema changes.
