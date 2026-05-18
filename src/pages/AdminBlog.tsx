import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Star, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Seo } from "@/components/Seo";
import { MarkdownView } from "@/components/blog/MarkdownView";
import { SubmissionStatusBadge } from "@/components/blog/SubmissionStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, type BlogPost, type BlogStatus } from "@/lib/blog";
import { cn } from "@/lib/utils";

type Tab = "pending" | "published" | "drafts" | "all";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "pending", label: "Pending review" },
  { id: "published", label: "Published" },
  { id: "drafts", label: "Drafts" },
  { id: "all", label: "All" },
];

export default function AdminBlog() {
  const [tab, setTab] = useState<Tab>("pending");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<BlogPost | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("blog_posts").select("*").order("updated_at", { ascending: false });
    if (tab === "pending") q = q.eq("status", "pending");
    else if (tab === "published") q = q.eq("status", "published");
    else if (tab === "drafts") q = q.in("status", ["draft", "rejected"]);
    const { data } = await q;
    setPosts((data ?? []) as BlogPost[]);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<BlogStatus, number> = {
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      archived: 0,
    };
    posts.forEach((p) => (c[p.status] += 1));
    return c;
  }, [posts]);

  async function setStatus(p: BlogPost, status: BlogStatus, opts?: { note?: string }) {
    const payload: Partial<BlogPost> = { status };
    if (status === "published") payload.published_at = new Date().toISOString();
    if (status === "rejected") payload.review_note = opts?.note ?? null;
    if (status === "draft") payload.review_note = null;
    const { error } = await supabase.from("blog_posts").update(payload).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }

  async function toggleFeatured(p: BlogPost) {
    if (!p.is_featured) {
      // unset any other featured first (best-effort)
      await supabase
        .from("blog_posts")
        .update({ is_featured: false })
        .eq("is_featured", true)
        .neq("id", p.id);
    }
    const { error } = await supabase
      .from("blog_posts")
      .update({ is_featured: !p.is_featured })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_featured ? "Removed from featured" : "Set as featured");
    load();
  }

  async function deletePost(p: BlogPost) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setPreviewing(null);
    load();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Seo
        title="Blog admin — Proof of Purpose"
        description="Review, publish, and manage blog posts."
        path="/admin/blog"
      />
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Mission control
      </Link>

      <header className="mt-4 flex flex-col gap-3 border-b-2 border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // editorial
          </p>
          <h1 className="mt-2 font-display text-5xl sm:text-6xl">BLOG</h1>
        </div>
        <Button asChild className="brutal-primary brutal-hover font-display">
          <Link to="/stories/submit">+ NEW POST</Link>
        </Button>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "border-2 border-foreground px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-secondary",
              )}
            >
              {t.label}
              {tab === t.id && posts.length > 0 ? ` · ${posts.length}` : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading…
          </p>
        ) : posts.length === 0 ? (
          <div className="brutal bg-card p-10 text-center">
            <p className="font-display text-2xl">Nothing here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="brutal flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center">
                {p.cover_url ? (
                  <img
                    src={p.cover_url}
                    alt=""
                    className="h-20 w-32 flex-none border-2 border-foreground object-cover"
                  />
                ) : (
                  <div className="h-20 w-32 flex-none border-2 border-foreground bg-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SubmissionStatusBadge status={p.status} />
                    {p.is_featured && (
                      <span className="inline-flex items-center gap-1 border-2 border-foreground bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary-foreground">
                        <Star className="h-3 w-3" /> Featured
                      </span>
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {CATEGORY_LABEL[p.category]}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-display text-lg">{p.title || "Untitled"}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Updated {new Date(p.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPreviewing(p);
                      setReviewNote(p.review_note ?? "");
                    }}
                    className="brutal font-display"
                  >
                    <Eye className="mr-1 h-3 w-3" /> REVIEW
                  </Button>
                  <Button asChild size="sm" variant="outline" className="brutal font-display">
                    <Link to={`/stories/submit?id=${p.id}`}>EDIT</Link>
                  </Button>
                  {p.status === "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFeatured(p)}
                      className="brutal font-display"
                    >
                      {p.is_featured ? "UNFEATURE" : "FEATURE"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="brutal max-h-[90vh] max-w-3xl overflow-y-auto bg-background">
          {previewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {previewing.title || "Untitled"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2 border-y-2 border-foreground py-2">
                <SubmissionStatusBadge status={previewing.status} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {CATEGORY_LABEL[previewing.category]}
                </span>
              </div>
              {previewing.cover_url && (
                <img src={previewing.cover_url} alt="" className="border-2 border-foreground" />
              )}
              {previewing.excerpt && (
                <p className="text-base text-muted-foreground">{previewing.excerpt}</p>
              )}
              <MarkdownView source={previewing.body_md} />

              <div className="brutal mt-4 space-y-3 bg-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-widest">
                  // review note (sent to author on reject)
                </p>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={2}
                  placeholder="What needs to change?"
                />
                <div className="flex flex-wrap gap-2">
                  {previewing.status !== "published" && (
                    <Button
                      onClick={() => setStatus(previewing, "published")}
                      className="brutal-primary brutal-hover font-display"
                    >
                      APPROVE & PUBLISH
                    </Button>
                  )}
                  {previewing.status === "published" && (
                    <Button
                      onClick={() => setStatus(previewing, "archived")}
                      variant="outline"
                      className="brutal font-display"
                    >
                      ARCHIVE
                    </Button>
                  )}
                  {previewing.status === "pending" && (
                    <Button
                      onClick={() => setStatus(previewing, "rejected", { note: reviewNote })}
                      variant="outline"
                      className="brutal font-display"
                    >
                      REQUEST CHANGES
                    </Button>
                  )}
                  <Button
                    onClick={() => deletePost(previewing)}
                    variant="destructive"
                    className="brutal font-display"
                  >
                    DELETE
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        // {counts.pending} pending · {counts.published} live · {counts.draft + counts.rejected} drafts
      </p>
    </main>
  );
}
