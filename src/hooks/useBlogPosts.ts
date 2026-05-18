import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BlogCategory, BlogPost } from "@/lib/blog";

export interface PostsFilter {
  category?: BlogCategory | "all";
  search?: string;
  pageSize?: number;
}

export function useBlogPosts({ category = "all", search = "", pageSize = 12 }: PostsFilter) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featured, setFeatured] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [category, search]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      // Featured (only on first page, no filters)
      if (page === 0 && category === "all" && !search) {
        const { data: f } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("status", "published")
          .eq("is_featured", true)
          .maybeSingle();
        if (!cancelled) setFeatured((f as BlogPost) ?? null);
      } else if (page === 0) {
        setFeatured(null);
      }

      let q = supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false });

      if (category !== "all") q = q.eq("category", category);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`title.ilike.${s},excerpt.ilike.${s}`);
      }

      const from = page * pageSize;
      const to = from + pageSize;
      q = q.range(from, to);

      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setPosts((prev) => (page === 0 ? [] : prev));
        setHasMore(false);
      } else {
        const rows = (data ?? []) as BlogPost[];
        let visible = rows;
        if (page === 0 && category === "all" && !search && featured) {
          visible = rows.filter((p) => p.id !== featured.id);
        }
        setHasMore(rows.length > pageSize);
        setPosts((prev) =>
          page === 0 ? visible.slice(0, pageSize) : [...prev, ...visible.slice(0, pageSize)],
        );
      }
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, page, pageSize]);

  return { posts, featured, loading, hasMore, loadMore: () => setPage((p) => p + 1) };
}
