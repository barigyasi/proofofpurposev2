import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBountyAdmin } from "@/hooks/useBountyAdmin";
import { useTreasuryHeadroom } from "@/hooks/useTreasuryHeadroom";
import { uploadPublicImage } from "@/lib/storage";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CreateBountyDialog({ open, onOpenChange }: Props) {
  const { busy, preflight, createBounty } = useBountyAdmin();
  const { data: treasury, refetch: refetchTreasury } = useTreasuryHeadroom();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [maxP, setMaxP] = useState("");
  const [location, setLocation] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [override, setOverride] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWarn(null);
    setOverride(false);
    preflight().then((r) => !r.ok && setWarn(r.reason ?? null));
    refetchTreasury();
  }, [open]);

  // Live treasury impact for the values currently in the form
  const rewardNum = Number(reward) || 0;
  const maxNum = Number(maxP) || 0;
  const newCommitment = rewardNum * Math.max(1, maxNum);
  const projectedHeadroom = treasury ? treasury.headroom - newCommitment : null;
  const wouldOverdraw = projectedHeadroom !== null && projectedHeadroom < 0;

  async function submit() {
    if (!name || !reward || !maxP) {
      toast.error("Fill name, reward, and max participants");
      return;
    }
    if (wouldOverdraw && !override) {
      toast.error("Treasury cannot cover this bounty — fund it or check the override box");
      return;
    }
    try {
      let imageUrl: string | null = null;
      if (file) imageUrl = await uploadPublicImage("bounty-images", file, "bounties");
      await createBounty({
        name,
        description,
        rewardAmount: reward,
        maxParticipants: Number(maxP),
        imageUrl,
        location: location || null,
        expiresAt: expires ? new Date(expires).toISOString() : null,
      });
      onOpenChange(false);
      setName(""); setDescription(""); setReward(""); setMaxP("");
      setLocation(""); setExpires(""); setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CREATE BOUNTY</DialogTitle>
          <DialogDescription>
            Posts on-chain to BountyManager from the connected admin wallet.
          </DialogDescription>
        </DialogHeader>
        {warn && (
          <p className="border-2 border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            {warn}
          </p>
        )}
        {treasury && (
          <div
            className={`border-2 p-3 font-mono text-[11px] ${
              wouldOverdraw
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-foreground bg-muted/30 text-muted-foreground"
            }`}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span>// treasury balance</span>
              <span className="text-foreground">{treasury.balance.toLocaleString()} PURPOSE</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>// already committed (open + running)</span>
              <span className="text-foreground">{treasury.committed.toLocaleString()} PURPOSE</span>
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
                I understand the Treasury must be funded before this event ends.
              </label>
            )}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reward (PURPOSE)</Label>
              <Input
                inputMode="decimal"
                value={reward}
                onChange={(e) => setReward(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Max participants</Label>
              <Input
                type="number"
                min={1}
                value={maxP}
                onChange={(e) => setMaxP(e.target.value)}
                placeholder="10"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Image (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || (wouldOverdraw && !override)}
            className="brutal-primary brutal-hover font-display"
          >
            {busy ? "POSTING…" : "POST ON-CHAIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
