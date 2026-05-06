import { CONTRACTS } from "@/config/contracts";

const LINKS = [
  ["PURPOSE Token", CONTRACTS.PURPOSE_TOKEN],
  ["Bounty Manager", CONTRACTS.BOUNTY_MANAGER],
  ["Vendor Redemption", CONTRACTS.VENDOR_REDEMPTION],
  ["Treasury", CONTRACTS.TREASURY],
  ["Donation Split", CONTRACTS.DONATION_SPLIT],
] as const;

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // about
        </p>
        <h1 className="mt-2 font-display text-5xl">PROOF<br /><span className="text-primary">OF PURPOSE</span></h1>
      </div>
      <section className="prose prose-invert mt-8 max-w-none space-y-5 text-sm">
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
          // an on-chain nonprofit · first of its kind
        </p>
        <p>
          Proof of Purpose is an on-chain rewards system for youth in the community. Champions
          complete real-world bounties posted by trusted partner orgs (Catalysts) and earn
          $PURPOSE — a soulbound token redeemable only at approved local vendors.
        </p>
        <p>
          Built by <span className="text-foreground">MetaPhysical LLC</span>. We believe Proof of
          Purpose is the first nonprofit to operate end-to-end on-chain — treasury, governance,
          rewards, and redemptions all verifiable on Base.
        </p>
        <h2 className="font-display text-2xl text-foreground">A NOTE ON TAX-DEDUCTIBILITY</h2>
        <p>
          Federal frameworks for on-chain charitable entities are still being written. Pending
          legislation like the <span className="text-foreground">CLARITY Act</span> is expected
          to define how protocols like ours can offer donors formal tax-deductible status. Until
          that clears, donations to the Treasury should not be treated as tax-deductible.
        </p>
        <h2 className="font-display text-2xl text-foreground">HOW IT WORKS</h2>
        <ol className="list-decimal pl-6 text-muted-foreground">
          <li>Donors fund the treasury in USDC.</li>
          <li>Catalysts propose bounties; donors + catalysts + admin vote to approve.</li>
          <li>Champions complete bounties and earn $PURPOSE.</li>
          <li>Vendors scan a champion's QR and redeem $PURPOSE for USDC at 1:1.</li>
        </ol>
        <h2 className="font-display text-2xl text-foreground">CONTRACTS · BASE 8453</h2>
        <ul className="space-y-1 font-mono text-xs">
          {LINKS.map(([label, addr]) => (
            <li key={addr}>
              <span className="text-muted-foreground">{label}:</span>{" "}
              <a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://basescan.org/address/${addr}`}>{addr}</a>
            </li>
          ))}
        </ul>
        <p className="mt-10 border-t-2 border-foreground pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // built by MetaPhysical LLC · © {new Date().getFullYear()}
        </p>
      </section>
    </main>
  );
}
