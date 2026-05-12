import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cancelCharge, refundCharge } from "@/lib/vendorCharges";
import { ReceiptDialog } from "@/components/receipts/ReceiptDialog";

type Charge = {
  id: string;
  status: string;
  champion_wallet: string;
  purpose_amount_wei: string;
  usdc_payout: number | null;
  memo: string | null;
  created_at: string;
  settled_at: string | null;
  captured_at: string | null;
  refund_window_seconds: number | null;
  refund_source: string | null;
  refund_tx_hash: string | null;
  receipt_token_id: number | null;
};

function statusPill(c: Charge) {
  const map: Record<string, string> = {
    pending: "Awaiting champion",
    confirmed: "Settling…",
    locked: "Locked",
    captured: "Settling…",
    settled: "Paid",
    refunded: "Refunded",
    cancelled: "Cancelled",
    failed: "Failed",
    expired: "Expired",
  };
  return map[c.status] ?? c.status;
}

function refundCountdown(c: Charge): string | null {
  if (c.status !== "settled") return null;
  const ms = new Date(c.settled_at ?? c.captured_at ?? c.created_at).getTime();
  const window = (c.refund_window_seconds ?? 7 * 24 * 3600) * 1000;
  const remaining = ms + window - Date.now();
  if (remaining <= 0) return "window closed";
  const days = Math.floor(remaining / 86400000);
  const hrs = Math.floor((remaining % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hrs}h to refund` : `${hrs}h to refund`;
}

export function VendorChargesHistory({ vendorWallet }: { vendorWallet: string }) {
  const [rows, setRows] = useState<Charge[]>([]);
  const [refundingFor, setRefundingFor] = useState<Charge | null>(null);
  const [reason, setReason] = useState("");
  const [source, setSource] = useState<"vendor" | "pool">("pool");
  const [busy, setBusy] = useState(false);
  const [openReceipt, setOpenReceipt] = useState<number | null>(null);

  async function load() {
    const { data } = await supabase
      .from("vendor_charges")
      .select("id,status,champion_wallet,purpose_amount_wei,usdc_payout,memo,created_at,settled_at,captured_at,refund_window_seconds,refund_source,refund_tx_hash,receipt_token_id")
      .ilike("vendor_wallet", vendorWallet)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data ?? []) as unknown as Charge[]);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [vendorWallet]);

  async function doCancel(c: Charge) {
    if (!confirm("Cancel this charge? Funds return to champion + treasury.")) return;
    try {
      await cancelCharge(c.id);
      toast.success("Charge cancelled");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function doRefund() {
    if (!refundingFor) return;
    setBusy(true);
    try {
      await refundCharge(refundingFor.id, source, reason || undefined);
      toast.success("Refund issued");
      setRefundingFor(null);
      setReason("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="brutal mt-6 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">// recent charges</p>
      <ul className="mt-3 divide-y divide-foreground/20">
        {rows.map((c) => {
          const purpose = Number(BigInt(c.purpose_amount_wei) / 10n ** 14n) / 1e4;
          const cd = refundCountdown(c);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-display text-primary">{purpose} $P</span>
              <span className="text-muted-foreground">{c.memo || "—"}</span>
              <span className="ml-auto rounded border-2 border-foreground px-2 py-0.5 font-mono text-[10px] uppercase">
                {statusPill(c)}
              </span>
              {cd && <span className="font-mono text-[10px] text-muted-foreground">{cd}</span>}
              {(c.status === "locked" || c.status === "captured") && (
                <Button size="sm" variant="ghost" onClick={() => doCancel(c)}>Cancel</Button>
              )}
              {c.status === "settled" && cd !== "window closed" && (
                <Button size="sm" className="brutal-primary font-display"
                        onClick={() => { setRefundingFor(c); setReason(""); setSource("pool"); }}>
                  REFUND
                </Button>
              )}
              {c.refund_tx_hash && (
                <a className="font-mono text-[10px] text-primary underline"
                   href={`https://basescan.org/tx/${c.refund_tx_hash}`} target="_blank" rel="noreferrer">tx</a>
              )}
              {c.receipt_token_id && (
                <button
                  className="rounded border-2 border-primary px-2 py-0.5 font-mono text-[10px] uppercase text-primary"
                  onClick={() => setOpenReceipt(c.receipt_token_id)}
                >receipt #{c.receipt_token_id}</button>
              )}
            </li>
          );
        })}
      </ul>

      <ReceiptDialog tokenId={openReceipt} open={openReceipt !== null}
                     onOpenChange={(o) => { if (!o) setOpenReceipt(null); }} />

      <Dialog open={!!refundingFor} onOpenChange={(o) => { if (!o) setRefundingFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue refund</DialogTitle>
            <DialogDescription>
              Refund <span className="font-display text-primary">
                ${refundingFor?.usdc_payout?.toFixed(2)}
              </span> to the champion. PURPOSE held in escrow returns to them automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "vendor" | "pool")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pool">Refund Pool</SelectItem>
                  <SelectItem value="vendor">My wallet (USDC approval required)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer requested" maxLength={200} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundingFor(null)} disabled={busy}>Back</Button>
            <Button onClick={doRefund} disabled={busy} className="brutal-primary font-display">
              {busy ? "REFUNDING…" : "CONFIRM REFUND"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
