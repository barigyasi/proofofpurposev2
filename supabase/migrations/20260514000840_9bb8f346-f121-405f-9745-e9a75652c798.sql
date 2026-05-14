
ALTER TABLE public.bounty_drafts
  ADD COLUMN IF NOT EXISTS completed_participants integer,
  ADD COLUMN IF NOT EXISTS purpose_minted_snapshot numeric,
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz;

CREATE OR REPLACE FUNCTION public.snapshot_bounty_draft_metrics(_draft_id uuid)
RETURNS public.bounty_drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.bounty_drafts;
  v_signups integer;
  v_minted numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO d FROM public.bounty_drafts WHERE id = _draft_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'draft not found'; END IF;

  IF d.on_chain_bounty_id IS NOT NULL THEN
    SELECT count(*) INTO v_signups
      FROM public.bounty_signups s
      WHERE s.on_chain_bounty_id = d.on_chain_bounty_id
        AND (s.status = 'checked_in' OR s.checked_in_at IS NOT NULL);
    IF v_signups = 0 THEN
      SELECT count(*) INTO v_signups
        FROM public.bounty_signups s
        WHERE s.on_chain_bounty_id = d.on_chain_bounty_id;
    END IF;

    SELECT COALESCE(sum(purpose_amount), 0) INTO v_minted
      FROM public.bounty_rewards r
      WHERE r.on_chain_bounty_id = d.on_chain_bounty_id;
  ELSE
    v_signups := 0;
    v_minted := 0;
  END IF;

  UPDATE public.bounty_drafts
    SET completed_participants = v_signups,
        purpose_minted_snapshot = v_minted,
        snapshot_at = now(),
        updated_at = now()
    WHERE id = _draft_id
    RETURNING * INTO d;

  RETURN d;
END;
$$;
