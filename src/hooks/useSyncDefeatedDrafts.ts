import { useEffect } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2 } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";
import { PROPOSAL_STATE, PROPOSAL_STATE_LABEL } from "@/lib/governor";
import type { DraftWithVotes } from "@/hooks/useDraftVotes";

/**
 * Admin-only: scans drafts that have a live on-chain proposal but are still
 * `pending_vote` past their close time, reads `state()` from POPGovernor, and
 * marks Canceled/Defeated/Expired drafts as `status='defeated'` so they
 * surface in admin UI + stop reserving treasury headroom.
 */
export function useSyncDefeatedDrafts(
  drafts: DraftWithVotes[],
  isAdmin: boolean,
  onSynced?: () => void,
) {
  useEffect(() => {
    if (!isAdmin || drafts.length === 0) return;
    let cancelled = false;

    const stale = drafts.filter(
      (d) =>
        d.status === "pending_vote" &&
        d.dao_proposal_id &&
        new Date(d.vote_closes_at).getTime() < Date.now(),
    );
    if (stale.length === 0) return;

    (async () => {
      const governor = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS_V2.POP_GOVERNOR,
      });

      let touched = false;
      for (const d of stale) {
        try {
          const state = Number(
            await readContract({
              contract: governor,
              method: "function state(uint256) view returns (uint8)",
              params: [BigInt(d.dao_proposal_id!)],
            }),
          );
          if (cancelled) return;
          if (
            state === PROPOSAL_STATE.Defeated ||
            state === PROPOSAL_STATE.Canceled ||
            state === PROPOSAL_STATE.Expired
          ) {
            const label = PROPOSAL_STATE_LABEL[state] ?? `state ${state}`;
            const { error } = await supabase
              .from("bounty_drafts")
              .update({
                status: "defeated",
                outcome_notes: `on-chain: ${label}`,
              })
              .eq("id", d.id);
            if (!error) touched = true;
          }
        } catch {
          // ignore RPC hiccups; we'll retry on the next mount
        }
      }
      if (touched && !cancelled) onSynced?.();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, drafts.map((d) => d.id + d.status).join(",")]);
}
