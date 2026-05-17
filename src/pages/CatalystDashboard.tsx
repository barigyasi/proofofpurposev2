import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useEffectiveRoles } from "@/hooks/useEffectiveRoles";
import { useGovernanceConfig } from "@/hooks/useGovernance";
import { supabase } from "@/integrations/supabase/client";
import { useCatalystApplication } from "@/hooks/useApplicationStatus";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DraftMediaUploader, type DraftMedia } from "@/components/bounties/DraftMediaUploader";
import { TreasuryHeadroomCard } from "@/components/admin/TreasuryHeadroomCard";
import { useTreasuryHeadroom } from "@/hooks/useTreasuryHeadroom";
import { MIN_RECOMMENDED_REWARD } from "@/config/contracts";

type Draft = {
  id: string;
  name: string;
  description: string | null;
  reward_purpose: number;
  max_participants: number;
  status: string;
  dao_proposal_id: number | null;
  on_chain_bounty_id: number | null;
  on_chain_tx_hash: string | null;
  vote_closes_at: string;
  created_at: string;
  image_urls: string[] | null;
  video_url: string | null;
  deck_url: string | null;
  deck_filename: string | null;
};

function badge(d: Draft): { label: string; tone: "primary" | "muted" | "destructive" } {
  if (d.on_chain_bounty_id !== null) return { label: "⛓ ON-CHAIN BOUNTY", tone: "primary" };
  if (d.dao_proposal_id) {
    const closed = new Date(d.vote_closes_at).getTime() <= Date.now();
    return { label: closed ? "VOTE CLOSED · AWAITING EXECUTION" : "⛓ VOTE LIVE ON-CHAIN", tone: "primary" };
  }
  if (d.status === "pending_vote") {
    const closed = new Date(d.vote_closes_at).getTime() <= Date.now();
    return closed
      ? { label: "VOTE CLOSED · AWAITING ADMIN", tone: "muted" }
      : { label: "OFF-CHAIN TALLY · AWAITING ADMIN TO POST", tone: "muted" };
  }
  if (d.status === "rejected") return { label: "REJECTED", tone: "destructive" };
  if (d.status === "queued") return { label: "QUEUED", tone: "muted" };
  return { label: d.status.toUpperCase(), tone: "muted" };
}

const EMPTY_MEDIA: DraftMedia = { imageUrls: [], videoUrl: null, deckUrl: null, deckFilename: null };

