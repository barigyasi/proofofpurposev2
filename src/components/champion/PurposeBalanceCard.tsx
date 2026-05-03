import { Skeleton } from "@/components/ui/skeleton";
import { formatPurpose, usePurposeBalance } from "@/hooks/usePurposeBalance";

interface Props {
  address: string;
  onShowQR: () => void;
}

export function PurposeBalanceCard({ address, onShowQR }: Props) {
  const { data, isLoading } = usePurposeBalance(address);

  return (
    <div className="brutal p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // your balance
        </p>
        <p className="font-display text-sm text-primary">$PURPOSE</p>
      </div>
      <div className="my-6">
        {isLoading ? (
          <Skeleton className="h-20 w-48" />
        ) : (
          <p className="font-display text-7xl sm:text-8xl text-primary">
            {formatPurpose(data)}
          </p>
        )}
      </div>
      <button
        onClick={onShowQR}
        className="brutal-primary brutal-hover w-full px-6 py-4 font-display text-lg sm:w-auto"
      >
        SHOW REDEEM QR →
      </button>
    </div>
  );
}
