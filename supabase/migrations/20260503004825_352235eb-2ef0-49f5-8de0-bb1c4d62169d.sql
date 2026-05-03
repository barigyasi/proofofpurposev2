-- Enum + role helpers
CREATE TYPE public.app_role AS ENUM ('admin','vendor','champion','donor','support');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))$$;

CREATE POLICY "view_roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "manage_roles_admin" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS
$$BEGIN NEW.updated_at = now(); RETURN NEW; END$$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text UNIQUE NOT NULL,
  username text UNIQUE,
  display_name text,
  email text,
  phone text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- SIWE nonces (backend-only)
CREATE TABLE public.wallet_auth_nonces (
  wallet_address text PRIMARY KEY,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_auth_nonces ENABLE ROW LEVEL SECURITY;

-- Pending applicants
CREATE TABLE public.pending_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  requested_role public.app_role NOT NULL,
  name text,
  email text,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applicants_insert_anyone" ON public.pending_applicants FOR INSERT WITH CHECK (true);
CREATE POLICY "applicants_admin_view" ON public.pending_applicants FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "applicants_admin_update" ON public.pending_applicants FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "applicants_admin_delete" ON public.pending_applicants FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Vendors
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  business_name text NOT NULL,
  contact_email text,
  phone text,
  category text,
  description text,
  logo_url text,
  w9_url text,
  approved boolean NOT NULL DEFAULT false,
  approved_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_public" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "vendors_admin_all" ON public.vendors FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Bounties
CREATE TABLE public.bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  reward_amount numeric(20,6) NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  on_chain_id bigint,
  on_chain_tx_hash text,
  image_url text,
  location text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bounties_public" ON public.bounties FOR SELECT USING (true);
CREATE POLICY "bounties_admin_all" ON public.bounties FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER bounties_updated_at BEFORE UPDATE ON public.bounties
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.bounty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid REFERENCES public.bounties(id) ON DELETE SET NULL,
  on_chain_bounty_id bigint,
  participant_wallet text NOT NULL,
  purpose_amount numeric(78,0) NOT NULL,
  mint_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bounty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_public" ON public.bounty_rewards FOR SELECT USING (true);
CREATE POLICY "rewards_admin_all" ON public.bounty_rewards FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Vendor redemptions
CREATE TABLE public.vendor_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_wallet text NOT NULL,
  champion_wallet text NOT NULL,
  purpose_amount_wei numeric(78,0) NOT NULL,
  usdc_payout numeric(20,6) NOT NULL,
  tx_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions_public" ON public.vendor_redemptions FOR SELECT USING (true);
CREATE POLICY "redemptions_admin_all" ON public.vendor_redemptions FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Donations
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_wallet text NOT NULL,
  source text NOT NULL CHECK (source IN ('onramp','commerce','direct')),
  amount_usdc numeric(20,6) NOT NULL,
  tx_hash text UNIQUE,
  charge_id text UNIQUE,
  champion_referral text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "donations_public" ON public.donations FOR SELECT USING (true);
CREATE POLICY "donations_admin_all" ON public.donations FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Bulletin
CREATE TABLE public.bulletin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_public" ON public.bulletin_posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON public.bulletin_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON public.bulletin_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_delete_own_or_admin" ON public.bulletin_posts FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.bulletin_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.bulletin_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bulletin_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public" ON public.bulletin_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.bulletin_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_update_own" ON public.bulletin_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "comments_delete_own_or_admin" ON public.bulletin_comments FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));

-- Governance
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  created_by uuid,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_public" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "proposals_insert_auth" ON public.proposals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "proposals_admin_all" ON public.proposals FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  voter_wallet text NOT NULL,
  choice text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, voter_wallet)
);
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_public" ON public.votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_own" ON public.votes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = voter_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('vendor-documents','vendor-documents', false),
  ('avatars','avatars', true),
  ('bounty-images','bounty-images', true);

-- Storage policies: avatars (public read, user manages own folder)
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_user_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- bounty-images: public read, admin write
CREATE POLICY "bounty_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'bounty-images');
CREATE POLICY "bounty_images_admin_write" ON storage.objects FOR ALL
  USING (bucket_id = 'bounty-images' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'bounty-images' AND public.has_role(auth.uid(),'admin'));

-- vendor-documents: vendor user manages own folder, admins read all
CREATE POLICY "vendor_docs_user_rw" ON storage.objects FOR ALL
  USING (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "vendor_docs_admin_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-documents' AND public.has_role(auth.uid(),'admin'));