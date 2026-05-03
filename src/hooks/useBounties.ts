import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS } from "@/config/contracts";

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
        method: "function bountyCount() view returns (uint256)",
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
              method:
                "function bounties(uint256) view returns (string, string, uint256, uint256, bool)",
              params: [BigInt(i)],
            }) as Promise<readonly [string, string, bigint, bigint, boolean]>,
            readContract({
              contract,
              method:
                "function getParticipants(uint256) view returns (address[])",
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
