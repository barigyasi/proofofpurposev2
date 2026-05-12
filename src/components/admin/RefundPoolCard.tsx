import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { CONTRACTS, CONTRACTS_V2 } from "@/config/contracts";
import refundPoolAbi from "@/contracts/abis/RefundPool.json";

type LedgerRow = {
  id: string;
  kind: string;
  amount_usdc: number;
  tx_hash: string | null;
  actor: string | null;
  note: string | null;
  created_at: string;
};

const ERC20_TRANSFER_ABI = [
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
] as const;

export function RefundPoolCard() {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendTransaction();
  const [balance, setBalance] = useState<string>("—");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [topUp, setTopUp] = useState("");
  const [busy, setBusy] = useState(false);
  const poolAddress = CONTRACTS_V2.REFUND_POOL;
  const ready = !!poolAddress;

  async function refresh() {
    if (!ready) return;
    try {
      const usdc = getContract({ client, chain: base, address: CONTRACTS.USDC_BASE });
      const { readContract } = await import("thirdweb");
      const bal = await readContract({
        contract: usdc,
        method: "function balanceOf(address) view returns (uint256)",
        params: [poolAddress as `0x${string}`],
      }) as bigint;
      setBalance((Number(bal) / 1e6).toFixed(2));
    } catch (e) { console.error(e); }
    const { data } = await supabase
      .from("refund_pool_ledger").select("*").order("created_at", { ascending: false }).limit(10);
    setLedger((data ?? []) as LedgerRow[]);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [poolAddress]);

  async function handleTopUp() {
    if (!account || !ready) return;
    const amount = Number(topUp);
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      const usdc = getContract({ client, chain: base, address: CONTRACTS.USDC_BASE, abi: ERC20_TRANSFER_ABI as never });
      const tx = prepareContractCall({
        contract: usdc, method: "transfer",
        params: [poolAddress as `0x${string}`, BigInt(Math.floor(amount * 1e6))],
      });
      const result = await sendTx(tx);
      await supabase.functions.invoke("refund-pool-deposit", {
        body: { txHash: result.transactionHash, amountUsdc: amount, kind: "deposit" },
      });
      toast.success(`Sent $${amount.toFixed(2)} to refund pool`);
      setTopUp("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Top-up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brutal p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-2xl">REFUND POOL</h3>
        {ready ? (
          <a className="font-mono text-[10px] text-primary underline"
             href={`https://basescan.org/address/${poolAddress}`} target="_blank" rel="noreferrer">
            {poolAddress.slice(0, 6)}…{poolAddress.slice(-4)}
          </a>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">// not deployed</span>
        )}
      </div>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">available balance</p>
      <p className="font-display text-4xl text-primary">${balance} USDC</p>

      {ready && (
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Top up (USDC)</Label>
            <Input inputMode="decimal" value={topUp}
              onChange={(e) => setTopUp(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="100.00" />
          </div>
          <Button onClick={handleTopUp} disabled={busy || !account || !topUp} className="brutal-primary font-display">
            {busy ? "SENDING…" : "DEPOSIT"}
          </Button>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">// recent activity</p>
          <ul className="mt-2 space-y-1">
            {ledger.map((row) => (
              <li key={row.id} className="flex items-center justify-between font-mono text-[11px]">
                <span className="uppercase">{row.kind}</span>
                <span>${Number(row.amount_usdc).toFixed(2)}</span>
                {row.tx_hash ? (
                  <a className="text-primary underline" href={`https://basescan.org/tx/${row.tx_hash}`}
                     target="_blank" rel="noreferrer">tx</a>
                ) : <span />}
                <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
