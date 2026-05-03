import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Applicant = {
  id: string;
  wallet_address: string;
  requested_role: "admin" | "vendor" | "catalyst" | "champion";
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type ChampionApp = {
  champion_name: string;
  champion_email: string | null;
  date_of_birth: string;
  school: string;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_relationship: string;
  notes: string | null;
};

type VendorDetail = {
  business_name: string;
  category: string | null;
  description: string | null;
  contact_email: string | null;
  phone: string | null;
  logo_url: string | null;
  w9_url: string | null;
};

type CatalystDetail = {
  org_name: string;
  mission: string | null;
  website: string | null;
  contact_email: string | null;
  location: string | null;
  logo_url: string | null;
};

export default function AdminApplicants() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [items, setItems] = useState<Applicant[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ChampionApp | VendorDetail | CatalystDetail | null>>({});

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

  async function loadDetails(a: Applicant) {
    if (details[a.id] !== undefined) return;
    let d: ChampionApp | VendorDetail | CatalystDetail | null = null;
    if (a.requested_role === "champion") {
      const { data } = await supabase
        .from("champion_applications")
        .select("champion_name,champion_email,date_of_birth,school,guardian_name,guardian_email,guardian_phone,guardian_relationship,notes")
        .ilike("wallet_address", a.wallet_address)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      d = data as ChampionApp | null;
    } else if (a.requested_role === "vendor") {
      const { data } = await supabase
        .from("vendors")
        .select("business_name,category,description,contact_email,phone,logo_url,w9_url")
        .ilike("wallet_address", a.wallet_address)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      d = data as VendorDetail | null;
    } else if (a.requested_role === "catalyst") {
      const { data } = await supabase
        .from("catalyst_orgs")
        .select("org_name,mission,website,contact_email,location,logo_url")
        .ilike("wallet_address", a.wallet_address)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      d = data as CatalystDetail | null;
    }
    setDetails((m) => ({ ...m, [a.id]: d }));
  }

  function toggle(a: Applicant) {
    const next = openId === a.id ? null : a.id;
    setOpenId(next);
    if (next) loadDetails(a);
  }

  async function approve(a: Applicant) {
    setBusyId(a.id);
    try {
      const fn =
        a.requested_role === "catalyst" ? "grant-catalyst-role"
        : a.requested_role === "vendor" ? "grant-vendor-role"
        : a.requested_role === "champion" ? "grant-champion-role"
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
        ) : items.map((a) => {
          const open = openId === a.id;
          const d = details[a.id];
          return (
            <div key={a.id} className="brutal p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase text-primary">{a.requested_role}</p>
                  <p className="font-display text-lg">{a.name ?? "—"}</p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">{a.wallet_address}</p>
                  {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => toggle(a)}>
                    {open ? "HIDE" : "VIEW"}
                  </Button>
                  <Button variant="ghost" disabled={busyId === a.id} onClick={() => reject(a)}>REJECT</Button>
                  <Button
                    disabled={busyId === a.id}
                    onClick={() => approve(a)}
                    className="brutal-primary brutal-hover font-display"
                  >
                    {busyId === a.id ? "…" : "APPROVE"}
                  </Button>
                </div>
              </div>

              {open && (
                <div className="mt-4 border-t border-border pt-4 text-sm">
                  {d === undefined ? (
                    <p className="font-mono text-[10px] text-muted-foreground">// loading…</p>
                  ) : d === null ? (
                    <p className="font-mono text-[10px] text-muted-foreground">// no detailed application found</p>
                  ) : a.requested_role === "champion" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Champion" value={(d as ChampionApp).champion_name} />
                      <Field label="Champion email" value={(d as ChampionApp).champion_email ?? "—"} />
                      <Field label="Date of birth" value={(d as ChampionApp).date_of_birth} />
                      <Field label="School" value={(d as ChampionApp).school} />
                      <Field label="Guardian" value={`${(d as ChampionApp).guardian_name} (${(d as ChampionApp).guardian_relationship})`} />
                      <Field label="Guardian email" value={(d as ChampionApp).guardian_email} />
                      <Field label="Guardian phone" value={(d as ChampionApp).guardian_phone} />
                      {(d as ChampionApp).notes && (
                        <div className="sm:col-span-2"><Field label="Notes" value={(d as ChampionApp).notes!} /></div>
                      )}
                    </div>
                  ) : a.requested_role === "vendor" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Business" value={(d as VendorDetail).business_name} />
                      <Field label="Category" value={(d as VendorDetail).category ?? "—"} />
                      <Field label="Email" value={(d as VendorDetail).contact_email ?? "—"} />
                      <Field label="Phone" value={(d as VendorDetail).phone ?? "—"} />
                      <div className="sm:col-span-2"><Field label="Description" value={(d as VendorDetail).description ?? "—"} /></div>
                      {(d as VendorDetail).w9_url && (
                        <a href={(d as VendorDetail).w9_url!} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-primary underline">
                          view W-9 →
                        </a>
                      )}
                    </div>
                  ) : a.requested_role === "catalyst" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Org" value={(d as CatalystDetail).org_name} />
                      <Field label="Location" value={(d as CatalystDetail).location ?? "—"} />
                      <Field label="Email" value={(d as CatalystDetail).contact_email ?? "—"} />
                      <Field label="Website" value={(d as CatalystDetail).website ?? "—"} />
                      <div className="sm:col-span-2"><Field label="Mission" value={(d as CatalystDetail).mission ?? "—"} /></div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm break-words">{value}</p>
    </div>
  );
}

