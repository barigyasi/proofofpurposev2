-- Extend bounty_drafts with vote-tracking columns.
ALTER TABLE public.bounty_drafts
  ADD COLUMN IF NOT EXISTS vote_opens_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS vote_closes_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
  ADD COLUMN IF NOT EXISTS yes_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS abstain_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS executed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_by  UUID;

-- One vote per voter per draft.
CREATE TABLE IF NOT EXISTS public.bounty_draft_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.bounty_drafts(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  voter_wallet TEXT,
  choice TEXT NOT NULL CHECK (choice IN ('yes','no','abstain')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draft_id, voter_id)
);

CREATE INDEX IF NOT EXISTS bounty_draft_votes_draft_idx
  ON public.bounty_draft_votes (draft_id);

ALTER TABLE public.bounty_draft_votes ENABLE ROW LEVEL SECURITY;

-- Public read.
CREATE POLICY "draft_votes_public_select"
  ON public.bounty_draft_votes FOR SELECT
  USING (true);

-- Donors / Catalysts / Admins may cast their own vote while draft is open.
CREATE POLICY "draft_votes_eligible_insert"
  ON public.bounty_draft_votes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = voter_id
    AND has_any_role(auth.uid(), ARRAY['donor','catalyst','admin']::app_role[])
    AND EXISTS (
      SELECT 1 FROM public.bounty_drafts d
      WHERE d.id = bounty_draft_votes.draft_id
        AND d.status = 'pending_vote'
        AND d.vote_closes_at > now()
    )
  );

-- Voter may change their own vote while still open.
CREATE POLICY "draft_votes_self_update"
  ON public.bounty_draft_votes FOR UPDATE TO authenticated
  USING (auth.uid() = voter_id)
  WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM public.bounty_drafts d
      WHERE d.id = bounty_draft_votes.draft_id
        AND d.status = 'pending_vote'
        AND d.vote_closes_at > now()
    )
  );

CREATE POLICY "draft_votes_admin_all"
  ON public.bounty_draft_votes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tally trigger: recount the draft after any change.
CREATE OR REPLACE FUNCTION public.tg_recount_draft_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
BEGIN
  did := COALESCE(NEW.draft_id, OLD.draft_id);
  UPDATE public.bounty_drafts d SET
    yes_count     = (SELECT count(*) FROM public.bounty_draft_votes v WHERE v.draft_id = did AND v.choice = 'yes'),
    no_count      = (SELECT count(*) FROM public.bounty_draft_votes v WHERE v.draft_id = did AND v.choice = 'no'),
    abstain_count = (SELECT count(*) FROM public.bounty_draft_votes v WHERE v.draft_id = did AND v.choice = 'abstain'),
    updated_at    = now()
  WHERE d.id = did;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recount_draft_votes ON public.bounty_draft_votes;
CREATE TRIGGER recount_draft_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.bounty_draft_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_recount_draft_votes();

-- Updated-at trigger on votes.
DROP TRIGGER IF EXISTS set_updated_at_draft_votes ON public.bounty_draft_votes;
CREATE TRIGGER set_updated_at_draft_votes
  BEFORE UPDATE ON public.bounty_draft_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bounty_draft_votes;
ALTER TABLE public.bounty_draft_votes REPLICA IDENTITY FULL;