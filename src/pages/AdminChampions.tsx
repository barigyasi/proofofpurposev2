import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AddressLabel } from "@/components/AddressLabel";

type App = {
  id: string;
  user_id: string;
  wallet_address: string;
  champion_name: string;
  date_of_birth: string;
  school: string;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_relationship: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export default function AdminChampions() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [items, setItems] = useState<App[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  async function load() {
    const { data } = await supabase
      .from("champion_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as App[]);
  }
  useEffect(() => { if (roles.includes("admin")) load(); }, [roles]);

  async function approve(a: App) {
    setBusy(a.id);
    try {
      const { error } = await supabase.functions.invoke("grant-champion-role", {
        body: { walletAddress: a.wallet_address, applicationId: a.id },
      });
      if (error) throw new Error(error.message);
      toast.success(`${a.champion_name} approved`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject(a: App) {
    setBusy(a.id);
    await supabase
      .from("champion_applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", a.id);
    setBusy(null);
    load();
  }

  if (!roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">CHAMPIONS</h1>
        <p className="mt-2 text-sm text-muted-foreground">Verify guardian + school info before granting access.</p>
      </div>
      <div className="mt-8 space-y-3">
        {items.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">// no pending champions</p>
        ) : items.map((a) => (
          <div key={a.id} className="brutal p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase text-primary">champion</p>
                <p className="font-display text-xl">{a.champion_name}</p>
                <p className="text-xs text-muted-foreground">DOB: {a.date_of_birth} · School: {a.school}</p>
                <AddressLabel address={a.wallet_address} className="break-all" />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={busy === a.id} onClick={() => reject(a)}>REJECT</Button>
                <Button disabled={busy === a.id} onClick={() => approve(a)} className="brutal-primary brutal-hover font-display">
                  {busy === a.id ? "…" : "APPROVE"}
                </Button>
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">guardian</p>
              <p>{a.guardian_name} <span className="text-muted-foreground">({a.guardian_relationship})</span></p>
              <p className="text-muted-foreground">{a.guardian_email} · {a.guardian_phone}</p>
              {a.notes && <p className="mt-2 text-xs text-muted-foreground">"{a.notes}"</p>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
