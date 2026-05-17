import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, USDC_DECIMALS } from "@/config/contracts";
import { useTreasuryHeadroom } from "@/hooks/useTreasuryHeadroom";

export function TreasuryStat() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-treasury-usdc"],
    refetchInterval: 30000,
    queryFn: async () => {
      const usdc = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS.USDC_BASE,
      });
      const raw = (await readContract({
        contract: usdc,
        method: "function balanceOf(address) view returns (uint256)",
        params: [CONTRACTS.TREASURY as `0x${string}`],
      })) as bigint;
      return Number(raw) / 10 ** USDC_DECIMALS;
    },
  });

  const { data: headroom } = useTreasuryHeadroom();

  const formatted =
    data != null
      ? data.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";

  const committed = headroom?.committed ?? null;
  const committedFmt =
    committed != null
      ? committed.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : "—";

  return (
    <a
      href={`https://basescan.org/address/${CONTRACTS.TREASURY}`}
      target="_blank"
      rel="noreferrer"
      className="brutal brutal-hover block p-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // public treasury · base usdc · live
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
        <p className="font-display text-5xl text-primary sm:text-6xl">
          ${isLoading ? "…" : formatted}
        </p>
        <div className="brutal flex items-baseline gap-2 px-3 py-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            committed
          </span>
          <span className="font-display text-2xl text-foreground">
            {committedFmt}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            purpose
          </span>
        </div>
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        on-chain balance · committed = reward reserved for open + voted bounties · click to verify ↗
      </p>
    </a>
  );
}
