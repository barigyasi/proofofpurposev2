import { useMemo } from "react";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { useDraftVotes, type DraftWithVotes, type VoteChoice } from "@/hooks/useDraftVotes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function timeLeft(closesAt: string) {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
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
    try {
      await castVote(draftId, choice, account?.address);
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
