
-- 1. Editions table
CREATE TABLE public.membership_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text NOT NULL,
  animation_url text,
  active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY editions_public_select
  ON public.membership_editions FOR SELECT USING (true);

CREATE POLICY editions_admin_write
  ON public.membership_editions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_membership_editions_updated_at
  BEFORE UPDATE ON public.membership_editions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Only one row may be active at a time
CREATE UNIQUE INDEX membership_editions_one_active
  ON public.membership_editions ((active)) WHERE active = true;

-- 2. Stamp mints with the edition they were minted under
ALTER TABLE public.membership_mints
  ADD COLUMN edition_id uuid REFERENCES public.membership_editions(id) ON DELETE SET NULL;

CREATE INDEX membership_mints_edition_idx ON public.membership_mints (edition_id);

-- 3. Public storage bucket for edition artwork
INSERT INTO storage.buckets (id, name, public)
VALUES ('membership-art', 'membership-art', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "membership-art public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'membership-art');

CREATE POLICY "membership-art admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'membership-art' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "membership-art admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'membership-art' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "membership-art admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'membership-art' AND public.has_role(auth.uid(), 'admin'::app_role));
