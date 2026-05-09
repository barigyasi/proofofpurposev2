import { useCallback, useEffect, useState } from "react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
  readContract,
  eth_getBalance,
  getRpcClient,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, NATIVE_TOKEN_SENTINEL, USDC_DECIMALS } from "@/config/contracts";

type SplitDef = { label: string; address: string };

const SPLITS: SplitDef[] = [
  { label: "DONATION SPLIT", address: CONTRACTS.DONATION_SPLIT },
  { label: "TEAM SPLIT", address: CONTRACTS.TEAM_SPLIT },
];

// Dust thresholds — below this, distributing wastes more gas than the payout
const USDC_DUST = 0.01;
const ETH_DUST = 1e-5;

type Balances = { usdc: number; eth: number };

async function fetchBalances(splitAddress: string): Promise<Balances> {
  const usdc = getContract({
    client: thirdwebClient,
    chain: baseChain,
    address: CONTRACTS.USDC_BASE,
  });
  const rpc = getRpcClient({ client: thirdwebClient, chain: baseChain });
  const [usdcWei, ethWei] = await Promise.all([
    readContract({
      contract: usdc,
      method: "function balanceOf(address) view returns (uint256)",
      params: [splitAddress as `0x${string}`],
    }) as Promise<bigint>,
    eth_getBalance(rpc, { address: splitAddress as `0x${string}` }),
  ]);
  return {
    usdc: Number(usdcWei) / 10 ** USDC_DECIMALS,
    eth: Number(ethWei) / 1e18,
  };
}

export function SplitsDistributeCard() {
  const account = useActiveAccount();
  const [balances, setBalances] = useState<Record<string, Balances | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      SPLITS.map(async (s) => {
        try {
          return [s.address, await fetchBalances(s.address)] as const;
        } catch {
          return [s.address, null] as const;
        }
      }),
    );
    setBalances(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function distribute(split: SplitDef, token: string, label: string) {
    if (!account) {
      toast.error("Connect admin wallet first");
      return;
    }
    const key = `${split.address}:${token}`;
    setBusy(key);
    try {
      const contract = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: split.address,
      });
      const tx = prepareContractCall({
        contract,
        method: "function distribute(address token)",
        params: [token as `0x${string}`],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      toast.success(`${split.label} • ${label} distributed`, {
        description: transactionHash.slice(0, 10) + "…" + transactionHash.slice(-6),
        action: {
          label: "View",
          onClick: () =>
            window.open(`https://basescan.org/tx/${transactionHash}`, "_blank", "noopener"),
        },
      });
      await refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/user rejected|denied/i.test(raw)) {
        toast.error("Transaction rejected in wallet");
      } else {
        toast.error(`Distribute failed: ${raw.slice(0, 160)}`);
      }
      console.error("Split distribute failed", e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="brutal p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // splits
          </p>
          <h2 className="mt-1 font-display text-2xl">DISTRIBUTE PAYOUTS</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Push pending USDC / ETH from each Split to its recipients. Anyone can call this — gas
            is paid by the connected admin wallet.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          className="font-mono text-xs"
        >
          REFRESH
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SPLITS.map((s) => {
          const bal = balances[s.address];
          const usdcKey = `${s.address}:${CONTRACTS.USDC_BASE}`;
          const ethKey = `${s.address}:${NATIVE_TOKEN_SENTINEL}`;
          const usdcReady = bal && bal.usdc >= USDC_DUST;
          const ethReady = bal && bal.eth >= ETH_DUST;
          return (
            <div key={s.address} className="brutal p-4">
              <h3 className="font-display text-lg">{s.label}</h3>
              <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {s.address}
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">
                      USDC pending
                    </p>
                    <p className="font-display text-xl">
                      {bal ? bal.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "…"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!account || !usdcReady || busy === usdcKey}
                    onClick={() => distribute(s, CONTRACTS.USDC_BASE, "USDC")}
                    className="brutal-primary brutal-hover font-display"
                  >
                    {busy === usdcKey ? "…" : "DISTRIBUTE USDC"}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">
                      ETH pending
                    </p>
                    <p className="font-display text-xl">
                      {bal ? bal.eth.toLocaleString(undefined, { maximumFractionDigits: 5 }) : "…"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!account || !ethReady || busy === ethKey}
                    onClick={() => distribute(s, NATIVE_TOKEN_SENTINEL, "ETH")}
                    className="font-display"
                  >
                    {busy === ethKey ? "…" : "DISTRIBUTE ETH"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!account && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Connect your admin wallet to enable distributions.
        </p>
      )}
    </section>
  );
}
