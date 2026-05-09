-- Add media columns to bounty_drafts
ALTER TABLE public.bounty_drafts
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS deck_url text,
  ADD COLUMN IF NOT EXISTS deck_filename text;

-- Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bounty-videos', 'bounty-videos', true, 104857600,
  ARRAY['video/mp4','video/quicktime','video/webm','video/ogg','video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bounty-decks', 'bounty-decks', true, 26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.oasis.opendocument.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies on storage.objects for the two new buckets
DROP POLICY IF EXISTS "bounty_videos_public_read" ON storage.objects;
CREATE POLICY "bounty_videos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bounty-videos');

DROP POLICY IF EXISTS "bounty_videos_owner_insert" ON storage.objects;
CREATE POLICY "bounty_videos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bounty-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_videos_owner_update" ON storage.objects;
CREATE POLICY "bounty_videos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bounty-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_videos_owner_delete" ON storage.objects;
CREATE POLICY "bounty_videos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bounty-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_decks_public_read" ON storage.objects;
CREATE POLICY "bounty_decks_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bounty-decks');

DROP POLICY IF EXISTS "bounty_decks_owner_insert" ON storage.objects;
CREATE POLICY "bounty_decks_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bounty-decks' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_decks_owner_update" ON storage.objects;
CREATE POLICY "bounty_decks_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bounty-decks' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_decks_owner_delete" ON storage.objects;
CREATE POLICY "bounty_decks_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bounty-decks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Also ensure bounty-images has owner-folder policies (re-create idempotently)
DROP POLICY IF EXISTS "bounty_images_public_read" ON storage.objects;
CREATE POLICY "bounty_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bounty-images');

DROP POLICY IF EXISTS "bounty_images_owner_insert" ON storage.objects;
CREATE POLICY "bounty_images_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bounty-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_images_owner_update" ON storage.objects;
CREATE POLICY "bounty_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bounty-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bounty_images_owner_delete" ON storage.objects;
CREATE POLICY "bounty_images_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bounty-images' AND auth.uid()::text = (storage.foldername(name))[1]);