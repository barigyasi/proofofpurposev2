-- =====================================================================
-- 1. BOUNTIES: hide secret check-in tokens from public reads
-- =====================================================================
REVOKE SELECT (check_in_token, check_in_token_expires_at) ON public.bounties FROM anon, authenticated;

-- =====================================================================
-- 2. PROFILES: restrict PII (email/phone) and provide a safe public view
-- =====================================================================
DROP POLICY IF EXISTS profiles_public ON public.profiles;

CREATE POLICY profiles_self_or_admin_select
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- Public, PII-free view for participant-name lookups, etc.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
  SELECT id, wallet_address, username, display_name, avatar_url, bio
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- =====================================================================
-- 3. VENDORS: restrict contact info; expose only safe fields publicly
-- =====================================================================
DROP POLICY IF EXISTS vendors_public ON public.vendors;

CREATE POLICY vendors_self_or_admin_select
  ON public.vendors FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND lower(p.wallet_address) = lower(vendors.wallet_address)
    )
  );

DROP VIEW IF EXISTS public.vendors_public_view;
CREATE VIEW public.vendors_public_view
WITH (security_invoker = false) AS
  SELECT id, business_name, description, category, logo_url, wallet_address, approved, created_at
  FROM public.vendors
  WHERE approved = true;

GRANT SELECT ON public.vendors_public_view TO anon, authenticated;

-- =====================================================================
-- 4. VENDOR_CHARGES: drop public read, scope to vendor/champion/admin
--    and prevent champions from tampering with financial columns.
-- =====================================================================
DROP POLICY IF EXISTS vendor_charges_public_select ON public.vendor_charges;

CREATE POLICY vendor_charges_scoped_select
  ON public.vendor_charges FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(p.wallet_address) = lower(vendor_charges.vendor_wallet)
          OR lower(p.wallet_address) = lower(vendor_charges.champion_wallet)
        )
    )
  );

-- Trigger: block non-admins from changing protected columns on UPDATE.
CREATE OR REPLACE FUNCTION public.tg_vendor_charges_protect_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.purpose_amount_wei IS DISTINCT FROM OLD.purpose_amount_wei
     OR NEW.usdc_payout       IS DISTINCT FROM OLD.usdc_payout
     OR NEW.nonce             IS DISTINCT FROM OLD.nonce
     OR NEW.vendor_wallet     IS DISTINCT FROM OLD.vendor_wallet
     OR NEW.champion_wallet   IS DISTINCT FROM OLD.champion_wallet
     OR NEW.vendor_user_id    IS DISTINCT FROM OLD.vendor_user_id
     OR NEW.tx_hash           IS DISTINCT FROM OLD.tx_hash
     OR NEW.lock_tx_hash      IS DISTINCT FROM OLD.lock_tx_hash
     OR NEW.capture_tx_hash   IS DISTINCT FROM OLD.capture_tx_hash
     OR NEW.cancel_tx_hash    IS DISTINCT FROM OLD.cancel_tx_hash
     OR NEW.refund_tx_hash    IS DISTINCT FROM OLD.refund_tx_hash
     OR NEW.sweep_tx_hash     IS DISTINCT FROM OLD.sweep_tx_hash
     OR NEW.receipt_tx_hash   IS DISTINCT FROM OLD.receipt_tx_hash
     OR NEW.receipt_token_id  IS DISTINCT FROM OLD.receipt_token_id
     OR NEW.usdc_payout       IS DISTINCT FROM OLD.usdc_payout
     OR NEW.captured_at       IS DISTINCT FROM OLD.captured_at
     OR NEW.settled_at        IS DISTINCT FROM OLD.settled_at
     OR NEW.swept_at          IS DISTINCT FROM OLD.swept_at
     OR NEW.refunded_at       IS DISTINCT FROM OLD.refunded_at
  THEN
    RAISE EXCEPTION 'forbidden: only admins or backend may modify protected charge fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_charges_protect_cols ON public.vendor_charges;
CREATE TRIGGER vendor_charges_protect_cols
  BEFORE UPDATE ON public.vendor_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_vendor_charges_protect_cols();

-- =====================================================================
-- 5. USER_ROLES: drop public enumeration; add safe count RPC
-- =====================================================================
DROP POLICY IF EXISTS view_roles ON public.user_roles;

CREATE POLICY user_roles_self_or_admin_select
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.public_role_count(_role app_role)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint FROM public.user_roles WHERE role = _role;
$$;

GRANT EXECUTE ON FUNCTION public.public_role_count(app_role) TO anon, authenticated;

-- =====================================================================
-- 6. STORAGE: vendor-documents — restrict insert to owner's folder only
-- =====================================================================
DROP POLICY IF EXISTS vendor_docs_auth_insert ON storage.objects;
