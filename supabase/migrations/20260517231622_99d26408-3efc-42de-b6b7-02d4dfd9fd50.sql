ALTER TABLE public.bounty_drafts
ALTER COLUMN dao_proposal_id TYPE text
USING CASE
  WHEN dao_proposal_id IS NULL THEN NULL
  ELSE dao_proposal_id::text
END;