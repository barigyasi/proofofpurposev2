import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { membershipDataUri, monthLabel } from "@/lib/membershipArt";
import { SelfDelegateButton } from "@/components/membership/SelfDelegateButton";

type Mint = {
  id: string;
  donor_wallet: string;
  month_key: number;
  token_id: number | null;
  tx_hash: string | null;
  status: string;
};

export function MembershipsStrip({ wallet }: { wallet?: string }) {
  const [items, setItems] = useState<Mint[]>([]);

  useEffect(() => {
    if (!wallet) return;
    supabase
      .from("membership_mints")
      .select("*")
      .ilike("donor_wallet", wallet)
      .order("month_key", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Mint[]));
  }, [wallet]);

  if (!wallet || items.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // your monthly memberships
        </p>
        <SelfDelegateButton className="h-8 px-3 text-xs" />
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {items.map((m) => (
          <div key={m.id} className="brutal min-w-[180px] p-3">
            <img
              src={membershipDataUri(m.donor_wallet, m.month_key, 180)}
              alt={`${monthLabel(m.month_key)} membership`}
              className="w-full"
            />
            <p className="mt-2 font-display text-sm">{monthLabel(m.month_key)}</p>
            <p className="font-mono text-[9px] uppercase text-muted-foreground">
              {m.status === "minted" ? "on-chain" : m.status.replace("_", " ")}
            </p>
            {m.tx_hash && (
              <a
                href={`https://basescan.org/tx/${m.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[9px] text-primary underline"
              >
                tx ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