export default function CatalystDashboard() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const { session, roles, isLoading } = useEffectiveRoles();
  const { status: appStatus, orgName } = useCatalystApplication(session?.user.id);
  const { data: gov } = useGovernanceConfig();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [maxP, setMaxP] = useState("");
  const [media, setMedia] = useState<DraftMedia>(EMPTY_MEDIA);
  const [draftKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);
  const { data: treasury } = useTreasuryHeadroom();

  const isApproved = roles.includes("catalyst");
  const isPending = !isApproved && appStatus === "pending";

  const rewardNum = Number(reward) || 0;
  const maxNum = Number(maxP) || 0;
  const newCommitment = rewardNum * Math.max(1, maxNum);
  const projectedHeadroom = treasury ? treasury.headroom - newCommitment : null;
  const wouldOverdraw = projectedHeadroom !== null && projectedHeadroom < 0;
  const belowRecommended = rewardNum > 0 && rewardNum < MIN_RECOMMENDED_REWARD;

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (appStatus === "loading") return;
    if (!isApproved && appStatus === "none") {
      navigate("/apply/catalyst", { replace: true });
    }
  }, [isLoading, session, isApproved, appStatus, navigate]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("bounty_drafts")
      .select("id,name,description,reward_purpose,max_participants,status,dao_proposal_id,on_chain_bounty_id,on_chain_tx_hash,vote_closes_at,created_at,image_urls,video_url,deck_url,deck_filename")
      .eq("proposer_id", user.id)
      .order("created_at", { ascending: false });
    setDrafts((data ?? []) as Draft[]);
  }
  useEffect(() => { load(); }, [session]);
  useEffect(() => {
    const ch = supabase
      .channel("catalyst-drafts")
      .on("postgres_changes", { event: "*", schema: "public", table: "bounty_drafts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function submitDraft() {
    if (!name || !reward || !maxP) return toast.error("Fill required fields");
    if (wouldOverdraw && !override) {
      return toast.error("Treasury cannot cover this bounty — ask admin to fund it, or check the override box.");
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: org } = await supabase
        .from("catalyst_orgs")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("bounty_drafts").insert({
        proposer_id: user.id,
        catalyst_id: org?.id ?? null,
        name,
        description,
        reward_purpose: Number(reward),
        max_participants: Number(maxP),
        status: gov?.vote_contract_address ? "pending_vote" : "queued",
        image_urls: media.imageUrls,
        video_url: media.videoUrl,
        deck_url: media.deckUrl,
        deck_filename: media.deckFilename,
      });
      if (error) throw error;
      toast.success("Draft saved — awaiting DAO vote");
      setName(""); setDescription(""); setReward(""); setMaxP("");
      setMedia(EMPTY_MEDIA);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !session) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // catalyst console
        </p>
        <h1 className="mt-2 font-display text-5xl">PROPOSE<br /><span className="text-primary">A BOUNTY</span></h1>
        {account && <p className="mt-2 font-mono text-[10px] text-muted-foreground">{account.address}</p>}
      </div>

      {!gov?.vote_contract_address && (
        <p className="brutal mt-6 p-4 font-mono text-xs">
          // DAO vote contract not yet configured. Drafts will queue until they're posted on-chain.
        </p>
      )}

      {!isPending && (
        <div className="mt-6">
          <TreasuryHeadroomCard />
        </div>
      )}

      {isPending ? (
        <div className="brutal mt-8 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// pending approval</p>
          <h2 className="mt-2 font-display text-3xl">{orgName ?? "Your org"}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your catalyst application is in review. Once an admin approves your org, you'll be able
            to draft bounties and submit them for the DAO vote.
          </p>
          <Button disabled className="brutal-primary mt-6 w-full font-display opacity-50 cursor-not-allowed">
            NEW DRAFT · LOCKED
          </Button>
        </div>
      ) : (
        <div className="brutal mt-8 p-6">
          <h2 className="font-display text-2xl">NEW DRAFT</h2>
          <div className="mt-4 space-y-3">
            <div><Label>Bounty name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
            <div><Label>Description</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></div>
            <div className="border-t border-foreground pt-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                // mission media (optional but boosts your vote)
              </p>
              {session && (
                <DraftMediaUploader
                  userId={session.user.id}
                  draftKey={draftKey}
                  value={media}
                  onChange={setMedia}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reward (PURPOSE) *</Label>
                <Input inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`${MIN_RECOMMENDED_REWARD}+`} />
                <p className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${belowRecommended ? "text-destructive" : "text-muted-foreground"}`}>
                  {belowRecommended
                    ? `// below recommended — aim for ${MIN_RECOMMENDED_REWARD}+ per participant`
                    : `// recommended: ${MIN_RECOMMENDED_REWARD}+ per participant`}
                </p>
              </div>
              <div>
                <Label>Max participants *</Label>
                <Input type="number" min={1} value={maxP} onChange={(e) => setMaxP(e.target.value)} />
              </div>
            </div>

            {treasury && (
              <div
                className={`border-2 p-3 font-mono text-[11px] ${
                  wouldOverdraw
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-foreground bg-muted/30 text-muted-foreground"
                }`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span>// treasury headroom now</span>
                  <span className="text-foreground">{treasury.headroom.toLocaleString()} PURPOSE</span>
                </div>
                {newCommitment > 0 && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>// this bounty (reward × max)</span>
                    <span className="text-foreground">{newCommitment.toLocaleString()} PURPOSE</span>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap justify-between gap-2 border-t border-current pt-1">
                  <span>// headroom after</span>
                  <span className={wouldOverdraw ? "text-destructive" : "text-primary"}>
                    {projectedHeadroom !== null ? projectedHeadroom.toLocaleString() : "—"} PURPOSE
                  </span>
                </div>
                {wouldOverdraw && (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-foreground">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(e) => setOverride(e.target.checked)}
                    />
                    I understand the Treasury must be funded before this can execute on-chain.
                  </label>
                )}
              </div>
            )}

            <Button onClick={submitDraft} disabled={busy || (wouldOverdraw && !override)} className="brutal-primary brutal-hover w-full font-display">
              {busy ? "SAVING…" : "SUBMIT FOR VOTE"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display text-2xl border-b-2 border-foreground pb-2">YOUR DRAFTS</h2>
        <div className="mt-4 space-y-3">
          {drafts.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">// no drafts yet</p>
          ) : (
            drafts.map((d) => {
              const imgs = d.image_urls ?? [];
              return (
                <div key={d.id} className="brutal p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase text-primary">{d.status}</p>
                      <h3 className="mt-1 font-display text-xl">{d.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                      {(imgs.length > 0 || d.video_url || d.deck_url) && (
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {imgs.length > 0 && <>📷 {imgs.length} </>}
                          {d.video_url && <>🎞️ </>}
                          {d.deck_url && <>📊 </>}
                        </p>
                      )}
                    </div>
                    <p className="font-display text-lg text-primary">{d.reward_purpose} ⨯ {d.max_participants}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Track the DAO vote on the <Link className="underline text-primary" to="/governance">Governance</Link> page.
        </p>
      </div>
    </main>
  );
}
