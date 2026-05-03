import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChampionDashboard } from "@/components/champion/ChampionDashboard";
import { useSessionRoles } from "@/hooks/useSessionRoles";

export default function Dashboard() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (roles.includes("admin")) {
      navigate("/admin", { replace: true });
      return;
    }
    if (roles.includes("vendor")) {
      navigate("/vendor", { replace: true });
    }
  }, [session, roles, navigate]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // loading
        </p>
      </main>
    );
  }

  if (!session || roles.includes("admin") || roles.includes("vendor")) {
    return null;
  }

  return <ChampionDashboard />;
}
