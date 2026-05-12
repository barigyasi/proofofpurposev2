
-- Extend vendor_charges with state-machine columns.
ALTER TABLE public.vendor_charges
  ADD COLUMN IF NOT EXISTS locked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS captured_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS swept_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_tx_hash   TEXT,
  ADD COLUMN IF NOT EXISTS capture_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS cancel_tx_hash  TEXT,
  ADD COLUMN IF NOT EXISTS refund_tx_hash  TEXT,
  ADD COLUMN IF NOT EXISTS sweep_tx_hash   TEXT,
  ADD COLUMN IF NOT EXISTS refund_source  TEXT,
  ADD COLUMN IF NOT EXISTS refund_reason  TEXT,
  ADD COLUMN IF NOT EXISTS auth_window_seconds   INTEGER,
  ADD COLUMN IF NOT EXISTS refund_window_seconds INTEGER;

CREATE INDEX IF NOT EXISTS vendor_charges_status_idx       ON public.vendor_charges (status);
CREATE INDEX IF NOT EXISTS vendor_charges_captured_at_idx  ON public.vendor_charges (captured_at);
CREATE INDEX IF NOT EXISTS vendor_charges_vendor_status_idx ON public.vendor_charges (lower(vendor_wallet), status);
CREATE INDEX IF NOT EXISTS vendor_charges_champion_status_idx ON public.vendor_charges (lower(champion_wallet), status);

-- Per-vendor window overrides (mirror of on-chain config).
CREATE TABLE IF NOT EXISTS public.vendor_refund_config (
  vendor_wallet         TEXT PRIMARY KEY,
  auth_window_seconds   INTEGER NOT NULL,
  refund_window_seconds INTEGER NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID
);

ALTER TABLE public.vendor_refund_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_refund_config_public ON public.vendor_refund_config FOR SELECT USING (true);
CREATE POLICY vendor_refund_config_admin_write ON public.vendor_refund_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER vendor_refund_config_updated_at
  BEFORE UPDATE ON public.vendor_refund_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Refund-pool ledger.
CREATE TABLE IF NOT EXISTS public.refund_pool_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL CHECK (kind IN ('deposit','payout','withdraw')),
  amount_usdc  NUMERIC NOT NULL,
  charge_id    UUID,
  tx_hash      TEXT,
  actor        TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_pool_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY refund_pool_ledger_public ON public.refund_pool_ledger FOR SELECT USING (true);
CREATE POLICY refund_pool_ledger_admin_write ON public.refund_pool_ledger
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS refund_pool_ledger_kind_idx ON public.refund_pool_ledger (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS refund_pool_ledger_charge_idx ON public.refund_pool_ledger (charge_id);

-- Allow vendors to update their own charge rows (refund/capture status change requests via UI).
DO $$ BEGIN
  CREATE POLICY vendor_charges_vendor_update ON public.vendor_charges
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND lower(p.wallet_address) = lower(vendor_charges.vendor_wallet)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND lower(p.wallet_address) = lower(vendor_charges.vendor_wallet)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable cron + net for scheduled jobs.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
