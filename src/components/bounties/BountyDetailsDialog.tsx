import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Bounty } from "@/hooks/useBounties";
import { formatPurpose } from "@/hooks/usePurposeBalance";

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
              <DialogDescription>Bounty #{bounty.id}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p className="whitespace-pre-wrap text-foreground">{bounty.description}</p>
              <dl className="grid grid-cols-2 gap-3 text-muted-foreground">
                <div>
                  <dt className="text-xs uppercase tracking-wide">Reward</dt>
                  <dd className="font-semibold text-primary">
                    {formatPurpose(bounty.rewardAmount)} PURPOSE
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide">Slots</dt>
                  <dd className="text-foreground">
                    {bounty.participants.length}/{Number(bounty.maxParticipants)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide">Status</dt>
                  <dd className="text-foreground">
                    {bounty.completed ? "Completed" : "Open"}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
