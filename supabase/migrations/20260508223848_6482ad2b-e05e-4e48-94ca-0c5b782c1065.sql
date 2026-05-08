ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS block_number BIGINT,
  ADD COLUMN IF NOT EXISTS log_index INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS donations_tx_logindex_uq
  ON public.donations (tx_hash, log_index)
  WHERE tx_hash IS NOT NULL AND log_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS donations_block_number_idx
  ON public.donations (block_number DESC);