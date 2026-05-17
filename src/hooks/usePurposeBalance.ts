import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { ACTIVE } from "@/config/contracts";

export function usePurposeBalance(address: string | undefined) {
  return useQuery({
    queryKey: ["purpose-balance", address?.toLowerCase(), ACTIVE.PURPOSE_TOKEN],
    enabled: !!address,
    refetchInterval: 15000,
    queryFn: async () => {
      const contract = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: ACTIVE.PURPOSE_TOKEN,
      });
      const raw = (await readContract({
        contract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [address as `0x${string}`],
      })) as bigint;
      return raw;
    },
  });
}

export function formatPurpose(raw: bigint | undefined): string {
  if (raw === undefined) return "0.00";
  const whole = raw / 10n ** 18n;
  const frac = (raw % 10n ** 18n) / 10n ** 16n;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}
