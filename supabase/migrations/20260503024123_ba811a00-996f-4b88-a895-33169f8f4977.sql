CREATE TABLE public.champion_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  champion_name text NOT NULL,
  date_of_birth date NOT NULL,
  school text NOT NULL,
  guardian_name text NOT NULL,
  guardian_email text NOT NULL,
  guardian_phone text NOT NULL,
  guardian_relationship text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.champion_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY champion_apps_admin_all ON public.champion_applications
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY champion_apps_own_select ON public.champion_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY champion_apps_own_insert ON public.champion_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY champion_apps_own_update ON public.champion_applications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE TRIGGER champion_apps_updated_at
  BEFORE UPDATE ON public.champion_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();