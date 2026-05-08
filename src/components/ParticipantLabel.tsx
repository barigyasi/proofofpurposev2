import { AddressLabel } from "@/components/AddressLabel";
import { cn } from "@/lib/utils";

interface ParticipantLabelProps {
  wallet: string;
  name?: string | null;
  className?: string;
}

/** Friendly-name-first label. Falls back to ENS / shortened address via AddressLabel. */
export function ParticipantLabel({ wallet, name, className }: ParticipantLabelProps) {
  if (!name) {
    return <AddressLabel address={wallet} className={className} />;
  }
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="font-display text-sm">{name}</span>
      <AddressLabel address={wallet} />
    </div>
  );
}
