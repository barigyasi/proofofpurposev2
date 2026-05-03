import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Applicant = {
  id: string;
  wallet_address: string;
  requested_role: "admin" | "vendor" | "catalyst";
  name: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

export default function AdminApplicants() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [items, setItems] = useState<Applicant[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  async function load() {
    const { data } = await supabase
      .from("pending_applicants")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Applicant[]);
  }
  useEffect(() => { if (roles.includes("admin")) load(); }, [roles]);

  async function approve(a: Applicant) {
    setBusyId(a.id);
    try {
      const fn =
        a.requested_role === "catalyst"
          ? "grant-catalyst-role"
          : a.requested_role === "vendor"
          ? "grant-vendor-role"
          : "grant-admin";
      const { error } = await supabase.functions.invoke(fn, {
        body: { walletAddress: a.wallet_address },
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("pending_applicants")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", a.id);
      toast.success(`${a.requested_role} approved`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(a: Applicant) {
    setBusyId(a.id);
    await supabase
      .from("pending_applicants")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", a.id);
    setBusyId(null);
    load();
  }

  if (!roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">APPLICANTS</h1>
      </div>
      <div className="mt-8 space-y-3">
        {items.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">// no pending applicants</p>
        ) : items.map((a) => (
          <div key={a.id} className="brutal flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-primary">{a.requested_role}</p>
              <p className="font-display text-lg">{a.name ?? "—"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{a.wallet_address}</p>
              {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={busyId === a.id} onClick={() => reject(a)}>
                REJECT
              </Button>
              <Button
                disabled={busyId === a.id}
                onClick={() => approve(a)}
                className="brutal-primary brutal-hover font-display"
              >
                {busyId === a.id ? "…" : "APPROVE"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
