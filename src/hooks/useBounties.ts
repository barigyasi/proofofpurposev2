import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS } from "@/config/contracts";
import BountyAbi from "@/contracts/abis/BountyManager.json";

export type Bounty = {
  id: number;
  name: string;
  description: string;
  rewardAmount: bigint;
  maxParticipants: bigint;
  completed: boolean;
  participants: string[];
};

function bountyContract() {
  return getContract({
    client: thirdwebClient,
    chain: baseChain,
    address: CONTRACTS.BOUNTY_MANAGER,
    abi: BountyAbi as never,
  });
}

export function useBounties() {
  return useQuery({
    queryKey: ["bounties"],
    refetchInterval: 30000,
    queryFn: async (): Promise<Bounty[]> => {
      const contract = bountyContract();
      const count = (await readContract({
        contract,
        method: "bountyCount",
        params: [],
      })) as bigint;
      const total = Number(count);
      if (total === 0) return [];
      const ids = Array.from({ length: total }, (_, i) => i);
      const results = await Promise.all(
        ids.map(async (i) => {
          const [tuple, participants] = await Promise.all([
            readContract({
              contract,
              method: "bounties",
              params: [BigInt(i)],
            }) as Promise<readonly [string, string, bigint, bigint, boolean]>,
            readContract({
              contract,
              method: "getParticipants",
              params: [BigInt(i)],
            }) as Promise<readonly string[]>,
          ]);
          const [name, description, rewardAmount, maxParticipants, completed] = tuple;
          return {
            id: i,
            name,
            description,
            rewardAmount,
            maxParticipants,
            completed,
            participants: [...participants],
          };
        }),
      );
      return results;
    },
  });
}
