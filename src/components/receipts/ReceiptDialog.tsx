import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTRACTS_V2 } from "@/config/contracts";
import { fetchReceipt, svgToPngDataUrl, downloadDataUrl, type DecodedReceipt } from "@/lib/receipts";
import { toast } from "sonner";

export function ReceiptDialog({
  tokenId,
  open,
  onOpenChange,
}: {
  tokenId: string | number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<DecodedReceipt | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || tokenId == null) return;
    setLoading(true); setData(null);
    fetchReceipt(tokenId)
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load receipt"))
      .finally(() => setLoading(false));
  }, [open, tokenId]);

  async function downloadPng() {
    if (!data?.svg) return;
    try {
      const url = await svgToPngDataUrl(data.svg);
      downloadDataUrl(`pop-receipt-${data.tokenId}.png`, url);
    } catch (e) { toast.error("PNG export failed"); }
  }
  function downloadSvg() {
    if (!data?.svg) return;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.svg);
    downloadDataUrl(`pop-receipt-${data.tokenId}.svg`, url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Receipt #{tokenId ?? ""}</DialogTitle>
          <DialogDescription>
            Soulbound proof-of-purchase — fully on-chain on Base.
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-square w-full overflow-hidden border-2 border-foreground bg-background">
          {loading || !data?.svg ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: data.svg }}
            />
          )}
        </div>
        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          {CONTRACTS_V2.RECEIPT_NFT && tokenId != null && (
            <a
              className="font-mono text-xs uppercase tracking-widest text-primary underline"
              href={`https://basescan.org/token/${CONTRACTS_V2.RECEIPT_NFT}?a=${tokenId}`}
              target="_blank" rel="noreferrer"
            >View on BaseScan</a>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={downloadSvg} disabled={!data?.svg}>SVG</Button>
            <Button onClick={downloadPng} disabled={!data?.svg} className="brutal-primary font-display">
              DOWNLOAD PNG
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
