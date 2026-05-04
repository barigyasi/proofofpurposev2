import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, PURPOSE_DECIMALS } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";

/**
 * Treasury PURPOSE balance vs. committed (open + running bounties).
 * Committed = sum(reward_amount * max_participants) for non-completed bounties.
 *
 * Falls back to reward_amount * 1 when max_participants is missing/<=0.
 *
 * All values returned as numbers in whole PURPOSE (not wei) for UI.
 */
export function useTreasuryHeadroom() {
  return useQuery({
    queryKey: ["treasury-headroom"],
    queryFn: async () => {
      const purpose = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS.PURPOSE_TOKEN,
      });

      const [balanceWei, { data: rows }] = await Promise.all([
        readContract({
          contract: purpose,
          method: "function balanceOf(address) view returns (uint256)",
          params: [CONTRACTS.TREASURY as `0x${string}`],
        }) as Promise<bigint>,
        supabase
          .from("bounties")
          .select("reward_amount,max_participants,min_participants,status")
          .in("status", ["open", "running"]),
      ]);

      const balance = Number(balanceWei) / 10 ** PURPOSE_DECIMALS;

      // Committed = sum(reward * max_participants) for non-completed bounties.
      // Falls back to min_participants, then 1, when max is unset.
      const committed = (rows ?? []).reduce((sum, b) => {
        const reward = Number(b.reward_amount) || 0;
        const cap = Math.max(
          1,
          Number(b.max_participants) || Number(b.min_participants) || 1,
        );
        return sum + reward * cap;
      }, 0);

      const headroom = balance - committed;
      return {
        balance,
        committed,
        headroom,
        treasuryAddress: CONTRACTS.TREASURY,
      };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** One-shot read — for use inside async submit handlers (no React state). */
export async function readTreasuryHeadroom() {
  const purpose = getContract({
    client: thirdwebClient,
    chain: baseChain,
    address: CONTRACTS.PURPOSE_TOKEN,
  });
  const [balanceWei, { data: rows }] = await Promise.all([
    readContract({
      contract: purpose,
      method: "function balanceOf(address) view returns (uint256)",
      params: [CONTRACTS.TREASURY as `0x${string}`],
    }) as Promise<bigint>,
    supabase
      .from("bounties")
      .select("reward_amount,min_participants,status")
      .in("status", ["open", "running"]),
  ]);
  const balance = Number(balanceWei) / 10 ** PURPOSE_DECIMALS;
  const committed = (rows ?? []).reduce((sum, b) => {
    const reward = Number(b.reward_amount) || 0;
    const cap = Math.max(1, Number(b.min_participants) || 1);
    return sum + reward * cap;
  }, 0);
  return { balance, committed, headroom: balance - committed };
}
