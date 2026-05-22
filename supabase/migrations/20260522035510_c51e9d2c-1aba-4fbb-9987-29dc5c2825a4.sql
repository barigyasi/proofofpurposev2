-- 1. Drop the leaky public-all-columns policy
DROP POLICY IF EXISTS catalyst_orgs_public_approved ON public.catalyst_orgs;

-- 2. Create a sanitized public view (security_invoker so RLS still applies to underlying table — view bypasses table RLS via its own grants)
CREATE OR REPLACE VIEW public.catalyst_orgs_public
WITH (security_invoker = false) AS
SELECT
  id,
  org_name,
  logo_url,
  location,
  website,
  mission,
  approved_at,
  created_at
FROM public.catalyst_orgs
WHERE approved = true;

-- 3. Grant read access on the sanitized view
GRANT SELECT ON public.catalyst_orgs_public TO anon, authenticated;