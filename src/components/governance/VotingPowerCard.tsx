import { Link } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { useVotingEligibility } from "@/hooks/useVotingEligibility";
import { SelfDelegateButton } from "@/components/membership/SelfDelegateButton";
import { Button } from "@/components/ui/button";

type Props = {
  /** When true, shows a "Go to Governance" CTA (use on /donate, /dashboard). */
  showGovernanceCta?: boolean;
  /** Compact variant for inline placement under a vote button. */
  compact?: boolean;
};

/**
 * Single source of truth for the "are you eligible to vote?" UI.
 * Walks the holder through: connect → mint membership → activate voting power → vote.
 */
export function VotingPowerCard({ showGovernanceCta = false, compact = false }: Props) {
  const account = useActiveAccount();
  const { hasMembership, delegated, eligible, reason, loading } = useVotingEligibility(
    account?.address,
  );

  if (loading && account) {
    return (
      <div className="brutal p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // checking voting power…
      </div>
    );
  }

  // Eligible — minimal confirmation badge.
  if (eligible) {
    return (
      <div className={compact ? "" : "brutal p-3"}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          // ⚡ voting power active · weight: 1
        </p>
        {showGovernanceCta && (
          <Button asChild className="brutal-primary brutal-hover mt-2 w-full font-display">
            <Link to="/governance">GO TO GOVERNANCE →</Link>
          </Button>
        )}
      </div>
    );
  }

  // Not connected.
  if (reason === "no-wallet") {
    return (
      <div className="brutal p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // step 1 · connect
        </p>
        <p className="mt-2 text-sm">Connect to mint a membership and unlock your vote.</p>
        <Button asChild className="brutal-primary brutal-hover mt-3 w-full font-display">
          <Link to="/login">ENTER →</Link>
        </Button>
      </div>
    );
  }

  // No active membership for the current month.
  if (reason === "no-membership") {
    return (
      <div className="brutal p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // no active membership this month
        </p>
        <p className="mt-2 text-sm">
          Donate $5+ this month to auto-mint a soulbound membership NFT. 1 active membership = 1 vote.
        </p>
        <Button asChild className="brutal-primary brutal-hover mt-3 w-full font-display">
          <Link to="/donate">DONATE TO UNLOCK VOTE →</Link>
        </Button>
      </div>
    );
  }

  // Has membership but hasn't self-delegated.
  if (reason === "not-delegated") {
    return (
      <div className="brutal p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          // ✓ membership detected · 1 step left
        </p>
        <p className="mt-2 text-sm">
          Activate your vPURPOSE voting power so the Governor counts your vote. One-tap, gas sponsored.
        </p>
        <SelfDelegateButton className="brutal-primary brutal-hover mt-3 w-full font-display" />
        {showGovernanceCta && (
          <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
            // then head to <Link to="/governance" className="text-primary underline">/governance</Link>
          </p>
        )}
      </div>
    );
  }

  // Unknown — vPURPOSE read failed (rare).
  return (
    <div className="brutal p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      // voting power: unknown · try refresh
    </div>
  );
}

/** Tiny inline pill for compact placements (e.g. above a vote tally). */
export function VotingPowerPill() {
  const account = useActiveAccount();
  const { eligible, hasMembership, delegated } = useVotingEligibility(account?.address);
  const status = !account
    ? "connect to vote"
    : eligible
      ? "voting power: 1"
      : hasMembership === false
        ? "no active membership"
        : delegated === false
          ? "vote power not activated"
          : "checking…";
  return (
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      // {status}
    </span>
  );
}
