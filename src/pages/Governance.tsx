import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { useDraftVotes, type DraftWithVotes, type VoteChoice } from "@/hooks/useDraftVotes";
import { useVotingEligibility } from "@/hooks/useVotingEligibility";
import { VotingPowerCard, VotingPowerPill } from "@/components/governance/VotingPowerCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

// Cool vote labels — matches the "ignite movements" theme
const VOTE_LABEL: Record<VoteChoice, string> = {
  yes: "FUEL",
  no: "STALL",
  abstain: "PASS",
};

function Countdown({ closesAt }: { closesAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) {
    return <span className="font-mono text-[10px] uppercase tracking-widest text-destructive">// voting closed</span>;
  }
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const parts: Array<[string, string]> = [];
  if (d > 0) parts.push([String(d), "d"]);
  parts.push([String(h).padStart(2, "0"), "h"]);
  parts.push([String(m).padStart(2, "0"), "m"]);
  parts.push([String(s).padStart(2, "0"), "s"]);
  return (
    <div className="flex items-end gap-1.5 font-mono">
      {parts.map(([v, u], i) => (
        <div key={i} className="flex items-baseline gap-0.5">
          <span className="brutal bg-background px-1.5 py-0.5 font-display text-base leading-none text-primary tabular-nums">
            {v}
          </span>
          <span className="text-[9px] uppercase text-muted-foreground">{u}</span>
        </div>
      ))}
    </div>
  );
}

function outcome(d: DraftWithVotes) {
  if (d.executed_at) return d.on_chain_bounty_id ? "on-chain" : "approved";
  if (new Date(d.vote_closes_at).getTime() > Date.now()) return null;
  return d.yes_count > d.no_count ? "passed" : "failed";
}

