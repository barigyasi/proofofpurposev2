// Shared helpers for the on-chain Governor (thirdweb VoteERC20 / OZ Governor).

import type { VoteChoice } from "@/hooks/useDraftVotes";

/** OpenZeppelin Governor ProposalState enum. */
export const PROPOSAL_STATE = {
  Pending: 0,
  Active: 1,
  Canceled: 2,
  Defeated: 3,
  Succeeded: 4,
  Queued: 5,
  Expired: 6,
  Executed: 7,
} as const;

export type ProposalState = (typeof PROPOSAL_STATE)[keyof typeof PROPOSAL_STATE];

export const PROPOSAL_STATE_LABEL: Record<number, string> = {
  0: "pending",
  1: "active",
  2: "canceled",
  3: "defeated",
  4: "succeeded",
  5: "queued",
  6: "expired",
  7: "executed",
};

/** Governor castVote support enum (Bravo): 0=Against, 1=For, 2=Abstain. */
export function voteChoiceToSupport(choice: VoteChoice): 0 | 1 | 2 {
  switch (choice) {
    case "yes":
      return 1;
    case "no":
      return 0;
    case "abstain":
      return 2;
  }
}

/** Stable description string used for both `propose` and `execute(descriptionHash)`. */
export function bountyProposalDescription(draftId: string, name: string): string {
  return `BOUNTY:${draftId}:${name}`;
}
