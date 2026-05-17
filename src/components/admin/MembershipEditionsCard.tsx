import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Edition = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string;
  animation_url: string | null;
  active: boolean;
  created_at: string;
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function MembershipEditionsCard() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("membership_editions")
      .select("*")
      .order("created_at", { ascending: false });
    setEditions((data as Edition[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim() || !file) {
      toast.error("Name and artwork file are required");
      return;
    }
    setBusy(true);
    try {
      const slug = `${slugify(name)}-${Date.now().toString(36)}`;
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${slug}.${ext}`;
      const up = await supabase.storage.from("membership-art").upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type || undefined,
        upsert: false,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("membership-art").getPublicUrl(path);

      const { error } = await supabase.from("membership_editions").insert({
        slug,
        name: name.trim(),
        description: description.trim() || null,
        image_url: pub.publicUrl,
        active: editions.length === 0, // first one auto-active
      });
      if (error) throw error;

      toast.success("Edition created");
      setName(""); setDescription(""); setFile(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    setBusy(true);
    try {
      // Deactivate all, then activate target — unique partial index allows only one true row.
      const off = await supabase.from("membership_editions").update({ active: false }).eq("active", true);
      if (off.error) throw off.error;
      const on = await supabase.from("membership_editions").update({ active: true }).eq("id", id);
      if (on.error) throw on.error;
      toast.success("Activated — new mints will use this artwork");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this edition? Tokens already minted under it keep their art (it stays in storage).")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("membership_editions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brutal p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">// membership · editions</p>
      <h3 className="mt-1 font-display text-2xl">MEMBERSHIP ARTWORK</h3>
      <p className="mt-2 max-w-prose text-xs text-muted-foreground">
        Upload a new artwork edition. The <strong>active</strong> edition is stamped onto every new
        membership mint and stays with that token forever. Holders collect editions over time.
      </p>

      {/* Upload form */}
      <div className="mt-5 grid gap-3 border-t-2 border-foreground pt-5">
        <div>
          <Label htmlFor="ed-name" className="font-mono text-[10px] uppercase tracking-widest">Edition name</Label>
          <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring '26 · Bloom" />
        </div>
        <div>
          <Label htmlFor="ed-desc" className="font-mono text-[10px] uppercase tracking-widest">Description</Label>
          <Textarea id="ed-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="One-line story behind this artwork (shown on OpenSea, wallets, etc.)" />
        </div>
        <div>
          <Label htmlFor="ed-file" className="font-mono text-[10px] uppercase tracking-widest">Artwork file (PNG, JPG, GIF, SVG)</Label>
          <Input id="ed-file" type="file" accept="image/*,image/svg+xml,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={create} disabled={busy} className="brutal-primary brutal-hover font-display">
          {busy ? "UPLOADING…" : "CREATE EDITION"}
        </Button>
      </div>

      {/* Existing editions */}
      <div className="mt-6 border-t-2 border-foreground pt-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // existing editions
        </p>
        {loading ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">// loading…</p>
        ) : editions.length === 0 ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">// none yet — create the first edition above</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {editions.map((e) => (
              <div key={e.id} className="brutal flex gap-3 p-3">
                <img src={e.image_url} alt={e.name} className="h-24 w-24 shrink-0 object-cover" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display text-base">{e.name}</p>
                    {e.active && (
                      <span className="brutal-primary px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest">
                        active
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.description}</p>
                  )}
                  <div className="mt-auto flex gap-2 pt-2">
                    {!e.active && (
                      <Button size="sm" variant="outline" onClick={() => activate(e.id)} disabled={busy}>
                        Activate
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(e.id)} disabled={busy}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
