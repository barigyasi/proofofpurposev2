CREATE OR REPLACE FUNCTION public.tg_bounty_drafts_protect_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.status                   IS DISTINCT FROM OLD.status
     OR NEW.yes_count             IS DISTINCT FROM OLD.yes_count
     OR NEW.no_count              IS DISTINCT FROM OLD.no_count
     OR NEW.abstain_count         IS DISTINCT FROM OLD.abstain_count
     OR NEW.dao_proposal_id       IS DISTINCT FROM OLD.dao_proposal_id
     OR NEW.on_chain_bounty_id    IS DISTINCT FROM OLD.on_chain_bounty_id
     OR NEW.on_chain_tx_hash      IS DISTINCT FROM OLD.on_chain_tx_hash
     OR NEW.executed_at           IS DISTINCT FROM OLD.executed_at
     OR NEW.executed_by           IS DISTINCT FROM OLD.executed_by
     OR NEW.completed_participants IS DISTINCT FROM OLD.completed_participants
     OR NEW.purpose_minted_snapshot IS DISTINCT FROM OLD.purpose_minted_snapshot
     OR NEW.snapshot_at           IS DISTINCT FROM OLD.snapshot_at
     OR NEW.vote_opens_at         IS DISTINCT FROM OLD.vote_opens_at
     OR NEW.vote_closes_at        IS DISTINCT FROM OLD.vote_closes_at
     OR NEW.proposer_id           IS DISTINCT FROM OLD.proposer_id
  THEN
    RAISE EXCEPTION 'forbidden: only admins may modify governance fields on bounty_drafts';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bounty_drafts_protect_cols ON public.bounty_drafts;
CREATE TRIGGER bounty_drafts_protect_cols
  BEFORE UPDATE ON public.bounty_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_bounty_drafts_protect_cols();