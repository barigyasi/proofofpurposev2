import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getContract, readContract } from "thirdweb";
import { supabase } from "@/integrations/supabase/client";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { ACTIVE, PURPOSE_DECIMALS } from "@/config/contracts";
import { Seo } from "@/components/Seo";

function useImpactStats() {
  return useQuery({
    queryKey: ["impact-stats"],
    queryFn: async () => {
      const purpose = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: ACTIVE.PURPOSE_TOKEN,
      });

      const [treasuryBalanceWei, totalSupplyWei, donationsRes, championsRes, bountiesRes, vendorsRes] =
        await Promise.all([
          readContract({
            contract: purpose,
            method: "function balanceOf(address) view returns (uint256)",
            params: [ACTIVE.TREASURY as `0x${string}`],
          }) as Promise<bigint>,
          readContract({
            contract: purpose,
            method: "function totalSupply() view returns (uint256)",
          }) as Promise<bigint>,
          supabase.from("donations").select("amount_usdc, donor_wallet", { count: "exact" }).eq("status", "confirmed"),
          supabase.rpc("public_role_count", { _role: "champion" }),
          supabase.from("bounties").select("status", { count: "exact" }),
          supabase.from("vendors_public_view" as never).select("id", { count: "exact", head: true }),
        ]);

      const treasuryPurpose = Number(treasuryBalanceWei) / 10 ** PURPOSE_DECIMALS;
      const totalMinted = Number(totalSupplyWei) / 10 ** PURPOSE_DECIMALS;

      const donations = donationsRes.data ?? [];
      const totalDonatedUsdc = donations.reduce((s, d) => s + Number(d.amount_usdc), 0);
      const uniqueDonors = new Set(donations.map((d) => d.donor_wallet.toLowerCase())).size;

      const bounties = bountiesRes.data ?? [];
      const bountiesCompleted = bounties.filter((b) => b.status === "completed").length;

      return {
        totalDonatedUsdc,
        uniqueDonors,
        totalMinted,
        treasuryPurpose,
        championCount: Number(championsRes.data ?? 0),
        bountyCount: bounties.length,
        bountiesCompleted,
        vendorCount: vendorsRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="brutal p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-3 font-display text-5xl text-primary sm:text-6xl">{value}</p>
      {sub && <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Impact() {
  const { data, isLoading } = useImpactStats();

  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Seo
        title="Impact — Proof of Purpose"
        description="Live on-chain stats: total donated, $PURPOSE minted, champions served, bounties completed, vendors onboarded. Every number verifiable on Base."
        path="/impact"
      />
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // live · base mainnet
        </p>
        <h1 className="mt-2 font-display text-5xl sm:text-7xl">
          THE<br />
          <span className="text-primary">RECEIPTS</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // every dollar, token, and bounty — verifiable on-chain
        </p>
      </div>

      {isLoading || !data ? (
        <p className="mt-10 font-mono text-xs text-muted-foreground">// loading on-chain data…</p>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="01 / total donated" value={fmtUsd(data.totalDonatedUsdc)} sub={`from ${fmt(data.uniqueDonors)} wallets`} />
            <Stat label="02 / $purpose minted" value={fmt(data.totalMinted)} sub="ever distributed" />
            <Stat label="03 / treasury balance" value={fmt(data.treasuryPurpose)} sub="$purpose · undisbursed" />
            <Stat label="04 / champions" value={fmt(data.championCount)} sub="onboarded youth" />
            <Stat label="05 / bounties" value={fmt(data.bountiesCompleted)} sub={`of ${fmt(data.bountyCount)} run`} />
            <Stat label="06 / vendors" value={fmt(data.vendorCount)} sub="approved · accepting $purpose" />
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <a
              href={`https://basescan.org/address/${ACTIVE.TREASURY}`}
              target="_blank"
              rel="noreferrer"
              className="brutal brutal-hover block p-6"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">// treasury</p>
              <p className="mt-2 font-display text-2xl">VERIFY ON BASESCAN ↗</p>
              <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{ACTIVE.TREASURY}</p>
            </a>
            <a
              href={`https://basescan.org/token/${ACTIVE.PURPOSE_TOKEN}`}
              target="_blank"
              rel="noreferrer"
              className="brutal brutal-hover block p-6"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">// $purpose token</p>
              <p className="mt-2 font-display text-2xl">CONTRACT ↗</p>
              <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{ACTIVE.PURPOSE_TOKEN}</p>
            </a>
          </div>
        </>
      )}

      <div className="mt-12 flex flex-wrap gap-4">
        <Link to="/donate" className="brutal-primary brutal-hover inline-flex items-center px-8 py-5 font-display text-xl">
          DONATE →
        </Link>
        <Link to="/vendors" className="brutal brutal-hover inline-flex items-center px-8 py-5 font-display text-xl">
          SEE VENDORS
        </Link>
        <Link to="/governance/past" className="brutal brutal-hover inline-flex items-center px-8 py-5 font-display text-xl">
          PAST PROPS
        </Link>
      </div>
    </main>
  );
}
