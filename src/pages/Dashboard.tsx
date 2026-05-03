import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChampionDashboard } from "@/components/champion/ChampionDashboard";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const explicitChampion = params.get("as") === "champion";
  const { session, roles, isAdminPreview, isLoading } = useEffectiveRoles();
  const [appStatus, setAppStatus] = useState<"loading" | "none" | "pending" | "approved" | "rejected">("loading");
  const [pendingOther, setPendingOther] = useState<"vendor" | "catalyst" | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (roles.includes("admin")) return navigate("/admin", { replace: true });
    if (roles.includes("vendor")) return navigate("/vendor", { replace: true });
    if (roles.includes("catalyst")) return navigate("/catalyst", { replace: true });
    if (pendingOther === "vendor") return navigate("/vendor", { replace: true });
    if (pendingOther === "catalyst") return navigate("/catalyst", { replace: true });
    if (!explicitChampion && roles.length === 0 && appStatus === "none" && pendingOther === null && !isAdminPreview) {
      navigate("/onboarding", { replace: true });
    }
  }, [isLoading, session, roles, navigate, explicitChampion, appStatus, pendingOther, isAdminPreview]);

  // Look up champion application status
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data } = await supabase
        .from("champion_applications")
        .select("status")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAppStatus(data ? (data.status as "pending" | "approved" | "rejected") : "none");
    })();
  }, [session?.user?.id]);

  if (isLoading || appStatus === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// loading</p>
      </main>
    );
  }

  if (!session || roles.includes("admin") || roles.includes("vendor") || roles.includes("catalyst")) {
    return null;
  }

  // Champion role granted (or admin previewing as champion) → show full dashboard
  if (roles.includes("champion") || isAdminPreview) return <ChampionDashboard />;

  // Has a submitted application but no role yet
  if (appStatus === "pending" || appStatus === "rejected") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// champion access</p>
        <h1 className="mt-3 font-display text-5xl">
          {appStatus === "pending" ? "PENDING REVIEW" : "NOT APPROVED"}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {appStatus === "pending"
            ? "The team is verifying your info with your guardian. Bounties unlock once you're approved."
            : "Your application wasn't approved. Reach out to the team for next steps."}
        </p>
      </main>
    );
  }

  // No application yet — push to apply
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// champion access</p>
      <h1 className="mt-3 font-display text-5xl">FINISH SIGNUP</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        We need a bit more info before unlocking bounties.
      </p>
      <Link to="/apply/champion" className="brutal-primary brutal-hover mt-6 inline-block px-6 py-3 font-display">
        START CHAMPION SIGNUP →
      </Link>
    </main>
  );
}

