import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDraftVotes, type DraftWithVotes } from "@/hooks/useDraftVotes";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";

type Metrics = {
  walletsVoted: number;
  purposeCommitted: number;
  actualSignups: number;
  rewardsMintedPurpose: number;
  isSnapshot: boolean;
};

type DraftWithMetrics = DraftWithVotes & { metrics: Metrics; result: "passed" | "failed" | "on-chain" | "rejected" };

function classifyOutcome(d: DraftWithVotes): DraftWithMetrics["result"] | null {
  if (d.status === "rejected") return "rejected";
  if (d.executed_at && d.on_chain_bounty_id) return "on-chain";
  if (d.executed_at) return "passed";
  if (new Date(d.vote_closes_at).getTime() > Date.now()) return null;
  return d.yes_count > d.no_count ? "passed" : "failed";
}

export default function PastProps() {
  const { drafts, loading } = useDraftVotes();
  const { roles } = useEffectiveRoles();
  const isAdmin = roles.includes("admin");
  const [snapping, setSnapping] = useState<string | null>(null);
  const [voterCounts, setVoterCounts] = useState<Record<string, number>>({});
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});
  const [rewardsMinted, setRewardsMinted] = useState<Record<string, number>>({});

  // Pull metrics: distinct voter wallets per draft, signups + rewards per on-chain bounty
  useEffect(() => {
    (async () => {
      const draftIds = drafts.map((d) => d.id);
      if (draftIds.length === 0) return;

      const { data: voteRows } = await supabase
        .from("bounty_draft_votes")
        .select("draft_id,voter_wallet,voter_id")
        .in("draft_id", draftIds);
      const voters: Record<string, Set<string>> = {};
      (voteRows ?? []).forEach((v) => {
        const key = (v.voter_wallet || v.voter_id) as string;
        if (!voters[v.draft_id]) voters[v.draft_id] = new Set();
        voters[v.draft_id].add(key);
      });
      const counts: Record<string, number> = {};
      Object.entries(voters).forEach(([k, s]) => { counts[k] = s.size; });
      setVoterCounts(counts);

      const onChainIds = drafts
        .map((d) => d.on_chain_bounty_id)
        .filter((id): id is number => id != null);
      if (onChainIds.length === 0) return;

      const [{ data: signups }, { data: rewards }] = await Promise.all([
        supabase.from("bounty_signups").select("on_chain_bounty_id").in("on_chain_bounty_id", onChainIds),
        supabase.from("bounty_rewards").select("on_chain_bounty_id,purpose_amount").in("on_chain_bounty_id", onChainIds),
      ]);
      const sMap: Record<string, number> = {};
      (signups ?? []).forEach((s) => {
        const id = String(s.on_chain_bounty_id);
        sMap[id] = (sMap[id] ?? 0) + 1;
      });
      setSignupCounts(sMap);
      const rMap: Record<string, number> = {};
      (rewards ?? []).forEach((r) => {
        const id = String(r.on_chain_bounty_id);
        rMap[id] = (rMap[id] ?? 0) + Number(r.purpose_amount ?? 0);
      });
      setRewardsMinted(rMap);
    })();
  }, [drafts]);

  const past: DraftWithMetrics[] = useMemo(() => {
    return drafts
      .map((d) => {
        const result = classifyOutcome(d);
        if (!result) return null;
        const onChainKey = d.on_chain_bounty_id != null ? String(d.on_chain_bounty_id) : null;
        const hasSnapshot = d.snapshot_at != null;
        const metrics: Metrics = {
          walletsVoted: voterCounts[d.id] ?? d.yes_count + d.no_count + d.abstain_count,
          purposeCommitted: Number(d.reward_purpose) * Number(d.max_participants),
          actualSignups: hasSnapshot
            ? Number(d.completed_participants ?? 0)
            : (onChainKey ? (signupCounts[onChainKey] ?? 0) : 0),
          rewardsMintedPurpose: hasSnapshot
            ? Number(d.purpose_minted_snapshot ?? 0)
            : (onChainKey ? (rewardsMinted[onChainKey] ?? 0) : 0),
          isSnapshot: hasSnapshot,
        };
        return { ...d, metrics, result } as DraftWithMetrics;
      })
      .filter((d): d is DraftWithMetrics => d !== null);
  }, [drafts, voterCounts, signupCounts, rewardsMinted]);

  const hallOfFame = useMemo(() => {
    return [...past]
      .filter((d) => d.result === "on-chain" || d.result === "passed")
      .sort((a, b) => {
        const aScore = a.metrics.actualSignups * 10 + Number(a.metrics.rewardsMintedPurpose);
        const bScore = b.metrics.actualSignups * 10 + Number(b.metrics.rewardsMintedPurpose);
        return bScore - aScore;
      })
      .slice(0, 3);
  }, [past]);

  const totals = useMemo(() => {
    return past.reduce(
      (acc, d) => {
        acc.props += 1;
        acc.passed += d.result === "passed" || d.result === "on-chain" ? 1 : 0;
        acc.failed += d.result === "failed" || d.result === "rejected" ? 1 : 0;
        acc.wallets += d.metrics.walletsVoted;
        acc.signups += d.metrics.actualSignups;
        acc.minted += Number(d.metrics.rewardsMintedPurpose);
        return acc;
      },
      { props: 0, passed: 0, failed: 0, wallets: 0, signups: 0, minted: 0 },
    );
  }, [past]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // proof of purpose · archive
        </p>
        <h1 className="mt-2 font-display text-5xl">PAST PROPS</h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Every closed proposal — passed, failed, executed on-chain. Track wallets that voted,
          PURPOSE committed, real participants, and tokens minted to ignite movements.
        </p>
        <Link
          to="/governance"
          className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
        >
          ← active proposals
        </Link>
      </div>

      {/* Aggregate stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["TOTAL", totals.props],
          ["PASSED", totals.passed],
          ["WALLETS", totals.wallets],
          ["MINTED", `${totals.minted.toLocaleString()} ⨯`],
        ].map(([label, value]) => (
          <div key={label as string} className="brutal p-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Hall of Fame */}
      {hallOfFame.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between border-b-2 border-foreground pb-2">
            <h2 className="font-display text-2xl">🏆 PROP HALL OF FAME</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // top {hallOfFame.length} by impact
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {hallOfFame.map((d, i) => (
              <div key={d.id} className="brutal-primary p-4">
                <p className="font-display text-3xl leading-none">#{i + 1}</p>
                <h3 className="mt-2 font-display text-lg">{d.name}</h3>
                {d.location && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest opacity-70">
                    📍 {d.location}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
                  <div>
                    <p className="opacity-70">PARTICIPANTS</p>
                    <p className="font-display text-base normal-case">{d.metrics.actualSignups}</p>
                  </div>
                  <div>
                    <p className="opacity-70">MINTED</p>
                    <p className="font-display text-base normal-case">{Number(d.metrics.rewardsMintedPurpose).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full list */}
      <section className="mt-10">
        <h2 className="border-b-2 border-foreground pb-2 font-display text-2xl">ARCHIVE</h2>
        {loading ? (
          <p className="mt-6 font-mono text-xs text-muted-foreground">// loading…</p>
        ) : past.length === 0 ? (
          <p className="mt-6 font-mono text-xs text-muted-foreground">// no closed proposals yet</p>
        ) : (
          <div className="mt-4 space-y-3">
            {past.map((d) => {
              const total = d.yes_count + d.no_count + d.abstain_count;
              const yesPct = total ? Math.round((d.yes_count / total) * 100) : 0;
              const tone =
                d.result === "on-chain"
                  ? "border-primary text-primary"
                  : d.result === "passed"
                  ? "border-foreground"
                  : "border-destructive text-destructive";
              return (
                <div key={d.id} className="brutal p-0">
                  <div className={`flex items-center justify-between border-b-2 bg-secondary px-4 py-2 ${tone}`}>
                    <p className="font-mono text-[10px] uppercase tracking-widest">
                      // {d.result}
                      {d.location ? ` · ${d.location}` : ""}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(d.vote_closes_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl">{d.name}</h3>
                        {d.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
                        )}
                      </div>
                      <div className="brutal shrink-0 px-3 py-2 text-right">
                        <p className="font-display text-lg leading-none">{Number(d.reward_purpose).toLocaleString()}</p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest">PURPOSE ea.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {[
                        ["WALLETS VOTED", d.metrics.walletsVoted],
                        ["FUEL", `${d.yes_count} (${yesPct}%)`],
                        ["STALL", d.no_count],
                        ["SLOTS", d.max_participants],
                        ["SIGNUPS", d.metrics.actualSignups],
                      ].map(([label, value]) => (
                        <div key={label as string} className="brutal p-2">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
                          <p className="mt-1 font-display text-base leading-none">{value}</p>
                        </div>
                      ))}
                    </div>

                    {d.metrics.rewardsMintedPurpose > 0 && (
                      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-primary">
                        ⚡ {Number(d.metrics.rewardsMintedPurpose).toLocaleString()} PURPOSE minted to participants
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
