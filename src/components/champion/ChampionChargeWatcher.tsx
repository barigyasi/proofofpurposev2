import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chargeMessage, settleCharge } from "@/lib/vendorCharges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSilentRedemptionApprove } from "@/hooks/useSilentRedemptionApprove";
import { V2_LIVE } from "@/config/contracts";

interface Charge {
  id: string;
  vendor_wallet: string;
  champion_wallet: string;
  purpose_amount_wei: string;
  memo: string | null;
  nonce: string;
  status: string;
  expires_at: string;
}

/**
 * Listens for pending vendor charges addressed to the active champion wallet
 * and pops a confirm dialog. On confirm the champion signs the canonical
 * message; the backend then settles on-chain via redeemFor().
 */
export function ChampionChargeWatcher() {
  const account = useActiveAccount();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [busy, setBusy] = useState(false);

  useSilentRedemptionApprove();

  useEffect(() => {
    if (!account) return;
    const wallet = account.address.toLowerCase();
    let active = true;

    // Pick up any unhandled pending charge on load.
    (async () => {
      const { data } = await supabase
        .from("vendor_charges")
        .select("*")
        .ilike("champion_wallet", wallet)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) setCharge(data as unknown as Charge);
    })();

    const channel = supabase
      .channel(`charges-${wallet}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vendor_charges" },
        (payload) => {
          const c = payload.new as unknown as Charge;
          if (c.champion_wallet?.toLowerCase() === wallet && c.status === "pending") {
            setCharge(c);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [account]);

  if (!charge || !account) return null;

  const purpose = Number(BigInt(charge.purpose_amount_wei) / 10n ** 14n) / 1e4;

  async function reject() {
    if (!charge) return;
    await supabase.from("vendor_charges").update({ status: "rejected" }).eq("id", charge.id);
    setCharge(null);
  }

  async function confirm() {
    if (!charge || !account) return;
    if (!V2_LIVE) {
      toast.error("Redemptions are temporarily offline — V2 not yet configured");
      return;
    }
    setBusy(true);
    try {
      const message = chargeMessage(charge);
      const signature = await account.signMessage({ message });
      const { error: updErr } = await supabase
        .from("vendor_charges")
        .update({ status: "confirmed", champion_signature: signature })
        .eq("id", charge.id);
      if (updErr) throw updErr;
      const res = await settleCharge(charge.id);
      toast.success(`Authorized $${res.usdc_amount.toFixed(2)} — vendor will be paid after the hold period`);
      setCharge(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) setCharge(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm payment</DialogTitle>
          <DialogDescription>
            A vendor is requesting <span className="font-display text-primary">{purpose} $PURPOSE</span>
            {charge.memo ? <> for <em>{charge.memo}</em></> : null}.
          </DialogDescription>
        </DialogHeader>
        <p className="break-all font-mono text-[10px] text-muted-foreground">
          vendor: {charge.vendor_wallet}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={reject} disabled={busy}>Reject</Button>
          <Button onClick={confirm} disabled={busy} className="brutal-primary brutal-hover font-display">
            {busy ? "PAYING…" : "CONFIRM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
