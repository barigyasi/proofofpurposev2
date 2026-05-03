import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS } from "@/config/contracts";
import PurposeAbi from "@/contracts/abis/PurposeToken.json";

export function usePurposeBalance(address: string | undefined) {
  return useQuery({
    queryKey: ["purpose-balance", address?.toLowerCase()],
    enabled: !!address,
    refetchInterval: 15000,
    queryFn: async () => {
      const contract = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS.PURPOSE_TOKEN,
        abi: PurposeAbi as never,
      });
      const raw = (await readContract({
        contract,
        method: "balanceOf",
        params: [address as `0x${string}`],
      })) as bigint;
      return raw;
    },
  });
}

export function formatPurpose(raw: bigint | undefined): string {
  if (raw === undefined) return "0.00";
  // 18 decimals → 2 dp display
  const whole = raw / 10n ** 18n;
  const frac = (raw % 10n ** 18n) / 10n ** 16n; // two decimals
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}
