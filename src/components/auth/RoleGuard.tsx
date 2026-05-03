import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  role?: AppRole;
  anyOf?: AppRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

/** Server-validated role gate. Calls public.has_role / has_any_role under the user's session. */
export function RoleGuard({ role, anyOf, fallback = null, children }: RoleGuardProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setAllowed(false);
        return;
      }
      if (anyOf?.length) {
        const { data, error } = await supabase.rpc("has_any_role", {
          _user_id: user.id,
          _roles: anyOf,
        });
        if (!cancelled) setAllowed(!error && !!data);
      } else if (role) {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: role,
        });
        if (!cancelled) setAllowed(!error && !!data);
      } else {
        if (!cancelled) setAllowed(true);
      }
    }
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [role, JSON.stringify(anyOf)]);

  if (allowed === null) return null;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
