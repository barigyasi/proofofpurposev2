import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useActiveAccount } from "thirdweb/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shows a QR encoding `{wallet, expires_at, signature}` so a vendor scanner
 * can verify the holder is live. Signature is a short-lived nonce signed
 * client-side by the champion's smart account.
 */
export function RedeemQRDialog({ open, onOpenChange }: Props) {
  const account = useActiveAccount();
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !account) return;
    let cancelled = false;
    setPayload(null);
    setError(null);
    (async () => {
      try {
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
        const message = `pop-redeem:${account.address}:${expiresAt}`;
        const signature = await account.signMessage({ message });
        if (cancelled) return;
        setPayload(
          JSON.stringify({
            wallet: account.address,
            expires_at: expiresAt,
            signature,
          }),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to sign");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, account]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeem $PURPOSE</DialogTitle>
          <DialogDescription>
            Show this QR to an approved vendor. Expires in 5 minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : payload ? (
            <div className="rounded-lg bg-card p-4">
              <QRCodeSVG value={payload} size={240} bgColor="transparent" fgColor="#fbbf24" />
            </div>
          ) : (
            <Skeleton className="h-[240px] w-[240px]" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