export default function Governance() {
  const { roles } = useEffectiveRoles();
  const account = useActiveAccount();
  const { drafts: allDrafts, myVotes, loading, castVote } = useDraftVotes();

  // Active = pending_vote and voting window still open. Everything else lives on /governance/past.
  const drafts = useMemo(
    () => allDrafts.filter((d) => d.status === "pending_vote" && new Date(d.vote_closes_at).getTime() > Date.now()),
    [allDrafts],
  );
  const pastCount = allDrafts.length - drafts.length;

  const hasVoterRole = useMemo(
    () => roles.some((r) => r === "donor" || r === "catalyst" || r === "admin"),
    [roles],
  );
  const isAdmin = roles.includes("admin");
  const eligibility = useVotingEligibility(account?.address);
  // Admins can always vote; everyone else needs an active membership + delegation.
  const canVote = isAdmin || (hasVoterRole && eligibility.eligible);

  async function vote(draftId: string, choice: VoteChoice) {
    if (!account?.address) {
      toast.error("Connect your wallet to vote — votes are tied to a wallet address for the on-chain DAO.");
      return;
    }
    if (!isAdmin && !eligibility.eligible) {
      if (eligibility.reason === "no-membership")
        toast.error("Mint a membership first ($5+ on /donate).");
      else if (eligibility.reason === "not-delegated")
        toast.error("Activate your voting power first.");
      else toast.error("You're not eligible to vote yet.");
      return;
    }
    try {
      await castVote(draftId, choice, account.address);
      toast.success(`Vote recorded: ${choice}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function adminApprove(d: DraftWithVotes) {
    const { error } = await supabase
      .from("bounty_drafts")
      .update({ status: "queued", executed_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) toast.error(error.message);
    else toast.success("Approved — queued for on-chain creation");
  }

  async function adminReject(d: DraftWithVotes) {
    const { error } = await supabase
      .from("bounty_drafts")
      .update({ status: "rejected", executed_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) toast.error(error.message);
    else toast.success("Rejected");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Seo
        title="Governance — Proof of Purpose"
        description="Vote on bounty proposals. 1 active monthly membership = 1 vote. Transparent DAO governance on Base."
        path="/governance"
      />
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // proof of purpose · dao
        </p>
        <h1 className="mt-2 font-display text-5xl">GOVERNANCE</h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Catalysts propose bounties. Donors, Catalysts, and the steward each get one vote.
          Voting is open for 72h; bounties that pass move to the on-chain queue.
        </p>
        {!hasVoterRole && (
          <p className="brutal mt-4 p-3 font-mono text-[10px]">
            // enter as a Donor or Catalyst to cast a vote
          </p>
        )}
        {hasVoterRole && !isAdmin && (
          <div className="mt-4">
            <VotingPowerCard />
          </div>
        )}
        <Link
          to="/governance/past"
          className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
        >
          past props archive{pastCount > 0 ? ` (${pastCount})` : ""} →
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 font-mono text-xs text-muted-foreground">// loading…</p>
      ) : drafts.length === 0 ? (
        <p className="mt-8 font-mono text-xs text-muted-foreground">// no proposals yet</p>
      ) : (
        <div className="mt-8 space-y-4">
          {drafts.map((d) => {
            const total = d.yes_count + d.no_count + d.abstain_count;
            const yesPct = total ? Math.round((d.yes_count / total) * 100) : 0;
            const closed = new Date(d.vote_closes_at).getTime() <= Date.now();
            const result = outcome(d);
            const my = myVotes[d.id];

            return (
              <div key={d.id} className="brutal relative p-0">
                {/* status ribbon */}
                <div className="flex items-center justify-between gap-3 border-b-2 border-foreground bg-secondary px-4 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                    // {result ?? d.status.replace("_", " ")}
                  </p>
                  {!closed && d.status === "pending_vote" ? (
                    <Countdown closesAt={d.vote_closes_at} />
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {result === "passed" ? "✓ passed" : result === "failed" ? "✗ failed" : result === "on-chain" ? "⛓ on-chain" : "closed"}
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl sm:text-3xl">{d.name}</h3>
                      {d.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
                      )}
                    </div>
                    <div className="brutal-primary shrink-0 px-3 py-2 text-right">
                      <p className="font-display text-xl leading-none">{d.reward_purpose}</p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest">
                        purpose × {d.max_participants}
                      </p>
                    </div>
                  </div>

                  {(d.image_urls?.length || d.video_url || d.deck_url) && (
                    <div className="mt-4 space-y-2">
                      {d.image_urls && d.image_urls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {d.image_urls.map((u) => (
                            <img key={u} src={u} alt="" className="brutal h-20 w-20 shrink-0 object-cover" />
                          ))}
                        </div>
                      )}
                      {d.video_url && (
                        <video src={d.video_url} controls className="brutal w-full max-w-md" />
                      )}
                      {d.deck_url && (
                        <a
                          href={d.deck_url}
                          target="_blank"
                          rel="noreferrer"
                          className="brutal brutal-hover inline-flex items-center px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-primary"
                        >
                          📊 View slide deck{d.deck_filename ? ` · ${d.deck_filename}` : ""} ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Vote tally widget */}
                  <div className="mt-5 border-t-2 border-foreground pt-4">
                    <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
                      <span className="text-primary">FUEL · {d.yes_count}</span>
                      <span className="text-muted-foreground">PASS · {d.abstain_count}</span>
                      <span className="text-destructive">STALL · {d.no_count}</span>
                    </div>
                    <div className="flex h-5 overflow-hidden border-2 border-foreground bg-secondary">
                      {total > 0 ? (
                        <>
                          <div
                            className="flex items-center justify-center bg-primary text-[9px] font-display text-primary-foreground"
                            style={{ width: `${(d.yes_count / total) * 100}%` }}
                          >
                            {d.yes_count > 0 && `${Math.round((d.yes_count / total) * 100)}%`}
                          </div>
                          <div
                            className="bg-muted-foreground/40"
                            style={{ width: `${(d.abstain_count / total) * 100}%` }}
                          />
                          <div
                            className="flex items-center justify-center bg-destructive text-[9px] font-display text-destructive-foreground"
                            style={{ width: `${(d.no_count / total) * 100}%` }}
                          >
                            {d.no_count > 0 && `${Math.round((d.no_count / total) * 100)}%`}
                          </div>
                        </>
                      ) : (
                        <div className="flex w-full items-center justify-center font-mono text-[9px] uppercase text-muted-foreground">
                          no votes yet
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {total} {total === 1 ? "vote" : "votes"} cast
                      </span>
                      {hasVoterRole && !isAdmin && <VotingPowerPill />}
                    </div>
                  </div>

                  {hasVoterRole && d.status === "pending_vote" && !closed && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {(["yes", "abstain", "no"] as VoteChoice[]).map((c) => {
                        const active = my === c;
                        const base = "brutal brutal-hover px-3 py-3 font-display text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
                        const cls =
                          c === "yes"
                            ? active ? "brutal-primary" : `${base} hover:bg-primary hover:text-primary-foreground`
                            : c === "no"
                            ? active ? "brutal bg-destructive text-destructive-foreground" : `${base} hover:bg-destructive hover:text-destructive-foreground`
                            : active ? "brutal bg-secondary" : base;
                        return (
                          <button
                            key={c}
                            onClick={() => vote(d.id, c)}
                            disabled={!canVote}
                            title={canVote ? "" : "Mint a membership and activate voting power to vote"}
                            className={c === "yes" || c === "no" ? (active ? cls : cls) : cls}
                          >
                            {VOTE_LABEL[c]}
                            {active && <span className="ml-1">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {my && (
                    <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      // your vote: {VOTE_LABEL[my]}
                    </p>
                  )}

                  {isAdmin && closed && d.status === "pending_vote" && (
                    <div className="mt-4 flex gap-2 border-t-2 border-foreground pt-4">
                      <Button onClick={() => adminApprove(d)} className="brutal-primary brutal-hover flex-1 font-display">
                        EXECUTE (queue on-chain)
                      </Button>
                      <Button variant="ghost" onClick={() => adminReject(d)}>Reject</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
