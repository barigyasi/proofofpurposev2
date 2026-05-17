import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { ACTIVE, PURPOSE_DECIMALS, USDC_DECIMALS } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";

/**
 * USDC-backed mint headroom.
 *
 *   backing      = USDC balance of the Treasury (each USDC backs 1 PURPOSE)
 *   outstanding  = total supply of PURPOSE currently in circulation
 *   committed    = sum(reward × max_participants) across open/running bounties
 *   headroom     = backing − outstanding − committed
 *
 * Headroom is the number of *new* PURPOSE we can safely mint without breaking
 * the 1 USDC : 1 PURPOSE backing promise.
 */
async function fetch() {
  const usdc = getContract({ client: thirdwebClient, chain: baseChain, address: ACTIVE.USDC });
  const purpose = getContract({ client: thirdwebClient, chain: baseChain, address: ACTIVE.PURPOSE_TOKEN });

  const [usdcWei, supplyWei, { data: rows }, { data: draftRows }] = await Promise.all([
    readContract({
      contract: usdc,
      method: "function balanceOf(address) view returns (uint256)",
      params: [ACTIVE.TREASURY as `0x${string}`],
    }) as Promise<bigint>,
    readContract({
      contract: purpose,
      method: "function totalSupply() view returns (uint256)",
      params: [],
    }) as Promise<bigint>,
    supabase
      .from("bounties")
      .select("reward_amount,max_participants,min_participants,status")
      .in("status", ["open", "running"]),
    supabase
      .from("bounty_drafts")
      .select("reward_purpose,max_participants,status,on_chain_bounty_id,dao_proposal_id,vote_closes_at")
      .is("on_chain_bounty_id", null),
  ]);

  const backing = Number(usdcWei) / 10 ** USDC_DECIMALS;
  const outstanding = Number(supplyWei) / 10 ** PURPOSE_DECIMALS;
  const committedBounties = (rows ?? []).reduce((sum, b) => {
    const reward = Number(b.reward_amount) || 0;
    const cap = Math.max(1, Number(b.max_participants) || Number(b.min_participants) || 1);
    return sum + reward * cap;
  }, 0);
  const committedDrafts = (draftRows ?? []).reduce((sum, d) => {
    const voteStillOpen = !!d.vote_closes_at && new Date(d.vote_closes_at).getTime() > Date.now();
    const reservesHeadroom = Boolean(d.dao_proposal_id) || (d.status === "pending_vote" && voteStillOpen);
    if (!reservesHeadroom) return sum;

    const reward = Number(d.reward_purpose) || 0;
    const cap = Math.max(1, Number(d.max_participants) || 1);
    return sum + reward * cap;
  }, 0);
  const committed = committedBounties + committedDrafts;

  return {
    backing,
    outstanding,
    /** Backwards-compat alias — old UI may read `.balance`. Represents max mintable. */
    balance: backing - outstanding,
    committed,
    headroom: backing - outstanding - committed,
    treasuryAddress: ACTIVE.TREASURY,
  };
}

export function useTreasuryHeadroom() {
  return useQuery({
    queryKey: ["treasury-headroom", ACTIVE.PURPOSE_TOKEN],
    queryFn: fetch,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** One-shot read — for use inside async submit handlers (no React state). */
export async function readTreasuryHeadroom() {
  return fetch();
}
