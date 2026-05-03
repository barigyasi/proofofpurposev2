import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  kind: "bounty" | "redemption" | "vendor" | "donation";
  ts: string;
  label: string;
  meta: string;
  tx?: string | null;
};

export default function AdminAudit() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    (async () => {
      const [b, r, v, d] = await Promise.all([
        supabase.from("bounties").select("title, on_chain_tx_hash, created_at, reward_amount").order("created_at", { ascending: false }).limit(50),
        supabase.from("vendor_redemptions").select("vendor_wallet, champion_wallet, usdc_payout, tx_hash, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("vendors").select("business_name, approved_tx_hash, updated_at").eq("approved", true).order("updated_at", { ascending: false }).limit(50),
        supabase.from("donations").select("donor_wallet, amount_usdc, tx_hash, created_at").order("created_at", { ascending: false }).limit(50),
      ]);
      const all: Row[] = [];
      b.data?.forEach((x) => all.push({ kind: "bounty", ts: x.created_at, label: `Bounty: ${x.title}`, meta: `${x.reward_amount} PURPOSE`, tx: x.on_chain_tx_hash }));
      r.data?.forEach((x) => all.push({ kind: "redemption", ts: x.created_at, label: `Redemption ${x.usdc_payout} USDC`, meta: `${x.champion_wallet.slice(0,8)}… → ${x.vendor_wallet.slice(0,8)}…`, tx: x.tx_hash }));
      v.data?.forEach((x) => all.push({ kind: "vendor", ts: x.updated_at, label: `Vendor approved: ${x.business_name}`, meta: "", tx: x.approved_tx_hash }));
      d.data?.forEach((x) => all.push({ kind: "donation", ts: x.created_at, label: `Donation $${x.amount_usdc}`, meta: x.donor_wallet, tx: x.tx_hash }));
      all.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
      setRows(all);
    })();
  }, [roles]);

  if (!roles.includes("admin")) return null;
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">AUDIT LOG</h1>
      </div>
      <div className="mt-6 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="brutal flex items-center justify-between gap-3 p-3">
            <div>
              <p className="font-mono text-[10px] uppercase text-primary">{r.kind}</p>
              <p className="font-display">{r.label}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{r.meta}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] text-muted-foreground">{new Date(r.ts).toLocaleString()}</p>
              {r.tx && (
                <a target="_blank" rel="noreferrer" className="font-mono text-[10px] text-primary underline"
                  href={`https://basescan.org/tx/${r.tx}`}>tx ↗</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
