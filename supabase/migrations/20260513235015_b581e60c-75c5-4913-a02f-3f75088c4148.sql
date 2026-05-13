
-- Trigger function: notify admin on new profile (new wallet)
CREATE OR REPLACE FUNCTION public.tg_notify_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://szlnvjzluzplpvzigboo.supabase.co/functions/v1/admin-notify',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'kind', 'profile',
      'record', jsonb_build_object(
        'wallet_address', NEW.wallet_address,
        'display_name', NEW.display_name,
        'username', NEW.username,
        'email', NEW.email,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block insert on notification failure
END;
$$;

DROP TRIGGER IF EXISTS profiles_admin_notify ON public.profiles;
CREATE TRIGGER profiles_admin_notify
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_profile();

-- Trigger function: notify admin on new waitlist signup
CREATE OR REPLACE FUNCTION public.tg_notify_new_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://szlnvjzluzplpvzigboo.supabase.co/functions/v1/admin-notify',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'kind', 'waitlist',
      'record', jsonb_build_object(
        'name', NEW.name,
        'city', NEW.city,
        'email', NEW.email,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waitlist_admin_notify ON public.waitlist_signups;
CREATE TRIGGER waitlist_admin_notify
AFTER INSERT ON public.waitlist_signups
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_waitlist();
