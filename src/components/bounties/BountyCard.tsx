import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{bounty.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {bounty.description}
            </p>
          </div>
          <Badge variant="secondary">
            {filled}/{max} signed up
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Reward:{" "}
            <span className="font-semibold text-primary">
              {formatPurpose(bounty.rewardAmount)} PURPOSE
            </span>
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onViewDetails}>
              View Details
            </Button>
            {mode === "available" && (
              <Button
                size="sm"
                onClick={onSignUp}
                disabled={signedUp || signingUp || filled >= max}
              >
                {signingUp ? "Signing up…" : signedUp ? "Signed up" : "Sign Up"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
