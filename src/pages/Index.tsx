import { Link } from "react-router-dom";
import { TreasuryStat } from "@/components/TreasuryStat";

const Index = () => {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="border-y-2 border-foreground py-10 sm:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // popmgm.org · base mainnet
        </p>
        <h1 className="mt-6 font-display text-[14vw] leading-[0.85] sm:text-[110px] lg:text-[160px]">
          PROOF
          <br />
          <span className="text-primary">OF</span>
          <br />
          PURPOSE
        </h1>
      </section>

      <section className="mt-8">
        <TreasuryStat />
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="brutal p-6">
          <p className="font-mono text-xs uppercase text-muted-foreground">01 / DONORS</p>
          <h3 className="mt-3 font-display text-3xl">FUND<br />THE MISSION</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Every dollar lands on-chain. No middlemen. Receipts forever.
          </p>
        </div>
        <div className="brutal p-6">
          <p className="font-mono text-xs uppercase text-muted-foreground">02 / CHAMPIONS</p>
          <h3 className="mt-3 font-display text-3xl">EARN<br />$PURPOSE</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Complete bounties. Stack tokens. Spend at approved vendors.
          </p>
        </div>
        <div className="brutal p-6">
          <p className="font-mono text-xs uppercase text-muted-foreground">03 / VENDORS</p>
          <h3 className="mt-3 font-display text-3xl">REDEEM<br />FOR USDC</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Scan, burn, paid. Public ledger of every redemption.
          </p>
        </div>
      </section>

      <section className="mt-12 flex flex-wrap items-center gap-4">
        <Link
          to="/login"
          className="brutal-primary brutal-hover inline-flex items-center px-8 py-5 font-display text-xl"
        >
          ENTER →
        </Link>
        <Link
          to="/donate"
          className="brutal brutal-hover inline-flex items-center px-8 py-5 font-display text-xl"
        >
          DONATE
        </Link>
        <Link
          to="/login?redirect=/onboarding"
          className="brutal brutal-hover inline-flex items-center px-8 py-5 font-display text-xl"
        >
          PARTNER WITH US
        </Link>
      </section>
    </main>
  );
};

export default Index;
