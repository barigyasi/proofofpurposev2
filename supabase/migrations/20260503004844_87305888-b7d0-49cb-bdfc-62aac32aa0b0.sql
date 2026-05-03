-- Lock down has_role / has_any_role from anonymous calls
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

-- Tighten storage policies: remove broad SELECT on public buckets that allows full listing.
-- Files remain accessible via public URLs; only LIST is restricted.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "bounty_images_public_read" ON storage.objects;