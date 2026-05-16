import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";

type Vendor = {
  id: string;
  business_name: string;
  description: string | null;
  category: string | null;
  logo_url: string | null;
  wallet_address: string;
};

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("vendors_public_view" as never)
      .select("id, business_name, description, category, logo_url, wallet_address")
      .order("business_name")
      .then(({ data }) => {
        setVendors(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Seo
        title="Vendors — Proof of Purpose"
        description="Approved local businesses where Champions can spend $PURPOSE tokens. Every redemption settles 1:1 in USDC, verifiable on-chain."
        path="/vendors"
      />
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // approved vendors
        </p>
        <h1 className="mt-2 font-display text-5xl">SPEND<br /><span className="text-primary">$PURPOSE</span></h1>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="font-mono text-xs text-muted-foreground">// loading…</p>
        ) : vendors.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">// no approved vendors yet</p>
        ) : (
          vendors.map((v) => (
            <div key={v.id} className="brutal p-5">
              {v.logo_url && (
                <img src={v.logo_url} alt={v.business_name} className="mb-3 h-20 w-20 border-2 border-foreground object-cover" />
              )}
              <h3 className="font-display text-2xl">{v.business_name}</h3>
              {v.category && (
                <p className="mt-1 font-mono text-[10px] uppercase text-primary">{v.category}</p>
              )}
              {v.description && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{v.description}</p>
              )}
              <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground">
                {v.wallet_address}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
