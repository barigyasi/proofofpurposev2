
ALTER VIEW public.vendors_public_view SET (security_invoker = true);
ALTER VIEW public.public_profiles SET (security_invoker = true);

CREATE POLICY "wallet_auth_nonces_no_client_access"
  ON public.wallet_auth_nonces
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "applicants_insert_anyone" ON public.pending_applicants;
CREATE POLICY "applicants_insert_anyone"
  ON public.pending_applicants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(email, '')) BETWEEN 3 AND 320
    AND char_length(coalesce(name, '')) BETWEEN 1 AND 200
  );

DROP POLICY IF EXISTS "donations_insert_anyone" ON public.donations;
CREATE POLICY "donations_insert_anyone"
  ON public.donations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    amount_usdc IS NOT NULL
    AND amount_usdc > 0
    AND char_length(coalesce(tx_hash, '')) BETWEEN 10 AND 100
  );

DROP POLICY IF EXISTS "waitlist_insert_anyone" ON public.waitlist_signups;
CREATE POLICY "waitlist_insert_anyone"
  ON public.waitlist_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(email, '')) BETWEEN 3 AND 320
    AND char_length(coalesce(name, '')) BETWEEN 1 AND 200
  );

REVOKE EXECUTE ON FUNCTION public.tg_bounty_drafts_protect_cols() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_vendor_charges_protect_cols() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recount_draft_votes() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.snapshot_bounty_draft_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.eligible_vote_weight(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_membership(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_role_count(app_role) FROM anon, PUBLIC;
