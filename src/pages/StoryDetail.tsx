import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Clock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { MarkdownView } from "@/components/blog/MarkdownView";
import { PostCard } from "@/components/blog/PostCard";
import { useBlogPost } from "@/hooks/useBlogPost";
import { CATEGORY_LABEL, formatDate } from "@/lib/blog";

export default function StoryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { post, author, related, loading, notFound } = useBlogPost(slug);

  async function share() {
    const url = window.location.href;
    if (navigator.share && post) {
      try {
        await navigator.share({ title: post.title, text: post.excerpt ?? "", url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="brutal aspect-[16/9] animate-pulse bg-card" />
        <div className="mt-6 space-y-3">
          <div className="h-8 w-3/4 animate-pulse bg-secondary" />
          <div className="h-4 w-1/2 animate-pulse bg-secondary" />
        </div>
      </main>
    );
  }

  if (notFound || !post) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-4xl">Story not found</h1>
        <p className="mt-3 text-muted-foreground">It may have been moved or unpublished.</p>
        <Button asChild className="brutal-primary brutal-hover mt-6 font-display">
          <Link to="/stories">← BACK TO STORIES</Link>
        </Button>
      </main>
    );
  }

  const displayName = author?.display_name ?? author?.username ?? "Proof of Purpose";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Seo
        title={`${post.title} — Stories`}
        description={post.excerpt ?? post.title}
        path={`/stories/${post.slug}`}
        type="article"
      />
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
        {post.cover_url && <meta property="og:image" content={post.cover_url} />}
      </Helmet>

      <Link
        to="/stories"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All stories
      </Link>

      <header className="mt-6">
        <span className="inline-block border-2 border-foreground bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-widest">
          {CATEGORY_LABEL[post.category]}
        </span>
        <h1 className="mt-4 font-display text-4xl leading-[1.05] sm:text-6xl">{post.title}</h1>
        {post.excerpt && (
          <p className="mt-5 text-lg text-muted-foreground sm:text-xl">{post.excerpt}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-y-2 border-foreground py-3 font-mono text-[11px] uppercase tracking-widest">
          {author?.avatar_url ? (
            <img
              src={author.avatar_url}
              alt=""
              className="h-7 w-7 border-2 border-foreground object-cover"
            />
          ) : (
            <span className="grid h-7 w-7 place-items-center border-2 border-foreground bg-primary text-primary-foreground">
              {displayName.charAt(0)}
            </span>
          )}
          <span>{displayName}</span>
          <span className="text-muted-foreground">·</span>
          <span>{formatDate(post.published_at)}</span>
          {post.read_time_minutes ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
              </span>
            </>
          ) : null}
          <button
            onClick={share}
            className="ml-auto inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
        </div>
      </header>

      {post.cover_url && (
        <div className="brutal mt-6 overflow-hidden">
          <img src={post.cover_url} alt="" className="w-full" />
        </div>
      )}

      <article className="mt-10">
        <MarkdownView source={post.body_md} />
      </article>

      {post.tags?.length ? (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span
              key={t}
              className="border border-foreground px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      {related.length > 0 && (
        <section className="mt-16 border-t-2 border-foreground pt-10">
          <h2 className="font-display text-3xl">More like this</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <PostCard key={r.id} post={r} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
