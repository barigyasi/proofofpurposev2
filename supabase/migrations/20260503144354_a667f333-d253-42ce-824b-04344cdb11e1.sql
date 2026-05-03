CREATE TABLE public.membership_mints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_wallet TEXT NOT NULL,
  month_key INTEGER NOT NULL,
  token_id BIGINT,
  tx_hash TEXT,
  contract_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (donor_wallet, month_key)
);

CREATE INDEX idx_membership_mints_wallet ON public.membership_mints(donor_wallet);
CREATE INDEX idx_membership_mints_month ON public.membership_mints(month_key);

ALTER TABLE public.membership_mints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_mints_public" ON public.membership_mints
  FOR SELECT USING (true);

CREATE POLICY "membership_mints_admin_all" ON public.membership_mints
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_membership_mints_updated_at
  BEFORE UPDATE ON public.membership_mints
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();