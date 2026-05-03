import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { toast } from "sonner";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, USDC_DECIMALS } from "@/config/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

function toUsdc(amount: string): bigint {
  const [w, f = ""] = amount.split(".");
  const frac = (f + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(w || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt(frac || "0");
}

export default function Donate() {
  const account = useActiveAccount();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState<string | null>(null);

  async function donate() {
    if (!account) return toast.error("Connect wallet first");
    if (!amount) return toast.error("Enter amount");
    setBusy(true);
    try {
      const usdc = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS.USDC_BASE,
      });
      const tx = prepareContractCall({
        contract: usdc,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [CONTRACTS.DONATION_SPLIT as `0x${string}`, toUsdc(amount)],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      setHash(transactionHash);

      await supabase.from("donations").insert({
        donor_wallet: account.address,
        source: "wallet",
        amount_usdc: Number(amount),
        tx_hash: transactionHash,
        status: "confirmed",
      });
      toast.success("Thank you! Donation recorded.");
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
          // fund the mission · base usdc
        </p>
        <h1 className="mt-2 font-display text-5xl">DONATE</h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Funds go to the on-chain donation split contract — fully transparent, fully on Base.
        </p>
      </div>
      <div className="brutal mt-8 p-6">
        <Label>Amount (USDC)</Label>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="50"
          className="mt-2 text-2xl"
        />
        <Button onClick={donate} disabled={busy} className="brutal-primary brutal-hover mt-4 w-full font-display text-lg">
          {busy ? "SENDING…" : "DONATE NOW"}
        </Button>
        {hash && (
          <a
            href={`https://basescan.org/tx/${hash}`}
            target="_blank" rel="noreferrer"
            className="mt-3 block break-all text-center font-mono text-[10px] text-primary underline"
          >
            view tx ↗
          </a>
        )}
        <p className="mt-4 break-all text-center font-mono text-[10px] text-muted-foreground">
          → {CONTRACTS.DONATION_SPLIT}
        </p>
      </div>
    </main>
  );
}
