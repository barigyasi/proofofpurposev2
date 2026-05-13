CREATE TABLE public.receipt_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_token_id bigint NOT NULL,
  charge_id uuid,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('champion','vendor')),
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  resend_id text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipt_email_log_token ON public.receipt_email_log(receipt_token_id);
CREATE INDEX idx_receipt_email_log_charge ON public.receipt_email_log(charge_id);
CREATE UNIQUE INDEX uniq_receipt_email_sent ON public.receipt_email_log(receipt_token_id, recipient_kind) WHERE status = 'sent';

ALTER TABLE public.receipt_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY receipt_email_log_admin_all ON public.receipt_email_log
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY receipt_email_log_champion_select ON public.receipt_email_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendor_charges vc
      JOIN public.profiles p ON lower(p.wallet_address) = lower(vc.champion_wallet)
      WHERE vc.id = receipt_email_log.charge_id AND p.id = auth.uid()
    )
  );

CREATE POLICY receipt_email_log_vendor_select ON public.receipt_email_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendor_charges vc
      JOIN public.profiles p ON lower(p.wallet_address) = lower(vc.vendor_wallet)
      WHERE vc.id = receipt_email_log.charge_id AND p.id = auth.uid()
    )
  );