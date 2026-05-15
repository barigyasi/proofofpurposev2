import { V2_LIVE } from "@/config/contracts";

/**
 * Sitewide notice shown to vendors/champions while the V2 redemption
 * contracts haven't been deployed yet. Renders nothing once V2 is live.
 */
export function V2StatusBanner({ context }: { context?: "vendor" | "champion" }) {
  if (V2_LIVE) return null;

  const message =
    context === "vendor"
      ? "Redemptions are temporarily offline while we finalize the new on-chain settlement contracts. You can still scan and queue charges — they'll settle as soon as we flip the switch."
      : context === "champion"
        ? "Spending $PURPOSE is temporarily paused while we deploy the new redemption contracts. Your balance is safe — you'll be able to redeem as soon as we go live."
        : "On-chain redemptions are temporarily offline while we deploy the new contracts. Donations, bounties, and governance continue as normal.";

  return (
    <div className="brutal border-primary bg-primary/10 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
        // v2 launch in progress
      </p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
