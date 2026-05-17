import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract, prepareContractCall, sendTransaction, waitForReceipt,
} from "thirdweb";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { ACTIVE } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AddressLabel } from "@/components/AddressLabel";
import { toCsv, downloadCsv, todayStamp } from "@/lib/csv";

type Vendor = {
  id: string;
  business_name: string;
  wallet_address: string;
  contact_email: string | null;
  category: string | null;
  approved: boolean;
  approved_tx_hash: string | null;
};

export default function AdminVendors() {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { session, roles, isLoading } = useSessionRoles();
  const [items, setItems] = useState<Vendor[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  async function load() {
    const { data } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Vendor[]);
  }
  useEffect(() => { if (roles.includes("admin")) load(); }, [roles]);

  async function approve(v: Vendor) {
    if (!account) return toast.error("Connect admin wallet");
    setBusy(v.id);
    try {
      const contract = getContract({
        client: thirdwebClient, chain: baseChain, address: ACTIVE.VENDOR_REDEMPTION,
      });
      const tx = prepareContractCall({
        contract,
        method: "function approveVendor(address vendor)",
        params: [v.wallet_address as `0x${string}`],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });

      await supabase.from("vendors").update({
        approved: true, approved_tx_hash: transactionHash,
      }).eq("id", v.id);

      await supabase.functions.invoke("grant-vendor-role", {
        body: { walletAddress: v.wallet_address },
      });

      toast.success("Vendor approved");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv() {
    const { data } = await supabase
      .from("vendors")
      .select("created_at, approved, business_name, category, wallet_address, contact_email, phone, description, approved_tx_hash")
      .order("created_at", { ascending: false });
    if (!data?.length) { toast.error("Nothing to export"); return; }
    const csv = toCsv(data as Record<string, unknown>[], [
      "created_at", "approved", "business_name", "category", "wallet_address",
      "contact_email", "phone", "description", "approved_tx_hash",
    ]);
    downloadCsv(`vendors-${todayStamp()}.csv`, csv);
  }

  if (!roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-5xl">VENDORS</h1>
          <Button onClick={exportCsv} className="brutal-primary brutal-hover font-display">EXPORT CSV</Button>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {items.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">// no vendors yet</p>
        ) : items.map((v) => (
          <div key={v.id} className="brutal flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-primary">
                {v.approved ? "approved" : "pending"} · {v.category ?? "—"}
              </p>
              <p className="font-display text-lg">{v.business_name}</p>
              <AddressLabel address={v.wallet_address} />
            </div>
            {!v.approved && (
              <Button disabled={busy === v.id} onClick={() => approve(v)} className="brutal-primary brutal-hover font-display">
                {busy === v.id ? "…" : "APPROVE ON-CHAIN"}
              </Button>
            )}
            {v.approved && v.approved_tx_hash && (
              <a
                target="_blank" rel="noreferrer"
                href={`https://basescan.org/tx/${v.approved_tx_hash}`}
                className="font-mono text-[10px] text-primary underline"
              >tx ↗</a>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
