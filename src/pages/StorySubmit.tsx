import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Seo } from "@/components/Seo";
import { MarkdownEditor } from "@/components/blog/MarkdownEditor";
import { CoverUploader } from "@/components/blog/CoverUploader";
import { SubmissionStatusBadge } from "@/components/blog/SubmissionStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { useMyBlogSubmissions } from "@/hooks/useMyBlogSubmissions";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  excerptFromBody,
  readTimeMinutes,
  slugify,
  type BlogCategory,
  type BlogPost,
} from "@/lib/blog";

const TITLE_MAX = 140;
const EXCERPT_MAX = 240;

export default function StorySubmit() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { session, roles, isLoading } = useSessionRoles();
  const userId = session?.user.id ?? null;
  const canAuthor = roles.includes("catalyst") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  const editingId = params.get("id");
  const [post, setPost] = useState<BlogPost | null>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<BlogCategory>("champion_story");
  const [tags, setTags] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);

  const { posts: mine, reload } = useMyBlogSubmissions(userId);

  useEffect(() => {
    if (!editingId || !userId) return;
    supabase
      .from("blog_posts")
      .select("*")
      .eq("id", editingId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const p = data as BlogPost;
        setPost(p);
        setTitle(p.title);
        setExcerpt(p.excerpt ?? "");
        setCategory(p.category);
        setTags((p.tags ?? []).join(", "));
        setBody(p.body_md ?? "");
        setCover(p.cover_url);
      });
  }, [editingId, userId]);

  useEffect(() => {
    if (!isLoading && !canAuthor) {
      toast.error("Catalysts and admins only");
      navigate("/stories", { replace: true });
    }
  }, [isLoading, canAuthor, navigate]);

  const canEdit = useMemo(() => {
    if (!post) return true;
    if (isAdmin) return true;
    return ["draft", "pending", "rejected"].includes(post.status);
  }, [post, isAdmin]);

  async function save(target: "draft" | "submit") {
    if (!userId) return;
    if (title.trim().length < 5) return toast.error("Title needs at least 5 characters");
    if (body.trim().length < 50) return toast.error("Body needs at least 50 characters");
    setSaving(target);
    try {
      const tagList = tags
        .split(/[,#]/g)
        .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 10);
      const finalExcerpt = excerpt.trim() || excerptFromBody(body);
      const payload = {
        title: title.trim().slice(0, TITLE_MAX),
        excerpt: finalExcerpt.slice(0, EXCERPT_MAX),
        category,
        tags: tagList,
        body_md: body,
        cover_url: cover,
        read_time_minutes: readTimeMinutes(body),
        status: target === "submit" ? ("pending" as const) : ("draft" as const),
      };

      if (post) {
        const { error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", post.id);
        if (error) throw error;
        toast.success(target === "submit" ? "Submitted for review" : "Draft saved");
      } else {
        const slug = slugify(title);
        const { data, error } = await supabase
          .from("blog_posts")
          .insert({ ...payload, slug, author_id: userId })
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setPost(data as BlogPost);
          setParams({ id: (data as BlogPost).id });
        }
        toast.success(target === "submit" ? "Submitted for review" : "Draft saved");
      }
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  function startNew() {
    setPost(null);
    setTitle("");
    setExcerpt("");
    setCategory("champion_story");
    setTags("");
    setBody("");
    setCover(null);
    setParams({});
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Seo
        title="Write a story — Proof of Purpose"
        description="Submit a champion story, bounty recap, or update for review."
        path="/stories/submit"
      />

      <Link
        to="/stories"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to stories
      </Link>

      <header className="mt-4 flex flex-col gap-2 border-b-2 border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // catalyst submission
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">
            {post ? "EDIT STORY" : "NEW STORY"}
          </h1>
        </div>
        {post && (
          <div className="flex items-center gap-3">
            <SubmissionStatusBadge status={post.status} />
            <Button variant="outline" onClick={startNew} className="brutal font-display">
              + NEW
            </Button>
          </div>
        )}
      </header>

      {post?.status === "rejected" && post.review_note && (
        <div className="brutal mt-6 bg-destructive/10 p-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-destructive">
            // changes requested
          </p>
          <p className="mt-2 text-sm">{post.review_note}</p>
        </div>
      )}

      {!canEdit && (
        <div className="brutal mt-6 bg-secondary p-4">
          <p className="text-sm">
            This story is locked because it&rsquo;s already{" "}
            <strong>{post?.status}</strong>. Ask an admin if you need changes.
          </p>
        </div>
      )}

      <fieldset disabled={!canEdit} className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="A clear, human title"
              className="brutal mt-2 font-display text-xl"
            />
          </div>
          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Optional · shown on cards and previews · auto-generated if blank
            </p>
            <Input
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={EXCERPT_MAX}
              placeholder="One sentence summary"
              className="brutal mt-2"
            />
          </div>
          <div>
            <Label>Body</Label>
            <div className="mt-2">
              <MarkdownEditor value={body} onChange={setBody} />
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as BlogCategory)}>
              <SelectTrigger className="brutal mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, tags"
              className="brutal mt-2"
            />
          </div>
          {userId && (
            <CoverUploader
              userId={userId}
              value={cover}
              onChange={setCover}
              helper="16:10 works best · ≤ 8 MB"
            />
          )}

          <div className="space-y-2">
            <Button
              onClick={() => save("draft")}
              disabled={saving !== null || !canEdit}
              variant="outline"
              className="brutal w-full font-display"
            >
              {saving === "draft" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> SAVING…
                </>
              ) : (
                "SAVE DRAFT"
              )}
            </Button>
            <Button
              onClick={() => save("submit")}
              disabled={saving !== null || !canEdit}
              className="brutal-primary brutal-hover w-full font-display"
            >
              {saving === "submit" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> SUBMITTING…
                </>
              ) : isAdmin ? (
                "SAVE"
              ) : (
                "SUBMIT FOR REVIEW"
              )}
            </Button>
          </div>
        </aside>
      </fieldset>

      <section className="mt-16 border-t-2 border-foreground pt-8">
        <h2 className="font-display text-2xl">MY SUBMISSIONS</h2>
        {mine.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-foreground border-2 border-foreground">
            {mine.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base">{m.title || "Untitled"}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {CATEGORY_LABEL[m.category]} ·{" "}
                    {new Date(m.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <SubmissionStatusBadge status={m.status} />
                {m.status === "published" ? (
                  <Button asChild size="sm" variant="outline" className="brutal font-display">
                    <Link to={`/stories/${m.slug}`}>VIEW</Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setParams({ id: m.id })}
                    className="brutal font-display"
                  >
                    OPEN
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
