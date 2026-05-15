import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { TreasuryStat } from "@/components/TreasuryStat";
import { CONTRACTS } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Donation = {
  id: string;
  amount_usdc: number;
  donor_wallet: string;
  champion_referral: string | null;
  source: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
};

function toCsv(rows: Donation[]): string {
  const header = ["created_at", "amount_usdc", "donor_wallet", "champion_referral", "source", "status", "tx_hash"];
  const body = rows.map((r) =>
    header.map((h) => {
      const v = (r as unknown as Record<string, unknown>)[h];
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export default function AdminDonations() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [rows, setRows] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    supabase
      .from("donations")
      .select("id, amount_usdc, donor_wallet, champion_referral, source, status, tx_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data ?? []) as Donation[]);
        setLoading(false);
      });
  }, [roles]);

  function downloadCsv() {
    if (!rows.length) {
      toast.error("No donations to export");
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!roles.includes("admin")) return null;

  const total = rows.filter((r) => r.status === "confirmed").reduce((s, r) => s + Number(r.amount_usdc), 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">DONATIONS</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          live on-chain treasury balance · indexed donation log below
        </p>
      </div>

      <div className="mt-6">
        <TreasuryStat />
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // indexed (last 500) · ${total.toLocaleString("en-US", { maximumFractionDigits: 2 })} confirmed
          </p>
          <h2 className="mt-1 font-display text-3xl">DONATION LOG</h2>
        </div>
        <Button onClick={downloadCsv} className="brutal-primary brutal-hover font-display">
          EXPORT CSV
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="font-mono text-xs text-muted-foreground">// loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center font-mono text-xs text-muted-foreground">
            // no donations indexed yet
          </p>
        ) : (
          <table className="min-w-full border-2 border-foreground font-mono text-xs">
            <thead className="border-b-2 border-foreground bg-muted">
              <tr className="text-left">
                <th className="p-2">When</th>
                <th className="p-2">USDC</th>
                <th className="p-2">Donor</th>
                <th className="p-2">Referral</th>
                <th className="p-2">Source</th>
                <th className="p-2">Status</th>
                <th className="p-2">Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-foreground/30">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 text-primary">${Number(r.amount_usdc).toFixed(2)}</td>
                  <td className="p-2 truncate max-w-[180px]" title={r.donor_wallet}>{r.donor_wallet}</td>
                  <td className="p-2 truncate max-w-[120px]" title={r.champion_referral ?? ""}>{r.champion_referral ?? "—"}</td>
                  <td className="p-2">{r.source}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">
                    {r.tx_hash ? (
                      <a
                        href={`https://basescan.org/tx/${r.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // for the full transaction history, view the treasury on basescan ↗
      </p>
      <a
        href={`https://basescan.org/address/${CONTRACTS.TREASURY}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block break-all font-mono text-xs text-primary underline"
      >
        {CONTRACTS.TREASURY}
      </a>
    </main>
  );
}
