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
 *
 * NOTE: QR is rendered black-on-white at high contrast regardless of brand
 * theme — camera decoders need it that way.
 */
export function CheckInQRDialog({ open, onOpenChange, bountyId, bountyName, walletAddress }: Props) {
  const payload = JSON.stringify({ t: "checkin", bountyId, walletAddress });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md brutal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">CHECK IN</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Show this to the admin at <span className="text-primary">{bountyName}</span> to be marked present.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="bg-white p-2">
            <QRCodeSVG
              value={payload}
              size={320}
              level="L"
              bgColor="#ffffff"
              fgColor="#000000"
              includeMargin
            />
          </div>
          <code className="break-all text-center font-mono text-[10px] text-muted-foreground">
            {walletAddress}
          </code>
        </div>
      </DialogContent>
    </Dialog>
  );
}
