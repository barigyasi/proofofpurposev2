import { Link } from "react-router-dom";
import { CONTRACTS, CONTRACTS_V2 } from "@/config/contracts";
import { Seo } from "@/components/Seo";

const LINKS = [
  ["PURPOSE Token (V2)", CONTRACTS_V2.PURPOSE_TOKEN],
  ["Bounty Manager (V2)", CONTRACTS_V2.BOUNTY_MANAGER],
  ["Vendor Redemption (V2)", CONTRACTS_V2.VENDOR_REDEMPTION],
  ["Refund Pool", CONTRACTS_V2.REFUND_POOL],
  ["Receipt NFT", CONTRACTS_V2.RECEIPT_NFT],
  ["Treasury", CONTRACTS.TREASURY],
  ["Donation Split", CONTRACTS.DONATION_SPLIT],
] as const;

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Seo
        title="About — Proof of Purpose"
        description="An on-chain nonprofit rewarding youth for real-world community work on Base. Learn how Donors, Champions, Catalysts, and Vendors connect."
        path="/about"
      />
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // about
        </p>
        <h1 className="mt-2 font-display text-5xl">PROOF<br /><span className="text-primary">OF PURPOSE</span></h1>
      </div>
      <section className="prose prose-invert mt-8 max-w-none space-y-5 text-sm">
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
          // an on-chain nonprofit
        </p>
        <p>
          Proof of Purpose is an on-chain rewards system for youth in the community. Champions
          complete real-world bounties posted by trusted partner orgs (Catalysts) and earn
          $PURPOSE — a soulbound token redeemable only at approved local vendors.
        </p>

        <Link
          to="/about/whitepaper"
          className="brutal brutal-hover not-prose mt-2 inline-flex items-center px-6 py-4 font-display text-lg"
        >
          READ THE FULL WHITEPAPER →
        </Link>

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
          <li>Vendors scan a champion's QR; the charge is escrowed (lock → capture), then settled 1:1 in USDC after a short auth window.</li>
          <li>Within the refund window, vendors or admins can issue a refund — USDC pulls from the vendor or the Refund Pool, and $PURPOSE returns to the champion.</li>
          <li>Every settled redemption mints a soulbound on-chain <span className="text-foreground">Receipt NFT</span> to the champion as a permanent record.</li>
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

        <div className="not-prose mt-10 border-t-2 border-foreground pt-6">
          <Link
            to="/about/whitepaper"
            className="brutal-primary brutal-hover inline-flex items-center px-6 py-4 font-display text-lg"
          >
            READ THE FULL WHITEPAPER →
          </Link>
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            Canonical docs:{" "}
            <a
              href="https://docs.popmgm.org"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              docs.popmgm.org
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
