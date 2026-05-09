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

type Draft = {
  id: string;
  name: string;
  description: string | null;
  reward_purpose: number;
  max_participants: number;
  status: string;
  dao_proposal_id: number | null;
  on_chain_bounty_id: number | null;
  created_at: string;
  image_urls: string[] | null;
  video_url: string | null;
  deck_url: string | null;
  deck_filename: string | null;
};

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

  const isApproved = roles.includes("catalyst");
  const isPending = !isApproved && appStatus === "pending";

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
      .select("id,name,description,reward_purpose,max_participants,status,dao_proposal_id,on_chain_bounty_id,created_at,image_urls,video_url,deck_url,deck_filename")
      .eq("proposer_id", user.id)
      .order("created_at", { ascending: false });
    setDrafts((data ?? []) as Draft[]);
  }
  useEffect(() => { load(); }, [session]);

  async function submitDraft() {
    if (!name || !reward || !maxP) return toast.error("Fill required fields");
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reward (PURPOSE) *</Label>
                <Input inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value.replace(/[^0-9.]/g, ""))} />
              </div>
              <div>
                <Label>Max participants *</Label>
                <Input type="number" min={1} value={maxP} onChange={(e) => setMaxP(e.target.value)} />
              </div>
            </div>
            <Button onClick={submitDraft} disabled={busy} className="brutal-primary brutal-hover w-full font-display">
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
            drafts.map((d) => (
              <div key={d.id} className="brutal p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-primary">{d.status}</p>
                    <h3 className="mt-1 font-display text-xl">{d.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                  </div>
                  <p className="font-display text-lg text-primary">{d.reward_purpose} ⨯ {d.max_participants}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Track the DAO vote on the <Link className="underline text-primary" to="/governance">Governance</Link> page.
        </p>
      </div>
    </main>
  );
}
