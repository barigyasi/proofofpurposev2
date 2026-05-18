
-- Enums
CREATE TYPE public.blog_post_status AS ENUM (
  'draft','pending','approved','rejected','published','archived'
);
CREATE TYPE public.blog_category AS ENUM (
  'champion_story','bounty_recap','update','announcement','feature'
);

-- Posts table
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  cover_url text,
  body_md text NOT NULL DEFAULT '',
  category public.blog_category NOT NULL DEFAULT 'update',
  tags text[] NOT NULL DEFAULT '{}',
  status public.blog_post_status NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL,
  published_at timestamptz,
  scheduled_for timestamptz,
  review_note text,
  read_time_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blog_posts_status_published_idx
  ON public.blog_posts (status, published_at DESC);
CREATE INDEX blog_posts_category_idx ON public.blog_posts (category);
CREATE INDEX blog_posts_author_idx ON public.blog_posts (author_id);
CREATE UNIQUE INDEX blog_posts_single_featured
  ON public.blog_posts (is_featured)
  WHERE is_featured = true AND status = 'published';

CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- View log (lightweight, append-only)
CREATE TABLE public.blog_post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  viewer_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blog_post_views_post_idx ON public.blog_post_views (post_id, viewed_at DESC);

-- RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_views ENABLE ROW LEVEL SECURITY;

-- SELECT: published posts visible to donors / catalysts / admins; authors see their own; admins see everything
CREATE POLICY blog_posts_select
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = author_id
    OR (
      status = 'published'
      AND public.has_any_role(auth.uid(), ARRAY['donor','catalyst','admin']::app_role[])
    )
  );

-- INSERT: catalyst or admin, as themselves, only draft/pending unless admin
CREATE POLICY blog_posts_insert
  ON public.blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.has_any_role(auth.uid(), ARRAY['catalyst','admin']::app_role[])
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR status IN ('draft','pending')
    )
  );

-- UPDATE: admin anything; author own while editable
CREATE POLICY blog_posts_update
  ON public.blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = author_id AND status IN ('draft','pending','rejected'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = author_id AND status IN ('draft','pending','rejected'))
  );

-- DELETE: admin anything; author own
CREATE POLICY blog_posts_delete
  ON public.blog_posts
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = author_id
  );

-- Protect admin-only columns from non-admin authors
CREATE OR REPLACE FUNCTION public.tg_blog_posts_protect_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- On INSERT, force-safe defaults for non-admin
  IF TG_OP = 'INSERT' THEN
    NEW.is_featured := false;
    NEW.published_at := NULL;
    NEW.review_note := NULL;
    NEW.scheduled_for := NULL;
    IF NEW.status NOT IN ('draft','pending') THEN
      NEW.status := 'draft';
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE, forbid changing protected columns
  IF NEW.is_featured  IS DISTINCT FROM OLD.is_featured
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.review_note  IS DISTINCT FROM OLD.review_note
     OR NEW.slug         IS DISTINCT FROM OLD.slug
     OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
     OR NEW.author_id    IS DISTINCT FROM OLD.author_id
  THEN
    RAISE EXCEPTION 'forbidden: only admins may modify governance fields on blog_posts';
  END IF;

  -- Status: authors may only move draft<->pending; rejected->pending (resubmit)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'    AND NEW.status IN ('draft','pending'))
      OR (OLD.status = 'pending'  AND NEW.status IN ('draft','pending'))
      OR (OLD.status = 'rejected' AND NEW.status IN ('draft','pending'))
    ) THEN
      RAISE EXCEPTION 'forbidden: only admins may publish, approve, reject, or archive posts';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_blog_posts_protect_cols()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER blog_posts_protect_cols
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_blog_posts_protect_cols();

-- Views: signed-in users can insert their own view rows; admins can read
CREATE POLICY blog_post_views_insert
  ON public.blog_post_views
  FOR INSERT
  TO authenticated
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());

CREATE POLICY blog_post_views_admin_select
  ON public.blog_post_views
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for blog covers + inline images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-covers', 'blog-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY blog_covers_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'blog-covers');

CREATE POLICY blog_covers_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-covers'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (auth.uid())::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY blog_covers_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (auth.uid())::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY blog_covers_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (auth.uid())::text = (storage.foldername(name))[1]
    )
  );
