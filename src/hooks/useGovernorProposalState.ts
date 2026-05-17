import { useEffect, useState } from "react";
import { getContract, readContract, eth_blockNumber, getRpcClient } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2 } from "@/config/contracts";

const BASE_BLOCK_SECONDS = 2;

export type GovernorProposalLive = {
  state: number;            // OZ Governor enum (0=Pending, 1=Active, ...)
  snapshotBlock: bigint;    // when voting opens
  deadlineBlock: bigint;    // when voting closes
  currentBlock: bigint;
  opensInSec: number;       // seconds until Active (0 if already open / past)
  closesInSec: number;      // seconds until Defeated/Succeeded snapshot (0 if past)
};

/** Polls Governor.state + snapshot/deadline + current block for a single proposal. */
export function useGovernorProposalState(proposalId: string | null | undefined) {
  const [data, setData] = useState<GovernorProposalLive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proposalId) {
      setData(null);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const governor = getContract({
          client: thirdwebClient,
          chain: baseChain,
          address: CONTRACTS_V2.POP_GOVERNOR,
        });
        const rpc = getRpcClient({ client: thirdwebClient, chain: baseChain });
        const id = BigInt(proposalId!);
        const [stateNum, snapshotBlock, deadlineBlock, currentBlock] = await Promise.all([
          readContract({
            contract: governor,
            method: "function state(uint256) view returns (uint8)",
            params: [id],
          }) as Promise<number>,
          readContract({
            contract: governor,
            method: "function proposalSnapshot(uint256) view returns (uint256)",
            params: [id],
          }) as Promise<bigint>,
          readContract({
            contract: governor,
            method: "function proposalDeadline(uint256) view returns (uint256)",
            params: [id],
          }) as Promise<bigint>,
          eth_blockNumber(rpc),
        ]);
        if (cancelled) return;
        const blocksToOpen = snapshotBlock > currentBlock ? Number(snapshotBlock - currentBlock) : 0;
        const blocksToClose = deadlineBlock > currentBlock ? Number(deadlineBlock - currentBlock) : 0;
        setData({
          state: Number(stateNum),
          snapshotBlock,
          deadlineBlock,
          currentBlock,
          opensInSec: blocksToOpen * BASE_BLOCK_SECONDS,
          closesInSec: blocksToClose * BASE_BLOCK_SECONDS,
        });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    load();
    const id = setInterval(load, 15_000); // refresh every 15s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [proposalId]);

  return { data, error };
}
