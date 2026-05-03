import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Org = {
  id: string;
  org_name: string;
  mission: string | null;
  contact_email: string | null;
  wallet_address: string;
  approved: boolean;
  logo_url: string | null;
};

export default function AdminCatalysts() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [items, setItems] = useState<Org[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  async function load() {
    const { data } = await supabase.from("catalyst_orgs").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Org[]);
  }
  useEffect(() => { if (roles.includes("admin")) load(); }, [roles]);

  async function approve(o: Org) {
    setBusy(o.id);
    try {
      const { error } = await supabase.functions.invoke("grant-catalyst-role", {
        body: { walletAddress: o.wallet_address },
      });
      if (error) throw new Error(error.message);
      toast.success("Catalyst approved");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (!roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">CATALYSTS</h1>
      </div>
      <div className="mt-8 space-y-3">
        {items.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">// no orgs yet</p>
        ) : items.map((o) => (
          <div key={o.id} className="brutal flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              {o.logo_url && <img src={o.logo_url} className="h-12 w-12 border-2 border-foreground object-cover" alt="" />}
              <div>
                <p className="font-mono text-[10px] uppercase text-primary">
                  {o.approved ? "approved" : "pending"}
                </p>
                <p className="font-display text-lg">{o.org_name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{o.wallet_address}</p>
                {o.mission && <p className="mt-1 max-w-md text-xs text-muted-foreground">{o.mission}</p>}
              </div>
            </div>
            {!o.approved && (
              <Button onClick={() => approve(o)} disabled={busy === o.id} className="brutal-primary brutal-hover font-display">
                {busy === o.id ? "…" : "APPROVE"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
