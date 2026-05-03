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
  minParticipants: number;
  startedAt: string | null;
  completedAt: string | null;
  checkInToken: string | null;
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
      return (data ?? []).map((b: Record<string, unknown>) => ({
        id: b.id as string,
        onChainId: b.on_chain_id !== null && b.on_chain_id !== undefined ? Number(b.on_chain_id) : null,
        name: b.title as string,
        description: (b.description as string) ?? "",
        rewardAmount: Number(b.reward_amount),
        status: b.status as string,
        imageUrl: (b.image_url as string) ?? null,
        location: (b.location as string) ?? null,
        expiresAt: (b.expires_at as string) ?? null,
        txHash: (b.on_chain_tx_hash as string) ?? null,
        createdAt: b.created_at as string,
        minParticipants: Number(b.min_participants ?? 1),
        startedAt: (b.started_at as string) ?? null,
        completedAt: (b.completed_at as string) ?? null,
        checkInToken: (b.check_in_token as string) ?? null,
      }));
    },
  });
}
