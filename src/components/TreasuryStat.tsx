import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, USDC_DECIMALS } from "@/config/contracts";

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

  const formatted =
    data != null
      ? data.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
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
      <p className="mt-2 font-display text-5xl text-primary sm:text-6xl">
        ${isLoading ? "…" : formatted}
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        on-chain balance · click to verify on basescan ↗
      </p>
    </a>
  );
}
