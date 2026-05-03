import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Post = { id: string; message: string; author_id: string; created_at: string };
type Comment = { id: string; post_id: string; message: string; author_id: string; created_at: string };

export default function Bulletin() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [user, setUser] = useState<string | null>(null);

  async function load() {
    const [p, c, u] = await Promise.all([
      supabase.from("bulletin_posts").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("bulletin_comments").select("*").order("created_at"),
      supabase.auth.getUser(),
    ]);
    setPosts((p.data ?? []) as Post[]);
    setComments((c.data ?? []) as Comment[]);
    setUser(u.data.user?.id ?? null);
  }
  useEffect(() => { load(); }, []);

  async function post() {
    if (!user) return toast.error("Enter first");
    if (!msg.trim()) return;
    const { error } = await supabase.from("bulletin_posts").insert({ author_id: user, message: msg.trim() });
    if (error) toast.error(error.message);
    else { setMsg(""); load(); }
  }

  async function comment(postId: string) {
    if (!user) return toast.error("Enter first");
    const text = reply[postId]?.trim();
    if (!text) return;
    const { error } = await supabase.from("bulletin_comments").insert({ post_id: postId, author_id: user, message: text });
    if (error) toast.error(error.message);
    else { setReply({ ...reply, [postId]: "" }); load(); }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// community</p>
        <h1 className="mt-2 font-display text-5xl">BULLETIN</h1>
      </div>

      {user && (
        <div className="brutal mt-6 p-4">
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} rows={2} placeholder="Drop a post…" />
          <Button onClick={post} className="brutal-primary brutal-hover mt-3 font-display">POST</Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {posts.map((p) => {
          const cs = comments.filter((c) => c.post_id === p.id);
          return (
            <div key={p.id} className="brutal p-4">
              <p className="font-mono text-[10px] text-muted-foreground">
                {p.author_id.slice(0, 8)}… · {new Date(p.created_at).toLocaleString()}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{p.message}</p>
              <div className="mt-3 space-y-2 border-t-2 border-foreground pt-3">
                {cs.map((c) => (
                  <div key={c.id} className="text-xs">
                    <span className="font-mono text-muted-foreground">{c.author_id.slice(0, 6)}…</span>{" "}
                    {c.message}
                  </div>
                ))}
                {user && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={reply[p.id] ?? ""}
                      onChange={(e) => setReply({ ...reply, [p.id]: e.target.value })}
                      placeholder="reply…"
                      maxLength={300}
                    />
                    <Button variant="outline" onClick={() => comment(p.id)}>SEND</Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
