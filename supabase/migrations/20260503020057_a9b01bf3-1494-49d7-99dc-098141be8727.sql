-- 1. Add catalyst to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'catalyst';

-- 2. catalyst_orgs
CREATE TABLE public.catalyst_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  org_name text NOT NULL,
  mission text,
  website text,
  contact_email text,
  location text,
  logo_url text,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalyst_orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalyst_orgs_public_approved ON public.catalyst_orgs
  FOR SELECT USING (approved = true);
CREATE POLICY catalyst_orgs_own_select ON public.catalyst_orgs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY catalyst_orgs_own_insert ON public.catalyst_orgs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY catalyst_orgs_own_update ON public.catalyst_orgs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY catalyst_orgs_admin_all ON public.catalyst_orgs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER catalyst_orgs_set_updated_at
  BEFORE UPDATE ON public.catalyst_orgs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. bounty_drafts
CREATE TABLE public.bounty_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalyst_id uuid REFERENCES public.catalyst_orgs(id) ON DELETE SET NULL,
  proposer_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  reward_purpose numeric NOT NULL,
  max_participants integer NOT NULL,
  image_url text,
  location text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending_vote',
  dao_proposal_id numeric,
  on_chain_bounty_id bigint,
  on_chain_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bounty_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bounty_drafts_public ON public.bounty_drafts
  FOR SELECT USING (true);
CREATE POLICY bounty_drafts_insert_own ON public.bounty_drafts
  FOR INSERT WITH CHECK (auth.uid() = proposer_id);
CREATE POLICY bounty_drafts_update_own ON public.bounty_drafts
  FOR UPDATE USING (auth.uid() = proposer_id);
CREATE POLICY bounty_drafts_admin_all ON public.bounty_drafts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER bounty_drafts_set_updated_at
  BEFORE UPDATE ON public.bounty_drafts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. governance_config (single row)
CREATE TABLE public.governance_config (
  id integer PRIMARY KEY DEFAULT 1,
  vote_contract_address text,
  vote_token_address text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_config_singleton CHECK (id = 1)
);
ALTER TABLE public.governance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY governance_config_public ON public.governance_config
  FOR SELECT USING (true);
CREATE POLICY governance_config_admin_write ON public.governance_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.governance_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 5. Storage policies for bounty-images (public bucket)
CREATE POLICY "bounty_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'bounty-images');
CREATE POLICY "bounty_images_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'bounty-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "bounty_images_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'bounty-images' AND owner = auth.uid());
CREATE POLICY "bounty_images_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'bounty-images' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

-- vendor-documents (private)
CREATE POLICY "vendor_docs_owner_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendor-documents' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "vendor_docs_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vendor-documents' AND auth.uid() IS NOT NULL);

-- avatars (public)
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND owner = auth.uid());