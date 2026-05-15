-- 1. Properly hide bounties.check_in_token by replacing the table-level grant
--    with explicit column grants for the safe set only.
REVOKE SELECT ON public.bounties FROM anon, authenticated;

GRANT SELECT
  (id, title, description, reward_amount, max_participants, min_participants,
   image_url, location, expires_at, status, on_chain_id, on_chain_tx_hash,
   created_by, started_at, completed_at, created_at, updated_at)
  ON public.bounties TO anon, authenticated;

-- 2. Remove vendor_charges from the realtime publication so sensitive
--    financial row-change events are no longer broadcast to all subscribers.
ALTER PUBLICATION supabase_realtime DROP TABLE public.vendor_charges;