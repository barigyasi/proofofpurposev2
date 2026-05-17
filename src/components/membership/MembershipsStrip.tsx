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
  edition_id: string | null;
  edition?: { name: string; image_url: string } | null;
};

export function MembershipsStrip({ wallet }: { wallet?: string }) {
  const [items, setItems] = useState<Mint[]>([]);

  useEffect(() => {
    if (!wallet) return;
    (async () => {
      const { data: mints } = await supabase
        .from("membership_mints")
        .select("*")
        .ilike("donor_wallet", wallet)
        .order("month_key", { ascending: false });
      const rows = (mints ?? []) as Mint[];
      const editionIds = Array.from(
        new Set(rows.map((r) => r.edition_id).filter(Boolean) as string[]),
      );
      let editions: Record<string, { name: string; image_url: string }> = {};
      if (editionIds.length) {
        const { data: eds } = await supabase
          .from("membership_editions")
          .select("id, name, image_url")
          .in("id", editionIds);
        editions = Object.fromEntries(
          (eds ?? []).map((e) => [e.id, { name: e.name, image_url: e.image_url }]),
        );
      }
      setItems(
        rows.map((r) => ({
          ...r,
          edition: r.edition_id ? editions[r.edition_id] ?? null : null,
        })),
      );
    })();
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
        {items.map((m) => {
          const img = m.edition?.image_url ?? membershipDataUri(m.donor_wallet, m.month_key, 180);
          const title = m.edition?.name ?? monthLabel(m.month_key);
          return (
            <div key={m.id} className="brutal min-w-[180px] p-3">
              <img
                src={img}
                alt={`${title} membership`}
                className="aspect-square w-full object-cover"
              />
              <p className="mt-2 font-display text-sm">{title}</p>
              <p className="font-mono text-[9px] uppercase text-muted-foreground">
                {monthLabel(m.month_key)} · {m.status === "minted" ? "on-chain" : m.status.replace("_", " ")}
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
          );
        })}
      </div>
    </section>
  );
}
