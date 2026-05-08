import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AddressLabel } from "@/components/AddressLabel";

type Donation = {
  id: string;
  donor_wallet: string;
  amount_usdc: number;
  source: string;
  tx_hash: string | null;
  created_at: string;
};

export default function AdminDonations() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [items, setItems] = useState<Donation[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Donation[]);
  }, []);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    refresh();
  }, [roles, refresh]);

  async function syncFromChain() {
    if (syncing) return;
    setSyncing(true);
    const t = toast.loading("Scanning Base for new donations…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-donations", { body: {} });
      if (error) throw error;
      toast.success(`Synced. ${data?.inserted ?? 0} new donation(s) recorded.`, { id: t });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed", { id: t });
    } finally {
      setSyncing(false);
    }
  }

  const total = items.reduce((s, d) => s + Number(d.amount_usdc), 0);

  if (!roles.includes("admin")) return null;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 border-b-2 border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
          <h1 className="mt-2 font-display text-5xl">DONATIONS</h1>
          <p className="mt-2 font-display text-2xl text-primary">${total.toFixed(2)} total</p>
        </div>
        <Button
          onClick={syncFromChain}
          disabled={syncing}
          className="brutal-primary brutal-hover h-auto px-5 py-3 font-display"
        >
          {syncing ? "SYNCING…" : "SYNC FROM CHAIN"}
        </Button>
      </div>
      <div className="mt-6 space-y-2">
        {items.length === 0 && (
          <div className="brutal p-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // no donations yet — try SYNC FROM CHAIN
          </div>
        )}
        {items.map((d) => (
          <div key={d.id} className="brutal flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="font-display text-lg text-primary">${Number(d.amount_usdc).toFixed(2)}</p>
              <AddressLabel address={d.donor_wallet} />
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase">{d.source}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {new Date(d.created_at).toLocaleString()}
              </p>
              {d.tx_hash && (
                <a target="_blank" rel="noreferrer" className="font-mono text-[10px] text-primary underline"
                   href={`https://basescan.org/tx/${d.tx_hash}`}>tx ↗</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
