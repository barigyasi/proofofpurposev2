REVOKE EXECUTE ON FUNCTION public.snapshot_bounty_draft_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_bounty_draft_metrics(uuid) TO authenticated;