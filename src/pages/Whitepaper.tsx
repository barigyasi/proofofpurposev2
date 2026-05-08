import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CONTRACTS } from "@/config/contracts";

const TOC = [
  ["executive-summary", "Executive Summary"],
  ["roles", "Roles"],
  ["architecture", "System Architecture"],
  ["contracts", "Smart Contract Infrastructure"],
  ["functionality", "Functionality & Logic"],
  ["tokenomics", "Tokenomics"],
  ["governance", "Governance"],
  ["security", "Security"],
  ["open-source", "Open Source"],
  ["getting-started", "Getting Started by Role"],
  ["conduct", "Code of Conduct"],
  ["audit", "Audit & Oversight"],
  ["roadmap", "Roadmap"],
] as const;

type ContractRow = { label: string; addr: string | null; desc: string; pending?: boolean };

const CONTRACT_ROWS: ContractRow[] = [
  { label: "Treasury", addr: CONTRACTS.TREASURY, desc: "USDC reserve backing every $PURPOSE in circulation." },
  { label: "Donation Split", addr: CONTRACTS.DONATION_SPLIT, desc: "Routes incoming USDC: 90% Treasury, 8% admin multisig, 2% founder." },
  { label: "PURPOSE Token (V2)", addr: null, desc: "Soulbound community credit minted to Champions, burned at redemption.", pending: true },
  { label: "Bounty Manager (V2)", addr: null, desc: "On-chain registry for bounty payouts and on-chain check-ins.", pending: true },
  { label: "Vendor Redemption (V2)", addr: null, desc: "Burns $PURPOSE and pays vendors 1:1 in USDC.", pending: true },
];

function Anchor({ id, label }: { id: string; label: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-display text-3xl text-foreground sm:text-4xl">
      {label}
    </h2>
  );
}

