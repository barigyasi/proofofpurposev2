import { useEffect, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2 } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";

export type VotingEligibility = {
  hasMembership: boolean | null;
  delegated: boolean | null;
  weight: number;
  eligible: boolean;
  reason: "no-wallet" | "no-membership" | "not-delegated" | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * Voting eligibility for the on-chain DAO.
 * Rule: 1 active monthly membership NFT = 1 vote, *and* the holder must have
 * self-delegated their vPURPOSE so the Governor counts them.
 */
export function useVotingEligibility(wallet?: string | null): VotingEligibility {
  const [hasMembership, setHasMembership] = useState<boolean | null>(null);
  const [delegated, setDelegated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!wallet) {
      setHasMembership(null);
      setDelegated(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: weight }, delegateAddr] = await Promise.all([
        supabase.rpc("eligible_vote_weight", { _wallet: wallet }),
        (async () => {
          try {
            const contract = getContract({
              client: thirdwebClient,
              chain: baseChain,
              address: CONTRACTS_V2.VPURPOSE_TOKEN,
            });
            return (await readContract({
              contract,
              method: "function delegates(address) view returns (address)",
              params: [wallet],
            })) as string;
          } catch {
            return null;
          }
        })(),
      ]);
      if (cancelled) return;
      setHasMembership(((weight as number | null) ?? 0) > 0);
      setDelegated(
        delegateAddr ? String(delegateAddr).toLowerCase() === wallet.toLowerCase() : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, tick]);

  const reason: VotingEligibility["reason"] = !wallet
    ? "no-wallet"
    : hasMembership === false
      ? "no-membership"
      : delegated === false
        ? "not-delegated"
        : null;

  return {
    hasMembership,
    delegated,
    weight: hasMembership ? 1 : 0,
    eligible: !!hasMembership && delegated === true,
    reason,
    loading,
    refresh: () => setTick((t) => t + 1),
  };
}
