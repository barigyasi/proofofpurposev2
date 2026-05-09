import { Link } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { AddressLabel } from "@/components/AddressLabel";

const TILES = [
  { to: "/admin/bounties", label: "BOUNTIES", desc: "Create, fund, complete bounties" },
  { to: "/admin/applicants", label: "APPLICANTS", desc: "Review pending champions, vendors, catalysts" },
  { to: "/admin/catalysts", label: "CATALYSTS", desc: "Approve / revoke partner orgs" },
  { to: "/admin/vendors", label: "VENDORS", desc: "Approve / revoke vendor wallets" },
  { to: "/admin/donations", label: "DONATIONS", desc: "Live ledger of inflows" },
  { to: "/admin/treasury", label: "TREASURY", desc: "USDC + PURPOSE positions" },
  { to: "/governance", label: "GOVERNANCE", desc: "DAO proposals + votes" },
  { to: "/admin/audit", label: "AUDIT LOG", desc: "Every admin action, on-chain + off" },
  { to: "/admin/waitlist", label: "WAITLIST", desc: "Pre-launch signups" },
];

export default function Admin() {
  const account = useActiveAccount();


  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // super admin
        </p>
        <h1 className="mt-3 font-display text-5xl sm:text-7xl">
          MISSION<br />
          <span className="text-primary">CONTROL</span>
        </h1>
        {account && (
          <div className="mt-3">
            <AddressLabel address={account.address} link={false} className="text-xs" />
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.label} to={t.to} className="brutal brutal-hover block p-6">
            <h3 className="font-display text-2xl">{t.label}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
