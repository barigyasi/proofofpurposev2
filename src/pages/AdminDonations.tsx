import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    supabase.from("donations").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Donation[]));
  }, [roles]);

  const total = items.reduce((s, d) => s + Number(d.amount_usdc), 0);

  if (!roles.includes("admin")) return null;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">DONATIONS</h1>
        <p className="mt-2 font-display text-2xl text-primary">${total.toFixed(2)} total</p>
      </div>
      <div className="mt-6 space-y-2">
        {items.map((d) => (
          <div key={d.id} className="brutal flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="font-display text-lg text-primary">${Number(d.amount_usdc).toFixed(2)}</p>
              <AddressLabel address={d.donor_wallet} />
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px]">{d.source}</p>
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
