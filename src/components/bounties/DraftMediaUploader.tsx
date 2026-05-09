import { useRef, useState } from "react";
import { toast } from "sonner";
import { X, Image as ImageIcon, Video, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_DECK_BYTES = 25 * 1024 * 1024;
const DECK_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
]);

export type DraftMedia = {
  imageUrls: string[];
  videoUrl: string | null;
  deckUrl: string | null;
  deckFilename: string | null;
};

interface Props {
  userId: string;
  draftKey: string; // unique per-draft folder segment
  value: DraftMedia;
  onChange: (m: DraftMedia) => void;
}

function pubUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function pathFromUrl(bucket: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export function DraftMediaUploader({ userId, draftKey, value, onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const deckInput = useRef<HTMLInputElement>(null);

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    const slots = MAX_IMAGES - value.imageUrls.length;
    if (slots <= 0) return toast.error(`Max ${MAX_IMAGES} images`);
    const list = Array.from(files).slice(0, slots);
    for (const f of list) {
      if (!f.type.startsWith("image/")) return toast.error(`${f.name}: not an image`);
      if (f.size > MAX_IMAGE_BYTES) return toast.error(`${f.name}: over 5 MB`);
    }
    setBusy("images");
    try {
      const uploaded: string[] = [];
      for (const f of list) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${userId}/drafts/${draftKey}/img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("bounty-images").upload(path, f, { contentType: f.type });
        if (error) throw error;
        uploaded.push(pubUrl("bounty-images", path));
      }
      onChange({ ...value, imageUrls: [...value.imageUrls, ...uploaded] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(null);
      if (imgInput.current) imgInput.current.value = "";
    }
  }

  async function removeImage(url: string) {
    const path = pathFromUrl("bounty-images", url);
    if (path) await supabase.storage.from("bounty-images").remove([path]).catch(() => {});
    onChange({ ...value, imageUrls: value.imageUrls.filter((u) => u !== url) });
  }

  async function uploadVideo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast.error("Not a video");
    if (f.size > MAX_VIDEO_BYTES) return toast.error("Over 100 MB");
    setBusy("video");
    try {
      // remove old
      if (value.videoUrl) {
        const oldPath = pathFromUrl("bounty-videos", value.videoUrl);
        if (oldPath) await supabase.storage.from("bounty-videos").remove([oldPath]).catch(() => {});
      }
      const ext = f.name.split(".").pop() || "mp4";
      const path = `${userId}/drafts/${draftKey}/video-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("bounty-videos").upload(path, f, { contentType: f.type });
      if (error) throw error;
      onChange({ ...value, videoUrl: pubUrl("bounty-videos", path) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video upload failed");
    } finally {
      setBusy(null);
      if (vidInput.current) vidInput.current.value = "";
    }
  }

  async function removeVideo() {
    if (value.videoUrl) {
      const p = pathFromUrl("bounty-videos", value.videoUrl);
      if (p) await supabase.storage.from("bounty-videos").remove([p]).catch(() => {});
    }
    onChange({ ...value, videoUrl: null });
  }

  async function uploadDeck(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!DECK_MIME.has(f.type)) return toast.error("Use PDF or PowerPoint");
    if (f.size > MAX_DECK_BYTES) return toast.error("Over 25 MB");
    setBusy("deck");
    try {
      if (value.deckUrl) {
        const oldPath = pathFromUrl("bounty-decks", value.deckUrl);
        if (oldPath) await supabase.storage.from("bounty-decks").remove([oldPath]).catch(() => {});
      }
      const ext = f.name.split(".").pop() || "pdf";
      const path = `${userId}/drafts/${draftKey}/deck-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("bounty-decks").upload(path, f, { contentType: f.type });
      if (error) throw error;
      onChange({ ...value, deckUrl: pubUrl("bounty-decks", path), deckFilename: f.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deck upload failed");
    } finally {
      setBusy(null);
      if (deckInput.current) deckInput.current.value = "";
    }
  }

  async function removeDeck() {
    if (value.deckUrl) {
      const p = pathFromUrl("bounty-decks", value.deckUrl);
      if (p) await supabase.storage.from("bounty-decks").remove([p]).catch(() => {});
    }
    onChange({ ...value, deckUrl: null, deckFilename: null });
  }

  return (
    <div className="space-y-5">
      {/* IMAGES */}
      <div>
        <Label className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Mission images ({value.imageUrls.length}/{MAX_IMAGES})
        </Label>
        {value.imageUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {value.imageUrls.map((u) => (
              <div key={u} className="brutal relative aspect-square overflow-hidden">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(u)}
                  className="absolute right-1 top-1 rounded-none border border-foreground bg-background p-0.5"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={imgInput}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => uploadImages(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy === "images" || value.imageUrls.length >= MAX_IMAGES}
          onClick={() => imgInput.current?.click()}
          className="brutal mt-2 w-full font-display"
        >
          {busy === "images" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> UPLOADING…</> : "+ ADD IMAGES"}
        </Button>
      </div>

      {/* VIDEO */}
      <div>
        <Label className="flex items-center gap-2">
          <Video className="h-4 w-4" /> Mission video (≤ 100 MB)
        </Label>
        {value.videoUrl && (
          <div className="brutal mt-2 p-2">
            <video src={value.videoUrl} controls className="w-full" />
            <button
              type="button"
              onClick={removeVideo}
              className="mt-2 font-mono text-[10px] uppercase tracking-widest text-primary underline"
            >
              remove video
            </button>
          </div>
        )}
        <input
          ref={vidInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => uploadVideo(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy === "video"}
          onClick={() => vidInput.current?.click()}
          className="brutal mt-2 w-full font-display"
        >
          {busy === "video" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> UPLOADING…</> : value.videoUrl ? "REPLACE VIDEO" : "+ ADD VIDEO"}
        </Button>
      </div>

      {/* DECK */}
      <div>
        <Label className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> Slide deck (PDF or PowerPoint, ≤ 25 MB)
        </Label>
        {value.deckUrl && (
          <div className="brutal mt-2 flex items-center justify-between gap-2 p-3">
            <a
              href={value.deckUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono text-xs text-primary underline"
            >
              {value.deckFilename ?? "Slide deck"}
            </a>
            <button
              type="button"
              onClick={removeDeck}
              className="font-mono text-[10px] uppercase tracking-widest text-primary underline"
            >
              remove
            </button>
          </div>
        )}
        <input
          ref={deckInput}
          type="file"
          accept=".pdf,.ppt,.pptx,.odp,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.oasis.opendocument.presentation"
          className="hidden"
          onChange={(e) => uploadDeck(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy === "deck"}
          onClick={() => deckInput.current?.click()}
          className="brutal mt-2 w-full font-display"
        >
          {busy === "deck" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> UPLOADING…</> : value.deckUrl ? "REPLACE DECK" : "+ ADD DECK"}
        </Button>
      </div>
    </div>
  );
}
