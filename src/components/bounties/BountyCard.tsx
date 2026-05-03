import type { Bounty } from "@/hooks/useBounties";
import { formatPurpose } from "@/hooks/usePurposeBalance";

interface Props {
  bounty: Bounty;
  mode: "active" | "available";
  signedUp?: boolean;
  signingUp?: boolean;
  onViewDetails: () => void;
  onSignUp?: () => void;
}

export function BountyCard({
  bounty,
  mode,
  signedUp,
  signingUp,
  onViewDetails,
  onSignUp,
}: Props) {
  const filled = bounty.participants.length;
  const max = Number(bounty.maxParticipants);
  const full = filled >= max;

  return (
    <div className="brutal p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl sm:text-3xl">{bounty.name}</h3>
        <span className="brutal-primary px-2 py-1 font-mono text-[10px] uppercase">
          {filled}/{max}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {bounty.description}
      </p>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t-2 border-foreground pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            reward
          </p>
          <p className="font-display text-2xl text-primary">
            {formatPurpose(bounty.rewardAmount)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onViewDetails}
            className="brutal brutal-hover px-4 py-2 font-display text-sm"
          >
            DETAILS
          </button>
          {mode === "available" && (
            <button
              onClick={onSignUp}
              disabled={signedUp || signingUp || full}
              className="brutal-primary brutal-hover px-4 py-2 font-display text-sm disabled:opacity-50"
            >
              {signingUp ? "…" : signedUp ? "JOINED" : full ? "FULL" : "SIGN UP"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
