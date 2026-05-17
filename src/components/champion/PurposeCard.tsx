import { Skeleton } from "@/components/ui/skeleton";
import { formatPurpose, usePurposeBalance } from "@/hooks/usePurposeBalance";

interface Props {
  address: string;
  onShowQR: () => void;
  displayName?: string | null;
}

export function PurposeCard({ address, onShowQR, displayName }: Props) {
  const { data, isLoading } = usePurposeBalance(address);
  const last4 = address ? address.slice(-4).toUpperCase() : "----";
  const name = (displayName || "CHAMPION").toUpperCase();

  return (
    <div className="space-y-4">
      {/* Virtual Debit Card */}
      <div className="relative mx-auto w-full max-w-md">
        <div
          className="brutal relative aspect-[1.586/1] w-full overflow-hidden bg-foreground p-5 sm:p-6"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.25), transparent 55%), radial-gradient(circle at 80% 90%, hsl(var(--primary) / 0.15), transparent 50%)",
          }}
        >
          {/* top row */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-background/60">
                // purpose card
              </p>
              <p className="mt-1 font-display text-xl text-primary">$PURPOSE</p>
            </div>
            {/* chip */}
            <div className="h-8 w-11 rounded-sm border-2 border-primary/70 bg-primary/30">
              <div className="m-1 grid h-5 w-7 grid-cols-3 grid-rows-2 gap-[1px]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-primary/60" />
                ))}
              </div>
            </div>
          </div>

          {/* balance */}
          <div className="mt-6">
            {isLoading ? (
              <Skeleton className="h-10 w-40 bg-background/20" />
            ) : (
              <p className="font-display text-4xl text-background sm:text-5xl">
                {formatPurpose(data)}{" "}
                <span className="text-lg text-primary">$P</span>
              </p>
            )}
          </div>

          {/* card number */}
          <div className="mt-5 font-mono text-base tracking-[0.25em] text-background/90 sm:text-lg">
            •••• •••• •••• {last4}
          </div>

          {/* bottom row */}
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-background/50">
                cardholder
              </p>
              <p className="font-display text-sm text-background">{name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-widest text-background/50">
                network
              </p>
              <p className="font-display text-sm text-primary">POP • BASE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={onShowQR}
        className="brutal-primary brutal-hover w-full px-6 py-4 font-display text-lg"
      >
        SHOW REDEEM QR →
      </button>
    </div>
  );
}
