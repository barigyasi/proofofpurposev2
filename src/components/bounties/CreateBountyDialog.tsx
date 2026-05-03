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
import { uploadPublicImage } from "@/lib/storage";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CreateBountyDialog({ open, onOpenChange }: Props) {
  const { busy, preflight, createBounty } = useBountyAdmin();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [maxP, setMaxP] = useState("");
  const [location, setLocation] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarn(null);
    preflight().then((r) => !r.ok && setWarn(r.reason ?? null));
  }, [open]);

  async function submit() {
    if (!name || !reward || !maxP) {
      toast.error("Fill name, reward, and max participants");
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
          <Button onClick={submit} disabled={busy} className="brutal-primary brutal-hover font-display">
            {busy ? "POSTING…" : "POST ON-CHAIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
