import { useTreasuryHeadroom } from "@/hooks/useTreasuryHeadroom";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export function TreasuryHeadroomCard() {
  const { data, isLoading, refetch, isFetching } = useTreasuryHeadroom();

  const low = data && data.headroom < 0;
  const tight = data && data.headroom >= 0 && data.headroom < data.committed * 0.1;

  return (
    <div
      className={`brutal p-4 ${
        low ? "border-destructive bg-destructive/10" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // treasury
          </p>
          <h3 className="mt-1 font-display text-xl">PURPOSE HEADROOM</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh treasury balance"
        >
          {isFetching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {isLoading || !data ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">// loading…</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-xs">
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">balance</p>
            <p className="mt-1 font-display text-lg text-foreground">
              {data.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">committed</p>
            <p className="mt-1 font-display text-lg text-foreground">
              {data.committed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">headroom</p>
            <p
              className={`mt-1 font-display text-lg ${
                low ? "text-destructive" : tight ? "text-primary" : "text-foreground"
              }`}
            >
              {data.headroom.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {low && (
        <p className="mt-3 font-mono text-[10px] uppercase text-destructive">
          // treasury cannot cover all open + running events. fund before ending events.
        </p>
      )}
      {tight && !low && (
        <p className="mt-3 font-mono text-[10px] uppercase text-primary">
          // headroom under 10% — consider funding the treasury soon.
        </p>
      )}
      {data && (
        <p className="mt-2 break-all font-mono text-[9px] text-muted-foreground">
          // commitment estimated from min_participants × reward (no max-cap column yet).
          treasury: {data.treasuryAddress}
        </p>
      )}
    </div>
  );
}
