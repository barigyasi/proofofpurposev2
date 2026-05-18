import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BlogPost } from "@/lib/blog";

export function useMyBlogSubmissions(userId: string | null) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("author_id", userId)
      .order("updated_at", { ascending: false });
    setPosts((data ?? []) as BlogPost[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { posts, loading, reload: load };
}
