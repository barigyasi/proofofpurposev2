import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type AppRole = Database["public"]["Enums"]["app_role"];

export function useSessionRoles() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [roles, setRoles] = useState<AppRole[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setAuthReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!authReady) return;
    if (!session) {
      setRoles([]);
      return;
    }

    setRoles(undefined);

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setRoles([]);
          return;
        }
        setRoles((data ?? []).map((row) => row.role as AppRole));
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user.id]);

  return {
    session,
    roles: roles ?? [],
    isLoading: !authReady || (!!session && roles === undefined),
  };
}