import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { TreasuryStat } from "@/components/TreasuryStat";
import { CONTRACTS } from "@/config/contracts";

export default function AdminDonations() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  if (!roles.includes("admin")) return null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">DONATIONS</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          live on-chain treasury balance · same number shown on the landing page
        </p>
      </div>

      <div className="mt-6">
        <TreasuryStat />
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // for the full transaction history, view the treasury on basescan ↗
      </p>
      <a
        href={`https://basescan.org/address/${CONTRACTS.TREASURY}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block font-mono text-xs text-primary underline break-all"
      >
        {CONTRACTS.TREASURY}
      </a>
    </main>
  );
}
