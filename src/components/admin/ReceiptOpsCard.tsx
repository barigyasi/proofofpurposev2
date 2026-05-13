import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Pending = {
  id: string;
  vendor_wallet: string;
  champion_wallet: string;
  usdc_payout: number | null;
  settled_at: string | null;
  receipt_error: string | null;
  receipt_token_id: number | null;
  receipt_emailed_at: string | null;
};

export function ReceiptOpsCard() {
  const [stats, setStats] = useState({ minted: 0, missing: 0, failed: 0 });
  const [rows, setRows] = useState<Pending[]>([]);
  const [recent, setRecent] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [emailing, setEmailing] = useState<string | null>(null);

  async function refresh() {
    const [m, missing, failed, list, recentList] = await Promise.all([
      supabase.from("vendor_charges").select("*", { count: "exact", head: true }).not("receipt_token_id", "is", null),
      supabase.from("vendor_charges").select("*", { count: "exact", head: true })
        .eq("status", "settled").is("receipt_token_id", null),
      supabase.from("vendor_charges").select("*", { count: "exact", head: true }).not("receipt_error", "is", null),
      supabase.from("vendor_charges")
        .select("id,vendor_wallet,champion_wallet,usdc_payout,settled_at,receipt_error,receipt_token_id,receipt_emailed_at")
        .eq("status", "settled").is("receipt_token_id", null)
        .order("settled_at", { ascending: false }).limit(20),
      supabase.from("vendor_charges")
        .select("id,vendor_wallet,champion_wallet,usdc_payout,settled_at,receipt_error,receipt_token_id,receipt_emailed_at")
        .not("receipt_token_id", "is", null)
        .order("settled_at", { ascending: false }).limit(10),
    ]);
    setStats({ minted: m.count ?? 0, missing: missing.count ?? 0, failed: failed.count ?? 0 });
    setRows((list.data ?? []) as Pending[]);
    setRecent((recentList.data ?? []) as Pending[]);
  }

  useEffect(() => { refresh(); }, []);

  async function retry(id: string) {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("receipt-mint-retry", { body: { chargeId: id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Receipt #${data.receipt_token_id ?? "—"} minted`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  async function resendEmail(id: string, tokenId: number) {
    setEmailing(id);
    try {
      const { data, error } = await supabase.functions.invoke("receipt-email", {
        body: { tokenId, force: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const sent = (data?.results ?? []).filter((r: any) => r.status === "sent").length;
      const skipped = (data?.results ?? []).filter((r: any) => r.status !== "sent").length;
      toast.success(`Receipt email — sent: ${sent}, other: ${skipped}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setEmailing(null); }
  }

  return (
    <div className="brutal p-6">
      <h3 className="font-display text-2xl">RECEIPT OPS</h3>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // soulbound on-chain receipts
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["minted", stats.minted],
          ["missing", stats.missing],
          ["mint failed", stats.failed],
        ].map(([k, v]) => (
          <div key={k as string} className="border-2 border-foreground p-2 text-center">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">{k as string}</p>
            <p className="font-display text-2xl text-primary">{v as number}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-foreground/20">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</span>
              <span className="font-display text-primary">${(r.usdc_payout ?? 0).toFixed(2)}</span>
              {r.receipt_error && (
                <span className="font-mono text-[10px] text-destructive">{r.receipt_error}</span>
              )}
              <Button size="sm" className="ml-auto brutal-primary font-display"
                      disabled={busy !== null} onClick={() => retry(r.id)}>
                {busy === r.id ? "MINTING…" : "MINT RECEIPT"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">// recent receipts — resend email</p>
          <ul className="mt-2 divide-y divide-foreground/20">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-mono text-[10px] text-primary">#{r.receipt_token_id}</span>
                <span className="font-display text-primary">${(r.usdc_payout ?? 0).toFixed(2)}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {r.receipt_emailed_at ? "emailed" : "not yet emailed"}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto"
                        disabled={emailing !== null}
                        onClick={() => resendEmail(r.id, r.receipt_token_id!)}>
                  {emailing === r.id ? "Sending…" : "Resend email"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
      </div>
    </div>
  );
}