export default function Whitepaper() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Whitepaper · Proof of Purpose";
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute("content") ?? "";
    meta?.setAttribute(
      "content",
      "Proof of Purpose whitepaper: on-chain youth impact protocol on Base. Roles, smart contracts, tokenomics, governance, security, and how to participate.",
    );
    return () => {
      document.title = prevTitle;
      meta?.setAttribute("content", prev);
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // whitepaper · v1
        </p>
        <h1 className="mt-2 font-display text-[12vw] leading-[0.9] sm:text-7xl">
          PROOF OF<br /><span className="text-primary">PURPOSE</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          A wallet-primary, on-chain youth impact protocol on Base. Donors fund a transparent
          treasury in USDC. Catalysts propose bounties. Champions complete them and earn
          $PURPOSE — a soulbound community credit redeemable only at approved local vendors at
          1:1 USDC.
        </p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* TOC */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // contents
          </p>
          <nav className="mt-3 flex flex-col gap-1.5 text-xs">
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-muted-foreground hover:text-primary">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="space-y-14 text-sm text-muted-foreground">
          {/* Executive Summary */}
          <section className="space-y-4">
            <Anchor id="executive-summary" label="EXECUTIVE SUMMARY" />
            <p>
              Proof of Purpose empowers youth — <span className="text-foreground">Champions</span>
              — to earn on-chain rewards for completing real-world tasks that benefit their
              communities. Built on Base, the platform combines modern Web3 infrastructure with
              familiar Web2 tools to ensure transparency, accessibility, and frictionless
              participation.
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li><span className="text-foreground">Champions</span> — youth who complete verified tasks for rewards.</li>
              <li><span className="text-foreground">Catalysts</span> — partner nonprofits and organizers who propose bounties.</li>
              <li><span className="text-foreground">Vendors</span> — local businesses who redeem tokens for instant USDC.</li>
              <li><span className="text-foreground">Donors</span> — public supporters who fund the program transparently on-chain.</li>
              <li><span className="text-foreground">Admins</span> — protocol stewards with role-management and emergency powers.</li>
            </ul>
          </section>

          {/* Roles */}
          <section className="space-y-4">
            <Anchor id="roles" label="ROLES" />

            <div className="brutal p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// champions</p>
              <h3 className="mt-2 font-display text-2xl text-foreground">YOUTH PARTICIPANTS</h3>
              <p className="mt-2">
                Sign up by email (a smart wallet is auto-created with sponsored gas). Apply for
                bounties posted by Catalysts and show up to do the work. Champions never submit
                proof themselves — a Catalyst verifies attendance in person by scanning the
                Champion's QR code, which calls the Bounty Manager contract on-chain and adds
                the Champion as a verified participant. When the Catalyst ends the bounty,
                $PURPOSE is minted directly to each verified Champion's wallet, redeemable at
                approved local vendors via QR code.
              </p>
            </div>

            <div className="brutal p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// catalysts</p>
              <h3 className="mt-2 font-display text-2xl text-foreground">PARTNER ORGS</h3>
              <p className="mt-2">
                Vetted nonprofits and organizers. Propose bounties (title, reward, description,
                quota), review Champion applicants, and confirm completions. All actions are
                logged for audit.
              </p>
            </div>

            <div className="brutal p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// vendors</p>
              <h3 className="mt-2 font-display text-2xl text-foreground">REDEMPTION PARTNERS</h3>
              <p className="mt-2">
                Approved local businesses scan a Champion's QR code in person (or process an
                online checkout). The protocol's backend signer settles the redemption: $PURPOSE
                is burned and the vendor receives 1:1 USDC from the Treasury. Vendors never
                broadcast their own transactions.
              </p>
            </div>

            <div className="brutal p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// donors</p>
              <h3 className="mt-2 font-display text-2xl text-foreground">SUPPORTERS</h3>
              <p className="mt-2">
                Donate USDC (or pay by card via thirdweb's onramp). Every donation routes
                through the Donation Split contract and is publicly verifiable on Base. Donor
                impact is tracked in the dashboard.
              </p>
            </div>
          </section>

          {/* Architecture */}
          <section className="space-y-4">
            <Anchor id="architecture" label="SYSTEM ARCHITECTURE" />
            <p>
              Proof of Purpose runs on a hybrid Web2/Web3 stack chosen for auditability,
              accessibility, and speed of iteration:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li><span className="text-foreground">Frontend</span> — React 18, Vite, TypeScript, Tailwind CSS.</li>
              <li><span className="text-foreground">Wallets</span> — thirdweb in-app smart wallets (email, Google, Apple, passkey) with sponsored gas. Admin tools use connected EOAs (MetaMask / Coinbase / WalletConnect).</li>
              <li><span className="text-foreground">Smart contracts</span> — Base mainnet (chainId 8453): soulbound $PURPOSE, Bounty Manager, Vendor Redemption, Treasury, Donation Split.</li>
              <li><span className="text-foreground">Backend</span> — Lovable Cloud: Postgres with row-level security, edge functions, file storage, and authentication.</li>
              <li><span className="text-foreground">QR redemption</span> — in-browser camera scanner; settlement signed server-side.</li>
              <li><span className="text-foreground">Donations</span> — thirdweb PayEmbed for USDC and card-to-crypto.</li>
            </ul>
          </section>

          {/* Contracts */}
          <section className="space-y-4">
            <Anchor id="contracts" label="SMART CONTRACT INFRASTRUCTURE" />

            <div className="overflow-x-auto">
              <table className="w-full border-2 border-foreground text-xs">
                <thead className="bg-foreground text-background">
                  <tr>
                    <th className="px-3 py-2 text-left font-display text-sm">Contract</th>
                    <th className="px-3 py-2 text-left font-display text-sm">Address</th>
                    <th className="px-3 py-2 text-left font-display text-sm">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRACT_ROWS.map(({ label, addr, desc, pending }) => (
                    <tr key={label} className="border-t border-foreground/30 align-top">
                      <td className="px-3 py-2 font-display text-foreground">{label}</td>
                      <td className="px-3 py-2 font-mono">
                        {pending || !addr ? (
                          <span className="rounded border border-primary/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                            Not yet deployed
                          </span>
                        ) : (
                          <a
                            className="text-primary underline break-all"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://basescan.org/address/${addr}`}
                          >
                            {addr}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs">
              <span className="text-foreground">Note:</span> the V2 contracts (PURPOSE Token,
              Bounty Manager, Vendor Redemption) are finalized but not yet deployed to Base
              mainnet. Earlier V1 addresses have been retired and are intentionally omitted to
              avoid ambiguity. Addresses will be published here on the day of redeploy.
            </p>

            <h3 className="mt-4 font-display text-xl text-foreground">REVENUE SPLIT</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li><span className="text-foreground">90%</span> → Treasury (youth bounty payouts).</li>
              <li><span className="text-foreground">8%</span> → Admin multisig (operational incentives).</li>
              <li><span className="text-foreground">2%</span> → Founder wallet (oversight + sustainability).</li>
            </ul>

            <h3 className="mt-4 font-display text-xl text-foreground">EMERGENCY FUNCTIONS</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li>Master admin can pause core contracts.</li>
              <li>Catalysts and vendors can be frozen if audit logs show misconduct.</li>
              <li>Settlement signer keys can be rotated server-side.</li>
            </ul>
          </section>

          {/* Functionality */}
          <section className="space-y-4">
            <Anchor id="functionality" label="FUNCTIONALITY & LOGIC" />

            <h3 className="font-display text-xl text-foreground">ONBOARDING</h3>
            <p>
              New users enter the app, choose a role on the onboarding screen
              (Donor / Catalyst / Vendor / Champion), and submit an application. Admins approve
              applications and assign roles. Approved users land on a role-specific dashboard.
            </p>

            <h3 className="font-display text-xl text-foreground">BOUNTY LIFECYCLE</h3>
            <ol className="list-decimal space-y-1 pl-6">
              <li>Catalyst proposes a bounty (title, reward, description, image, quota).</li>
              <li>Bounty is approved (currently admin-gated; moving to on-chain governance).</li>
              <li>Champion applies and is approved into the participant pool.</li>
              <li>At the event, the Catalyst scans each Champion's wallet QR code in person; the scan calls <code className="text-foreground">addParticipant</code> on the Bounty Manager contract, marking attendance on-chain. Champions never upload proof themselves.</li>
              <li>When the Catalyst ends the bounty, the Bounty Manager mints $PURPOSE to every verified participant in a single on-chain settlement.</li>
            </ol>

            <h3 className="font-display text-xl text-foreground">REDEMPTION</h3>
            <p>
              Champion presents a wallet QR code to a vendor (or proceeds to checkout in the
              online shop). The backend signer calls{" "}
              <code className="text-foreground">redeemFor(vendor, champion, amount)</code> on
              the Vendor Redemption contract: $PURPOSE is burned and the vendor wallet receives
              an equivalent USDC payout from the Treasury — instantly and verifiably on-chain.
            </p>

            <h3 className="font-display text-xl text-foreground">DONATIONS</h3>
            <p>
              Donors visit <Link to="/donate" className="text-primary underline">/donate</Link>{" "}
              (signed in or as a guest), pay USDC or card via thirdweb PayEmbed, and the
              Donation Split contract distributes funds atomically. Each donation is logged with
              wallet, timestamp, and amount.
            </p>
          </section>

          {/* Tokenomics */}
          <section className="space-y-4">
            <Anchor id="tokenomics" label="TOKENOMICS" />
            <ul className="list-disc space-y-1 pl-6">
              <li><span className="text-foreground">Soulbound:</span> $PURPOSE cannot be traded, transferred peer-to-peer, or withdrawn off-platform.</li>
              <li><span className="text-foreground">Earned:</span> only through verified real-world community work.</li>
              <li><span className="text-foreground">Redeemable:</span> only at approved vendors at a fixed 1 $PURPOSE = 1 USDC of verified community impact.</li>
              <li><span className="text-foreground">Backed:</span> 1:1 by USDC reserves in the Treasury.</li>
            </ul>
            <p>
              Initial scale modeling assumes bounties of 25–250 $PURPOSE and 30–100 bounties
              per city per week. A multi-city deployment projects multi-million-dollar
              throughput per year in distributed youth rewards.
            </p>
          </section>

          {/* Governance */}
          <section className="space-y-4">
            <Anchor id="governance" label="GOVERNANCE" />
            <p>
              Voting power is membership-based, not token-weighted:{" "}
              <span className="text-foreground">1 active monthly membership NFT = 1 vote</span>.
              $PURPOSE balances confer <span className="text-foreground">no voting power at all</span> —
              by design. Champions (youth) are the largest $PURPOSE holders in the system, and
              $PURPOSE is a soulbound community credit, not a governance asset.
            </p>
            <p>
              The membership-NFT model also caps influence at the per-wallet level: even a
              well-funded actor who acquired many memberships would still need each one tied to
              a real, active monthly subscription, with rate-limits and review on issuance. This
              keeps governance proportional to ongoing community participation rather than
              capital.
            </p>
            <p>
              Long-term, votes are tallied on-chain via a thirdweb prebuilt Vote contract fed by
              a <code className="text-foreground">vPURPOSE</code> shadow ERC20Votes token kept
              1:1 in sync with active memberships by the protocol's backend. The current in-app
              tally is an interim snapshot until the on-chain Vote contract is deployed.
            </p>
            <p>
              See <Link to="/governance" className="text-primary underline">/governance</Link>{" "}
              for active proposals.
            </p>
          </section>

          {/* Security */}
          <section className="space-y-4">
            <Anchor id="security" label="SECURITY" />
            <ul className="list-disc space-y-1 pl-6">
              <li><span className="text-foreground">Role-based access</span> via Postgres row-level security and on-chain roles.</li>
              <li><span className="text-foreground">Audit logs</span> for bounty creation, approval, minting, and redemption.</li>
              <li><span className="text-foreground">Contract pausability</span> by master admin in emergencies.</li>
              <li><span className="text-foreground">Catalyst / vendor freezing</span> to halt malicious or negligent actors.</li>
              <li><span className="text-foreground">Server-side redemption signer</span> — vendor and champion devices never sign transactions; the backend signer enforces verification before settlement.</li>
              <li><span className="text-foreground">Allowlisted admin wallets</span> — admin entry is restricted to a server-side wallet allowlist.</li>
            </ul>
          </section>

          {/* Getting started */}
          <section className="space-y-4">
            <Anchor id="getting-started" label="GETTING STARTED BY ROLE" />

            <div className="brutal p-5">
              <h3 className="font-display text-xl text-foreground">CHAMPIONS</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                <li>Tap <span className="font-display text-foreground">ENTER</span> and sign in by email, Google, Apple, or passkey.</li>
                <li>Choose Champion in onboarding and submit your application.</li>
                <li><span className="text-foreground">If you're under 18</span>, a parent or legal guardian must complete the application with you.</li>
                <li>A short call or in-person meeting with an admin confirms your interest.</li>
                <li>Your guardian signs a brief consent form for participation.</li>
                <li>Once approved, browse bounties, complete them, and redeem $PURPOSE at local vendors.</li>
              </ol>
              <Link to="/apply/champion" className="mt-3 inline-block text-primary underline">Apply as a Champion →</Link>
            </div>

            <div className="brutal p-5">
              <h3 className="font-display text-xl text-foreground">CATALYSTS</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                <li>Tap <span className="font-display text-foreground">ENTER</span> and choose Catalyst in onboarding.</li>
                <li>Submit your organization details and credentials.</li>
                <li>After vetting, propose bounties, review Champion applications, and confirm completions.</li>
              </ol>
              <Link to="/apply/catalyst" className="mt-3 inline-block text-primary underline">Apply as a Catalyst →</Link>
            </div>

            <div className="brutal p-5">
              <h3 className="font-display text-xl text-foreground">VENDORS</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                <li>Tap <span className="font-display text-foreground">ENTER</span> and choose Vendor in onboarding.</li>
                <li>Provide business info and your payout wallet address.</li>
                <li>Once approved, scan Champion QR codes and receive automatic 1:1 USDC payouts.</li>
              </ol>
              <Link to="/apply/vendor" className="mt-3 inline-block text-primary underline">Apply as a Vendor →</Link>
            </div>

            <div className="brutal p-5">
              <h3 className="font-display text-xl text-foreground">DONORS</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                <li>Visit the donate page (no account required).</li>
                <li>Choose a one-time or monthly amount.</li>
                <li>Pay with card or USDC. Track your impact in the dashboard if signed in.</li>
              </ol>
              <Link to="/donate" className="mt-3 inline-block text-primary underline">Donate →</Link>
            </div>
          </section>

          {/* Conduct */}
          <section className="space-y-4">
            <Anchor id="conduct" label="CODE OF CONDUCT" />
            <p>
              Proof of Purpose is built on transparency and trust. Misuse will not be tolerated.
            </p>

            <h3 className="font-display text-xl text-foreground">GENERAL (ALL USERS)</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li>Use real, verifiable information when signing up.</li>
              <li>No impersonation or wallet sharing.</li>
              <li>All token activity must reflect real-world actions.</li>
              <li>Attempting to game the system results in immediate review.</li>
            </ul>

            <h3 className="font-display text-xl text-foreground">CATALYST RULES</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li>Only confirm completions after verifying real-world proof.</li>
              <li>No bulk or auto-approval of bounties.</li>
              <li>Maintain an audit trail for every task.</li>
              <li>Repeated negligence may result in freeze or removal.</li>
            </ul>

            <h3 className="font-display text-xl text-foreground">CHAMPION RULES</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li>Only sign up for bounties you intend to complete.</li>
              <li>Provide real evidence of completion.</li>
              <li>Sharing wallet access results in a ban.</li>
            </ul>

            <h3 className="font-display text-xl text-foreground">VENDOR RULES</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li>Only redeem $PURPOSE in person (or through the official online shop) against a Champion's verified QR.</li>
              <li>No redemption on behalf of others.</li>
              <li>Violations may result in disqualification and removal from payout contracts.</li>
            </ul>
          </section>

          {/* Audit */}
          <section className="space-y-4">
            <Anchor id="audit" label="AUDIT & OVERSIGHT" />
            <p>Transparency is embedded at the contract and database level.</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>All admin and catalyst actions are logged and reviewable.</li>
              <li>Master admin can freeze roles, pause contracts, or launch investigations.</li>
              <li>Every bounty, mint, and redemption ties to an on-chain or database event.</li>
            </ul>

            <div className="overflow-x-auto">
              <table className="w-full border-2 border-foreground text-xs">
                <thead className="bg-foreground text-background">
                  <tr>
                    <th className="px-3 py-2 text-left font-display text-sm">Violation</th>
                    <th className="px-3 py-2 text-left font-display text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-foreground/30">
                    <td className="px-3 py-2 text-foreground">First offense</td>
                    <td className="px-3 py-2">Warning + audit flag</td>
                  </tr>
                  <tr className="border-t border-foreground/30">
                    <td className="px-3 py-2 text-foreground">Second offense</td>
                    <td className="px-3 py-2">Temporary suspension</td>
                  </tr>
                  <tr className="border-t border-foreground/30">
                    <td className="px-3 py-2 text-foreground">Third offense</td>
                    <td className="px-3 py-2">Permanent ban</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs">Fraudulent use may be referred to law enforcement if necessary.</p>
          </section>

          {/* Roadmap */}
          <section className="space-y-4">
            <Anchor id="roadmap" label="ROADMAP" />
            <ul className="list-disc space-y-1 pl-6">
              <li>Multi-city expansion with sharded data architecture.</li>
              <li>Cutover to fully on-chain governance via thirdweb Vote + <code className="text-foreground">vPURPOSE</code>.</li>
              <li>Native mobile app with QR scanner and proof upload.</li>
              <li>Vendor self-onboarding with peer review.</li>
              <li>Public analytics dashboard and donor leaderboard.</li>
              <li>Tax-deductibility for donors pending federal clarity (e.g. CLARITY Act).</li>
            </ul>
          </section>

          <div className="border-t-2 border-foreground pt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // canonical docs
            </p>
            <a
              className="mt-2 inline-block text-primary underline"
              href="https://docs.popmgm.org"
              target="_blank"
              rel="noreferrer"
            >
              docs.popmgm.org →
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
