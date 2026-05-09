import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { useDraftVotes, type DraftWithVotes, type VoteChoice } from "@/hooks/useDraftVotes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
  const { drafts, myVotes, loading, castVote } = useDraftVotes();

  const canVote = useMemo(
    () => roles.some((r) => r === "donor" || r === "catalyst" || r === "admin"),
    [roles],
  );
  const isAdmin = roles.includes("admin");

  async function vote(draftId: string, choice: VoteChoice) {
    if (!account?.address) {
      toast.error("Connect your wallet to vote — votes are tied to a wallet address for the on-chain DAO.");
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
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // proof of purpose · dao
        </p>
        <h1 className="mt-2 font-display text-5xl">GOVERNANCE</h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Catalysts propose bounties. Donors, Catalysts, and the steward each get one vote.
          Voting is open for 72h; bounties that pass move to the on-chain queue.
        </p>
        {!canVote && (
          <p className="brutal mt-4 p-3 font-mono text-[10px]">
            // enter as a Donor or Catalyst to cast a vote
          </p>
        )}
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
              <div key={d.id} className="brutal p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase text-primary">
                      {result ?? d.status}{!closed && d.status === "pending_vote" ? ` · ${timeLeft(d.vote_closes_at)}` : ""}
                    </p>
                    <h3 className="mt-1 font-display text-xl">{d.name}</h3>
                    {d.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                    )}
                    {(d.image_urls?.length || d.video_url || d.deck_url) && (
                      <div className="mt-3 space-y-2">
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
                  </div>
                  <p className="shrink-0 font-display text-lg text-primary">
                    {d.reward_purpose}<span className="text-muted-foreground">×{d.max_participants}</span>
                  </p>
                </div>

                <div className="mt-4 flex h-2 overflow-hidden border-2 border-foreground">
                  <div className="bg-primary" style={{ width: `${yesPct}%` }} />
                  <div className="bg-destructive" style={{ width: `${total ? (d.no_count / total) * 100 : 0}%` }} />
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  yes {d.yes_count} · no {d.no_count} · abstain {d.abstain_count}
                </p>

                {canVote && d.status === "pending_vote" && !closed && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(["yes", "no", "abstain"] as VoteChoice[]).map((c) => (
                      <Button
                        key={c}
                        variant={my === c ? "default" : "outline"}
                        onClick={() => vote(d.id, c)}
                        className="font-display"
                      >
                        {c.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                )}

                {isAdmin && closed && d.status === "pending_vote" && (
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => adminApprove(d)} className="brutal-primary brutal-hover flex-1 font-display">
                      EXECUTE (queue on-chain)
                    </Button>
                    <Button variant="ghost" onClick={() => adminReject(d)}>Reject</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
