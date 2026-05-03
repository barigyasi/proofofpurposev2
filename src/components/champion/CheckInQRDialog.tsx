import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bountyId: string;
  bountyName: string;
  walletAddress: string;
}

/**
 * Champion's personal check-in QR. Admin scans this at the event entrance to
 * mark them present and trigger the on-chain addParticipant call.
 */
export function CheckInQRDialog({ open, onOpenChange, bountyId, bountyName, walletAddress }: Props) {
  const payload = JSON.stringify({ t: "checkin", bountyId, walletAddress });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm brutal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">CHECK IN</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Show this to the admin at <span className="text-primary">{bountyName}</span> to be marked present.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="border-4 border-foreground bg-background p-3">
            <QRCodeSVG value={payload} size={220} level="M" />
          </div>
          <code className="break-all text-center font-mono text-[10px] text-muted-foreground">
            {walletAddress}
          </code>
        </div>
      </DialogContent>
    </Dialog>
  );
}
