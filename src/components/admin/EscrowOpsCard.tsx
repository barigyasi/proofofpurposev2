import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Row = { status: string; count: number };

const STATES = ["locked", "captured", "settled", "refunded", "cancelled"] as const;

export function EscrowOpsCard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const next: Record<string, number> = {};
    await Promise.all(
      STATES.map(async (s) => {
        const { count } = await supabase
          .from("vendor_charges").select("*", { count: "exact", head: true }).eq("status", s);
        next[s] = count ?? 0;
      }),
    );
    setCounts(next);
  }

  useEffect(() => { refresh(); }, []);

  async function runCron(fn: "vendor-redeem-settle" | "vendor-redeem-sweep") {
    setBusy(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`${fn}: ${JSON.stringify(data).slice(0, 80)}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="brutal p-6">
      <h3 className="font-display text-2xl">ESCROW OPS</h3>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // vendor charge state machine
      </p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {STATES.map((s) => (
          <div key={s} className="border-2 border-foreground p-2 text-center">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">{s}</p>
            <p className="font-display text-2xl text-primary">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => runCron("vendor-redeem-settle")} disabled={busy !== null} className="brutal-primary font-display">
          {busy === "vendor-redeem-settle" ? "RUNNING…" : "RUN SETTLE BATCH"}
        </Button>
        <Button onClick={() => runCron("vendor-redeem-sweep")} disabled={busy !== null} className="brutal-primary font-display">
          {busy === "vendor-redeem-sweep" ? "RUNNING…" : "RUN SWEEP BATCH"}
        </Button>
        <Button variant="ghost" onClick={refresh}>Refresh</Button>
      </div>
    </div>
  );
}
