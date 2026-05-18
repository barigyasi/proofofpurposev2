import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  championName: z.string().trim().min(2).max(120),
  championEmail: z.string().trim().email().max(255),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  school: z.string().trim().min(2).max(160),
  guardianName: z.string().trim().min(2).max(120),
  guardianEmail: z.string().trim().email().max(255),
  guardianPhone: z.string().trim().min(7).max(40),
  guardianRelationship: z.string().trim().min(2).max(60),
  notes: z.string().max(1000).optional(),
});

export default function ApplyChampion() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<{ status: string } | null>(null);
  const [form, setForm] = useState({
    championName: "",
    championEmail: "",
    dateOfBirth: "",
    school: "",
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    guardianRelationship: "",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("champion_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExisting(data);
    })();
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return toast.error(first ?? "Please fill all required fields");
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Enter first");
        return;
      }
      let wallet = account?.address ?? null;
      if (!wallet) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", user.id)
          .maybeSingle();
        wallet = prof?.wallet_address ?? null;
      }
      if (!wallet) {
        toast.error("No wallet on your account — reconnect and try again");
        return;
      }
      const { error } = await supabase.from("champion_applications").insert({
        user_id: user.id,
        wallet_address: wallet,
        champion_name: parsed.data.championName,
        champion_email: parsed.data.championEmail,
        date_of_birth: parsed.data.dateOfBirth,
        school: parsed.data.school,
        guardian_name: parsed.data.guardianName,
        guardian_email: parsed.data.guardianEmail,
        guardian_phone: parsed.data.guardianPhone,
        guardian_relationship: parsed.data.guardianRelationship,
        notes: parsed.data.notes || null,
      });
      if (error) throw error;
      await supabase.from("pending_applicants").insert({
        wallet_address: account.address,
        requested_role: "champion" as never,
        name: parsed.data.championName,
        email: parsed.data.championEmail,
        phone: parsed.data.guardianPhone,
      });
      toast.success("Application submitted — pending verification");
      navigate("/dashboard?as=champion", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="border-b-2 border-foreground pb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// champion application</p>
          <h1 className="mt-2 font-display text-5xl">
            {existing.status === "approved" ? "YOU'RE IN" : existing.status === "rejected" ? "NOT APPROVED" : "PENDING REVIEW"}
          </h1>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {existing.status === "approved"
            ? "You've been verified. Head to your dashboard to start earning $PURPOSE."
            : existing.status === "rejected"
            ? "Your application wasn't approved. Reach out to the team for next steps."
            : "Your application is being reviewed by the team. We'll notify your guardian once you're verified."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// become a champion</p>
        <h1 className="mt-2 font-display text-5xl">CHAMPION SIGNUP</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We need a few details about you and your guardian. The team verifies every champion before unlocking bounties.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <section className="space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-primary">// about you</p>
          <div><Label>Full name *</Label><Input value={form.championName} onChange={(e) => set("championName", e.target.value)} maxLength={120} /></div>
          <div><Label>Your email *</Label><Input type="email" value={form.championEmail} onChange={(e) => set("championEmail", e.target.value)} maxLength={255} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date of birth *</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /></div>
            <div><Label>School *</Label><Input value={form.school} onChange={(e) => set("school", e.target.value)} maxLength={160} /></div>
          </div>
        </section>

        <section className="space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-primary">// guardian info</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Guardian name *</Label><Input value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} maxLength={120} /></div>
            <div><Label>Relationship *</Label><Input value={form.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} placeholder="Mother / Father / etc." maxLength={60} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Guardian email *</Label><Input type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} maxLength={255} /></div>
            <div><Label>Guardian phone *</Label><Input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} maxLength={40} /></div>
          </div>
        </section>

        <section className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-primary">// anything else</p>
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} placeholder="Optional — anything the team should know." />
        </section>

        <Button onClick={submit} disabled={busy} className="brutal-primary brutal-hover w-full font-display">
          {busy ? "SUBMITTING…" : "SUBMIT FOR REVIEW"}
        </Button>
        <p className="font-mono text-[10px] text-muted-foreground">
          // bounties unlock once the team verifies your info with your guardian.
        </p>
      </div>
    </main>
  );
}
