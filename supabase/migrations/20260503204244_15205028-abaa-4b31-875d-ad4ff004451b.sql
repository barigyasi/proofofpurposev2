-- Pending POS / online-shop charges that wait on a champion confirmation.
CREATE TABLE public.vendor_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_wallet TEXT NOT NULL,
  vendor_user_id UUID,                    -- creator (vendor's auth user)
  champion_wallet TEXT NOT NULL,
  purpose_amount_wei NUMERIC NOT NULL,
  memo TEXT,
  nonce TEXT NOT NULL,                    -- random; bound into the signed message
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | settled | failed | expired
  champion_signature TEXT,                -- EIP-1271 sig over the canonical message
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  settled_at TIMESTAMPTZ,
  tx_hash TEXT,
  usdc_payout NUMERIC,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vendor_charges_champion_idx ON public.vendor_charges (lower(champion_wallet), status, created_at DESC);
CREATE INDEX vendor_charges_vendor_idx   ON public.vendor_charges (lower(vendor_wallet),  status, created_at DESC);

ALTER TABLE public.vendor_charges ENABLE ROW LEVEL SECURITY;

-- Public read (needed for realtime on both vendor + champion sides; nothing sensitive here).
CREATE POLICY "vendor_charges_public_select"
  ON public.vendor_charges FOR SELECT
  USING (true);

-- Approved vendor creates a charge for themselves.
CREATE POLICY "vendor_charges_vendor_insert"
  ON public.vendor_charges FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'vendor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(p.wallet_address) = lower(vendor_charges.vendor_wallet)
    )
  );

-- Champion confirms / rejects their own pending charge.
CREATE POLICY "vendor_charges_champion_update"
  ON public.vendor_charges FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(p.wallet_address) = lower(vendor_charges.champion_wallet)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(p.wallet_address) = lower(vendor_charges.champion_wallet)
    )
  );

-- Admin / service role full access.
CREATE POLICY "vendor_charges_admin_all"
  ON public.vendor_charges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated-at trigger.
CREATE TRIGGER set_updated_at_vendor_charges
  BEFORE UPDATE ON public.vendor_charges
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_charges;
ALTER TABLE public.vendor_charges REPLICA IDENTITY FULL;