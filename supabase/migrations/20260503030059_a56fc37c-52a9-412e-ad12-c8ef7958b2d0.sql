CREATE TABLE public.bounty_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL,
  on_chain_bounty_id bigint,
  user_id uuid,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  added_tx_hash text,
  added_at timestamptz,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, wallet_address)
);

CREATE INDEX idx_bounty_signups_bounty ON public.bounty_signups(bounty_id);
CREATE INDEX idx_bounty_signups_status ON public.bounty_signups(status);

ALTER TABLE public.bounty_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bounty_signups_public" ON public.bounty_signups FOR SELECT USING (true);
CREATE POLICY "bounty_signups_insert_own" ON public.bounty_signups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bounty_signups_admin_all" ON public.bounty_signups FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_bounty_signups_updated_at
BEFORE UPDATE ON public.bounty_signups
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();