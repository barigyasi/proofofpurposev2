import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { uploadPublicImage } from "@/lib/storage";

export default function ApplyCatalyst() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail((e) => e || data.user!.email!);
    });
  }, []);

  async function submit() {
    if (!account) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!orgName) {
      toast.error("Org name required");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in first");
        return;
      }
      let logo_url: string | null = null;
      if (logo) logo_url = await uploadPublicImage("avatars", logo, "catalysts");

      const { error: orgErr } = await supabase.from("catalyst_orgs").insert({
        user_id: user.id,
        wallet_address: account.address,
        org_name: orgName,
        mission,
        website,
        contact_email: email,
        location,
        logo_url,
      });
      if (orgErr) throw orgErr;

      await supabase.from("pending_applicants").insert({
        wallet_address: account.address,
        requested_role: "catalyst" as never,
        name: orgName,
        email,
      });

      toast.success("Application submitted — awaiting admin approval");
      navigate("/catalyst", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // become a catalyst
        </p>
        <h1 className="mt-2 font-display text-5xl">PARTNER ORG SIGNUP</h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Catalysts represent youth-serving orgs. You can propose bounties; the DAO (donors +
          admins + catalysts) votes to approve them.
        </p>
      </div>
      <div className="mt-6 space-y-4">
        <div><Label>Org name *</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} maxLength={120} /></div>
        <div><Label>Mission</Label><Textarea value={mission} onChange={(e) => setMission(e.target.value)} maxLength={1000} rows={3} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} /></div>
          <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></div>
        </div>
        <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></div>
        <div><Label>Logo</Label><Input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></div>
        <Button onClick={submit} disabled={busy} className="brutal-primary brutal-hover w-full font-display">
          {busy ? "SUBMITTING…" : "SUBMIT APPLICATION"}
        </Button>
      </div>
    </main>
  );
}
