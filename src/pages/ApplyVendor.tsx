import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { uploadPublicImage, uploadPrivate } from "@/lib/storage";

export default function ApplyVendor() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [w9, setW9] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail((e) => e || data.user!.email!);
    });
  }, []);

  async function submit() {
    if (!account) return toast.error("Connect wallet first");
    if (!name) return toast.error("Business name required");
    setBusy(true);
    try {
      let logo_url: string | null = null;
      let w9_url: string | null = null;
      if (logo) logo_url = await uploadPublicImage("avatars", logo, "vendors");
      if (w9) w9_url = await uploadPrivate("vendor-documents", w9, "w9");

      const { error } = await supabase.from("vendors").insert({
        wallet_address: account.address,
        business_name: name,
        contact_email: email,
        phone,
        category,
        description,
        logo_url,
        w9_url,
      });
      if (error) throw error;

      await supabase.from("pending_applicants").insert({
        wallet_address: account.address,
        requested_role: "vendor" as never,
        name,
        email,
        phone,
      });

      toast.success("Application submitted — awaiting admin approval");
      navigate("/vendor", { replace: true });
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
          // become a vendor
        </p>
        <h1 className="mt-2 font-display text-5xl">VENDOR SIGNUP</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Approved vendors accept $PURPOSE from champions and redeem it for USDC.
        </p>
      </div>
      <div className="mt-6 space-y-4">
        <div><Label>Business name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Food / Apparel / Services" /></div>
        <div><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Logo</Label><Input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></div>
          <div><Label>W-9 (PDF)</Label><Input type="file" accept="application/pdf" onChange={(e) => setW9(e.target.files?.[0] ?? null)} /></div>
        </div>
        <Button onClick={submit} disabled={busy} className="brutal-primary brutal-hover w-full font-display">
          {busy ? "SUBMITTING…" : "SUBMIT APPLICATION"}
        </Button>
      </div>
    </main>
  );
}
