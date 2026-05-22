-- Drop the previous view-based approach
DROP VIEW IF EXISTS public.catalyst_orgs_public;

-- Restore a public row-level read policy for approved orgs
CREATE POLICY catalyst_orgs_public_approved
ON public.catalyst_orgs
FOR SELECT
TO anon, authenticated
USING (approved = true);

-- Revoke ALL on the table from public roles, then re-grant SELECT only on safe columns
REVOKE ALL ON public.catalyst_orgs FROM anon, authenticated;
GRANT SELECT (
  id,
  org_name,
  logo_url,
  location,
  website,
  mission,
  approved,
  approved_at,
  created_at,
  updated_at
) ON public.catalyst_orgs TO anon, authenticated;

-- Owners still need full self-access; grant all column SELECT/INSERT/UPDATE back to authenticated for their own rows (RLS still enforces ownership).
GRANT INSERT, UPDATE, SELECT ON public.catalyst_orgs TO authenticated;