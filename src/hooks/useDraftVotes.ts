import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2 } from "@/config/contracts";
import { voteChoiceToSupport } from "@/lib/governor";

export type VoteChoice = "yes" | "no" | "abstain";

export type DraftWithVotes = {
  id: string;
  name: string;
  description: string | null;
  reward_purpose: number;
  max_participants: number;
  status: string;
  vote_opens_at: string;
  vote_closes_at: string;
  yes_count: number;
  no_count: number;
  abstain_count: number;
  on_chain_bounty_id: number | null;
  dao_proposal_id: number | null;
  executed_at: string | null;
  created_at: string;
  image_urls: string[] | null;
  video_url: string | null;
  deck_url: string | null;
  deck_filename: string | null;
  location: string | null;
  on_chain_tx_hash: string | null;
  completed_participants: number | null;
  purpose_minted_snapshot: number | null;
  outcome_notes: string | null;
  snapshot_at: string | null;
};

export function useDraftVotes() {
  const [drafts, setDrafts] = useState<DraftWithVotes[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, VoteChoice>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [{ data: d }, { data: { user } }] = await Promise.all([
      supabase
        .from("bounty_drafts")
        .select("id,name,description,reward_purpose,max_participants,status,vote_opens_at,vote_closes_at,yes_count,no_count,abstain_count,on_chain_bounty_id,on_chain_tx_hash,dao_proposal_id,executed_at,created_at,image_urls,video_url,deck_url,deck_filename,location,completed_participants,purpose_minted_snapshot,outcome_notes,snapshot_at")
        .order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setDrafts((d ?? []) as DraftWithVotes[]);
    if (user) {
      const { data: v } = await supabase
        .from("bounty_draft_votes")
        .select("draft_id,choice")
        .eq("voter_id", user.id);
      const map: Record<string, VoteChoice> = {};
      (v ?? []).forEach((row) => { map[row.draft_id] = row.choice as VoteChoice; });
      setMyVotes(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("draft-votes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bounty_drafts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bounty_draft_votes" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  async function castVote(draftId: string, choice: VoteChoice, walletAddress?: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Enter to vote");
    const existing = myVotes[draftId];
    if (existing) {
      const { error } = await supabase
        .from("bounty_draft_votes")
        .update({ choice })
        .eq("draft_id", draftId)
        .eq("voter_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("bounty_draft_votes").insert({
        draft_id: draftId,
        voter_id: user.id,
        voter_wallet: walletAddress ?? null,
        choice,
      });
      if (error) throw error;
    }
    setMyVotes((m) => ({ ...m, [draftId]: choice }));
  }

  return { drafts, myVotes, loading, refresh, castVote };
}
