import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BlogPost } from "@/lib/blog";

export interface BlogAuthor {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function useBlogPost(slug: string | undefined) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [author, setAuthor] = useState<BlogAuthor | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    (async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const p = data as BlogPost;
      setPost(p);

      const [authorRes, relRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,username,avatar_url")
          .eq("id", p.author_id)
          .maybeSingle(),
        supabase
          .from("blog_posts")
          .select("*")
          .eq("status", "published")
          .eq("category", p.category)
          .neq("id", p.id)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(3),
      ]);

      if (cancelled) return;
      setAuthor((authorRes.data as BlogAuthor) ?? null);
      setRelated(((relRes.data ?? []) as BlogPost[]));
      setLoading(false);

      // Log view (best-effort)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        supabase
          .from("blog_post_views")
          .insert({ post_id: p.id, viewer_id: user.id })
          .then(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { post, author, related, loading, notFound };
}
