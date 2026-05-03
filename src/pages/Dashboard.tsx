import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ChampionDashboard } from "@/components/champion/ChampionDashboard";

export default function Dashboard() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setRoles([]);
      return;
    }
    setRoles(null);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }) => setRoles((data ?? []).map((r) => r.role as string)));
  }, [session]);

  if (session === undefined || roles === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // loading
        </p>
      </main>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (roles.includes("vendor")) return <Navigate to="/vendor" replace />;
  return <ChampionDashboard />;
}
