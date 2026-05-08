import { useEnsName } from "@/hooks/useEnsName";
import { cn } from "@/lib/utils";

interface AddressLabelProps {
  address: string;
  className?: string;
  /** Show truncated 0x… alongside ENS when resolved. Default true. */
  showAddress?: boolean;
  /** Link to basescan. Default true. */
  link?: boolean;
}

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AddressLabel({ address, className, showAddress = true, link = true }: AddressLabelProps) {
  const ens = useEnsName(address);
  const body = (
    <span className={cn("font-mono text-[10px] text-muted-foreground break-all", className)}>
      {ens ? (
        <>
          <span className="text-foreground">{ens}</span>
          {showAddress && <span className="ml-1 opacity-60">({shorten(address)})</span>}
        </>
      ) : (
        address
      )}
    </span>
  );
  if (!link) return body;
  return (
    <a
      href={`https://basescan.org/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="hover:underline"
    >
      {body}
    </a>
  );
}
