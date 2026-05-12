ALTER TABLE public.vendor_charges
  ADD COLUMN IF NOT EXISTS receipt_token_id BIGINT,
  ADD COLUMN IF NOT EXISTS receipt_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS receipt_minted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_emailed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_error TEXT;

CREATE INDEX IF NOT EXISTS idx_vendor_charges_receipt_token_id
  ON public.vendor_charges (receipt_token_id)
  WHERE receipt_token_id IS NOT NULL;