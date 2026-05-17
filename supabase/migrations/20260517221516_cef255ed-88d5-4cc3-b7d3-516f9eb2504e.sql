
-- Eligibility helper: does this wallet hold at least one MINTED membership for the current month?
CREATE OR REPLACE FUNCTION public.has_active_membership(_wallet text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membership_mints m
    WHERE lower(m.donor_wallet) = lower(_wallet)
      AND m.status = 'minted'
      AND m.month_key = (EXTRACT(YEAR FROM now())::int * 100 + EXTRACT(MONTH FROM now())::int)
  )
$$;

-- Voting weight (always 1 per "1 active membership = 1 vote" rule).
CREATE OR REPLACE FUNCTION public.eligible_vote_weight(_wallet text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_active_membership(_wallet) THEN 1 ELSE 0 END
$$;

-- Tighten draft vote policies: require an active membership (admins bypass).
DROP POLICY IF EXISTS draft_votes_eligible_insert ON public.bounty_draft_votes;
CREATE POLICY draft_votes_eligible_insert
ON public.bounty_draft_votes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = voter_id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_any_role(auth.uid(), ARRAY['donor'::app_role, 'catalyst'::app_role])
      AND voter_wallet IS NOT NULL
      AND public.has_active_membership(voter_wallet)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND lower(p.wallet_address) = lower(voter_wallet)
      )
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.bounty_drafts d
    WHERE d.id = bounty_draft_votes.draft_id
      AND d.status = 'pending_vote'
      AND d.vote_closes_at > now()
  )
);

DROP POLICY IF EXISTS draft_votes_self_update ON public.bounty_draft_votes;
CREATE POLICY draft_votes_self_update
ON public.bounty_draft_votes
FOR UPDATE
TO authenticated
USING (auth.uid() = voter_id)
WITH CHECK (
  auth.uid() = voter_id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      voter_wallet IS NOT NULL
      AND public.has_active_membership(voter_wallet)
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.bounty_drafts d
    WHERE d.id = bounty_draft_votes.draft_id
      AND d.status = 'pending_vote'
      AND d.vote_closes_at > now()
  )
);
