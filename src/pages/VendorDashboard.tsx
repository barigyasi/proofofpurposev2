import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import { toast } from "sonner";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, PURPOSE_DECIMALS } from "@/config/contracts";
import { QRScanner } from "@/components/vendor/QRScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useVendorApplication } from "@/hooks/useApplicationStatus";

type Scanned = { wallet: string; expires_at: number; signature: string };

export default function VendorDashboard() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const { session, roles, isLoading } = useEffectiveRoles();
  const { status: appStatus, businessName } = useVendorApplication(account?.address);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

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
      // No application and no role → send to apply
      navigate("/apply/vendor", { replace: true });
    }
  }, [isLoading, session, isApproved, appStatus, navigate]);

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

  async function redeem() {
    if (!account || !scanned || !amount) return;
    setBusy(true);
    try {
      // 1. server-side verify signature
      const { error } = await supabase.functions.invoke("vendor-redeem-verify", {
        body: scanned,
      });
      if (error) throw new Error(error.message);

      // 2. send redeem tx from vendor wallet
      const wei = BigInt(Math.floor(Number(amount) * 10 ** PURPOSE_DECIMALS));
      const contract = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS.VENDOR_REDEMPTION,
      });
      const tx = prepareContractCall({
        contract,
        method: "function redeem(address champion, uint256 amount)",
        params: [scanned.wallet as `0x${string}`, wei],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });

      // 3. record off-chain
      await supabase.from("vendor_redemptions").insert({
        vendor_wallet: account.address,
        champion_wallet: scanned.wallet,
        purpose_amount_wei: wei.toString() as never,
        usdc_payout: Number(amount),
        tx_hash: transactionHash,
      });

      toast.success(`Redeemed ${amount} PURPOSE`);
      setScanned(null);
      setAmount("");
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
          // vendor terminal
        </p>
        <h1 className="mt-2 font-display text-5xl">REDEEM<br /><span className="text-primary">$PURPOSE</span></h1>
      </div>

      {!scanned ? (
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
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setScanned(null)}>Cancel</Button>
            <Button onClick={redeem} disabled={busy || !amount} className="brutal-primary brutal-hover flex-1 font-display">
              {busy ? "REDEEMING…" : "CONFIRM REDEMPTION"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
