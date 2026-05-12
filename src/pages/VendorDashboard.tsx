import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { PURPOSE_DECIMALS, V2_LIVE } from "@/config/contracts";
import { QRScanner } from "@/components/vendor/QRScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useVendorApplication } from "@/hooks/useApplicationStatus";
import { VendorChargesHistory } from "@/components/vendor/VendorChargesHistory";

type Scanned = { wallet: string; expires_at: number; signature: string };

type ChargeRow = {
  id: string;
  status: string;
  tx_hash: string | null;
  usdc_payout: number | null;
  error: string | null;
};

export default function VendorDashboard() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const { session, roles, isLoading } = useEffectiveRoles();
  const { status: appStatus, businessName } = useVendorApplication(account?.address);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingCharge, setPendingCharge] = useState<ChargeRow | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isApproved = roles.includes("vendor");
  const isPending = !isApproved && appStatus === "pending";

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (appStatus === "loading") return;
    if (!isApproved && appStatus === "none") {
      navigate("/apply/vendor", { replace: true });
    }
  }, [isLoading, session, isApproved, appStatus, navigate]);

  // Subscribe to status changes on the active charge.
  useEffect(() => {
    if (!pendingCharge) return;
    const channel = supabase
      .channel(`charge-${pendingCharge.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vendor_charges", filter: `id=eq.${pendingCharge.id}` },
        (payload) => {
          const row = payload.new as unknown as ChargeRow;
          setPendingCharge(row);
          if (row.status === "settled") {
            toast.success(`Paid · $${row.usdc_payout?.toFixed(2)} USDC`);
            setTimeout(() => {
              setPendingCharge(null);
              setScanned(null);
              setAmount("");
              setMemo("");
            }, 2000);
          } else if (row.status === "rejected") {
            toast.error("Champion rejected the charge");
          } else if (row.status === "failed" || row.status === "expired") {
            toast.error(row.error ?? `Charge ${row.status}`);
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [pendingCharge?.id]);

  if (isLoading || !session) return null;

  function handleResult(raw: string) {
    setScanning(false);
    try {
      const parsed = JSON.parse(raw) as Scanned;
      if (!parsed.wallet || !parsed.signature || !parsed.expires_at) throw new Error("bad payload");
      if (parsed.expires_at < Date.now()) {
        toast.error("QR expired — ask champion to refresh");
        return;
      }
      setScanned(parsed);
    } catch {
      toast.error("Invalid QR");
    }
  }

  async function createCharge() {
    if (!account || !scanned || !amount) return;
    if (!V2_LIVE) {
      toast.error("Redemptions are temporarily offline — V2 not yet configured");
      return;
    }
    setBusy(true);
    try {
      // Verify champion presence (signature on the QR nonce).
      const { error: verifyErr } = await supabase.functions.invoke("vendor-redeem-verify", {
        body: scanned,
      });
      if (verifyErr) throw new Error(verifyErr.message);

      const wei = BigInt(Math.floor(Number(amount) * 10 ** PURPOSE_DECIMALS));
      const nonce = crypto.randomUUID();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: row, error } = await supabase
        .from("vendor_charges")
        .insert({
          vendor_wallet: account.address,
          vendor_user_id: user?.id ?? null,
          champion_wallet: scanned.wallet,
          purpose_amount_wei: wei.toString() as never,
          memo: memo || null,
          nonce,
        })
        .select()
        .single();
      if (error) throw error;

      setPendingCharge(row as unknown as ChargeRow);
      toast.message("Sent to champion — awaiting confirmation");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCharge() {
    if (!pendingCharge) return;
    await supabase.from("vendor_charges").update({ status: "expired" }).eq("id", pendingCharge.id);
    setPendingCharge(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // vendor terminal
        </p>
        <h1 className="mt-2 font-display text-5xl">REDEEM<br /><span className="text-primary">$PURPOSE</span></h1>
      </div>

      {isPending ? (
        <div className="brutal mt-8 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// pending approval</p>
          <h2 className="mt-2 font-display text-3xl">{businessName ?? "Your business"}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your vendor application is in review. Once approved, this terminal unlocks
            so you can scan champion QR codes and accept $PURPOSE.
          </p>
          <Button disabled className="brutal-primary mt-6 w-full font-display text-2xl py-8 opacity-50 cursor-not-allowed">
            SCAN CHAMPION QR · LOCKED
          </Button>
        </div>
      ) : pendingCharge ? (
        <div className="brutal mt-8 p-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">status</p>
          <p className="mt-1 font-display text-3xl text-primary">
            {pendingCharge.status === "pending" && "WAITING ON CHAMPION…"}
            {pendingCharge.status === "confirmed" && "SETTLING ON-CHAIN…"}
            {pendingCharge.status === "settled" && "PAID ✓"}
            {pendingCharge.status === "rejected" && "REJECTED"}
            {(pendingCharge.status === "failed" || pendingCharge.status === "expired") && pendingCharge.status.toUpperCase()}
          </p>
          {pendingCharge.tx_hash ? (
            <a
              className="mt-3 inline-block break-all font-mono text-[10px] text-primary underline"
              href={`https://basescan.org/tx/${pendingCharge.tx_hash}`}
              target="_blank" rel="noreferrer"
            >
              {pendingCharge.tx_hash}
            </a>
          ) : null}
          {pendingCharge.status === "pending" || pendingCharge.status === "confirmed" ? (
            <Button variant="ghost" onClick={cancelCharge} className="mt-4">Cancel</Button>
          ) : (
            <Button onClick={() => setPendingCharge(null)} className="brutal-primary mt-4 w-full font-display">
              NEW CHARGE
            </Button>
          )}
        </div>
      ) : !scanned ? (
        <div className="mt-8 space-y-4">
          {scanning ? (
            <QRScanner onResult={handleResult} onError={(e) => toast.error(e)} />
          ) : (
            <Button onClick={() => setScanning(true)} className="brutal-primary brutal-hover w-full font-display text-2xl py-8">
              SCAN CHAMPION QR
            </Button>
          )}
        </div>
      ) : (
        <div className="brutal mt-8 p-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">champion</p>
          <p className="mt-1 break-all font-mono text-sm">{scanned.wallet}</p>
          <Label className="mt-4 block">Amount (PURPOSE = USDC payout)</Label>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="10.00"
            className="mt-2 text-2xl"
          />
          <Label className="mt-4 block">Memo (optional)</Label>
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Iced latte"
            className="mt-2"
            maxLength={80}
          />
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setScanned(null)}>Cancel</Button>
            <Button onClick={createCharge} disabled={busy || !amount} className="brutal-primary brutal-hover flex-1 font-display">
              {busy ? "SENDING…" : "REQUEST CONFIRMATION"}
            </Button>
          </div>
        </div>
      )}

      {account && isApproved && <VendorChargesHistory vendorWallet={account.address} />}
    </main>
  );
}
