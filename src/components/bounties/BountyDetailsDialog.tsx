import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Bounty } from "@/hooks/useBounties";

interface Props {
  bounty: Bounty | null;
  onOpenChange: (open: boolean) => void;
}

export function BountyDetailsDialog({ bounty, onOpenChange }: Props) {
  return (
    <Dialog open={!!bounty} onOpenChange={onOpenChange}>
      <DialogContent>
        {bounty && (
          <>
            <DialogHeader>
              <DialogTitle>{bounty.name}</DialogTitle>
              <DialogDescription>
                {bounty.onChainId !== null ? `Bounty #${bounty.onChainId}` : "Bounty"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p className="whitespace-pre-wrap text-foreground">{bounty.description}</p>
              <dl className="grid grid-cols-2 gap-3 text-muted-foreground">
                <div>
                  <dt className="text-xs uppercase tracking-wide">Reward</dt>
                  <dd className="font-semibold text-primary">
                    {bounty.rewardAmount.toLocaleString()} PURPOSE
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide">Status</dt>
                  <dd className="text-foreground">{bounty.status}</dd>
                </div>
                {bounty.location && (
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide">Location</dt>
                    <dd className="text-foreground">{bounty.location}</dd>
                  </div>
                )}
                {bounty.expiresAt && (
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide">Expires</dt>
                    <dd className="text-foreground">
                      {new Date(bounty.expiresAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
