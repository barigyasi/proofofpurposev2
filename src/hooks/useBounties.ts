import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Bounty = {
  id: string;
  onChainId: number | null;
  name: string;
  description: string;
  rewardAmount: number;
  status: string;
  imageUrl: string | null;
  location: string | null;
  expiresAt: string | null;
  txHash: string | null;
  createdAt: string;
};

export function useBounties() {
  return useQuery({
    queryKey: ["bounties"],
    refetchInterval: 30000,
    queryFn: async (): Promise<Bounty[]> => {
      const { data, error } = await supabase
        .from("bounties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => ({
        id: b.id,
        onChainId: b.on_chain_id !== null && b.on_chain_id !== undefined ? Number(b.on_chain_id) : null,
        name: b.title,
        description: b.description ?? "",
        rewardAmount: Number(b.reward_amount),
        status: b.status,
        imageUrl: b.image_url,
        location: b.location,
        expiresAt: b.expires_at,
        txHash: b.on_chain_tx_hash,
        createdAt: b.created_at,
      }));
    },
  });
}
