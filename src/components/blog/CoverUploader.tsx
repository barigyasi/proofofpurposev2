import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET = "blog-covers";

interface Props {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  helper?: string;
}

function pubUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
function pathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export function CoverUploader({ userId, value, onChange, label = "Cover image", helper }: Props) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Not an image");
    if (f.size > MAX_BYTES) return toast.error("Over 8 MB");
    setBusy(true);
    try {
      if (value) {
        const oldPath = pathFromUrl(value);
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {});
      }
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${userId}/cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (error) throw error;
      onChange(pubUrl(path));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (value) {
      const p = pathFromUrl(value);
      if (p) await supabase.storage.from(BUCKET).remove([p]).catch(() => {});
    }
    onChange(null);
  }

  return (
    <div>
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" /> {label}
      </Label>
      {helper && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {helper}
        </p>
      )}
      {value && (
        <div className="brutal relative mt-2 aspect-[16/10] overflow-hidden">
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={remove}
            className="absolute right-2 top-2 rounded-none border-2 border-foreground bg-background p-1"
            aria-label="Remove cover"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="brutal mt-2 w-full font-display"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> UPLOADING…
          </>
        ) : value ? (
          "REPLACE COVER"
        ) : (
          "+ ADD COVER"
        )}
      </Button>
    </div>
  );
}
