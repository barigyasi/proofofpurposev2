CREATE POLICY "vendors_self_insert" ON public.vendors
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.wallet_address) = lower(vendors.wallet_address)
  )
);