import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ReceiptDialog } from "@/components/receipts/ReceiptDialog";
import { toast } from "sonner";

type Row = {
  id: string;
  receipt_token_id: number;
  vendor_wallet: string;
  usdc_payout: number | null;
  settled_at: string | null;
};

export function ChampionReceiptsStrip({ wallet }: { wallet: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [emailing, setEmailing] = useState<number | null>(null);

  async function emailMe(tokenId: number) {
    setEmailing(tokenId);
    try {
      const { data, error } = await supabase.functions.invoke("receipt-email", {
        body: { tokenId, recipients: ["champion"], force: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const r = (data?.results ?? [])[0];
      if (r?.status === "sent") toast.success("Receipt sent to your email");
      else if (r?.error?.includes("no email on file")) toast.error("Add an email to your profile first");
      else toast.message(`Status: ${r?.status ?? "unknown"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setEmailing(null); }
  }

  useEffect(() => {
    if (!wallet) return;
    (async () => {
      const { data } = await supabase
        .from("vendor_charges")
        .select("id,receipt_token_id,vendor_wallet,usdc_payout,settled_at")
        .ilike("champion_wallet", wallet)
        .not("receipt_token_id", "is", null)
        .order("settled_at", { ascending: false })
        .limit(12);
      setRows((data ?? []) as Row[]);
    })();
  }, [wallet]);

  if (rows.length === 0) return null;

  return (
    <section className="mt-10">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">// receipts</p>
      <h2 className="mt-2 font-display text-3xl">PROOF OF PURCHASE</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className="brutal p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              receipt #{r.receipt_token_id}
            </p>
            <p className="mt-2 font-display text-2xl text-primary">
              ${(r.usdc_payout ?? 0).toFixed(2)}
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {r.settled_at ? new Date(r.settled_at).toLocaleDateString() : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpenId(r.receipt_token_id)}>
                View
              </Button>
              <Button size="sm" variant="ghost" disabled={emailing !== null}
                      onClick={() => emailMe(r.receipt_token_id)}>
                {emailing === r.receipt_token_id ? "Sending…" : "Email me"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ReceiptDialog
        tokenId={openId}
        open={openId !== null}
        onOpenChange={(o) => { if (!o) setOpenId(null); }}
      />
    </section>
  );
}
