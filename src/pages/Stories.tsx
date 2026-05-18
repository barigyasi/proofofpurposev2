import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { CategoryChips } from "@/components/blog/CategoryChips";
import { FeaturedPostCard } from "@/components/blog/FeaturedPostCard";
import { PostCard } from "@/components/blog/PostCard";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import type { BlogCategory } from "@/lib/blog";

export default function Stories() {
  const [category, setCategory] = useState<BlogCategory | "all">("all");
  const [search, setSearch] = useState("");
  const { posts, featured, loading, hasMore, loadMore } = useBlogPosts({ category, search });
  const { roles } = useSessionRoles();
  const canSubmit = useMemo(
    () => roles.includes("catalyst") || roles.includes("admin"),
    [roles],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Seo
        title="Stories — Proof of Purpose"
        description="Long-form updates, champion stories, and bounty recaps from the Proof of Purpose community."
        path="/stories"
      />
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="flex flex-col gap-4 border-b-2 border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // members only
          </p>
          <h1 className="mt-2 font-display text-5xl sm:text-7xl">
            STORIES<span className="text-primary">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Champion journeys, bounty recaps, and serious updates from the people building Proof of
            Purpose city by city.
          </p>
        </div>
        {canSubmit && (
          <Button asChild className="brutal-primary brutal-hover font-display">
            <Link to="/stories/submit">+ NEW POST</Link>
          </Button>
        )}
      </header>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CategoryChips value={category} onChange={setCategory} />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stories…"
            className="brutal pl-9"
          />
        </div>
      </div>

      {featured && category === "all" && !search && (
        <section className="mt-8">
          <FeaturedPostCard post={featured} />
        </section>
      )}

      <section className="mt-8">
        {loading && posts.length === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="brutal aspect-[16/14] animate-pulse bg-card" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="brutal flex flex-col items-center justify-center bg-card p-12 text-center">
            <h3 className="font-display text-2xl">No stories yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search || category !== "all"
                ? "Try a different filter or search term."
                : "New posts will land here as they're published."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>

      {hasMore && (
        <div className="mt-10 flex justify-center">
          <Button onClick={loadMore} variant="outline" className="brutal font-display">
            LOAD MORE
          </Button>
        </div>
      )}
    </main>
  );
}
