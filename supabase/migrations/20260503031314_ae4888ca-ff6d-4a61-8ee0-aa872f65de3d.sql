
ALTER TABLE public.bounties
  ADD COLUMN IF NOT EXISTS min_participants integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_in_token text,
  ADD COLUMN IF NOT EXISTS check_in_token_expires_at timestamptz;

ALTER TABLE public.bounty_signups
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
