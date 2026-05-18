import { Link } from "react-router-dom";
import { CATEGORY_LABEL, formatDate, type BlogPost } from "@/lib/blog";

export function FeaturedPostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/stories/${post.slug}`}
      className="brutal brutal-hover group block overflow-hidden bg-primary text-primary-foreground"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden border-b-2 border-foreground lg:aspect-auto lg:border-b-0 lg:border-r-2">
          {post.cover_url ? (
            <img
              src={post.cover_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-background font-display text-6xl text-foreground/20">
              //
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between gap-6 p-6 sm:p-10">
          <div>
            <span className="inline-block border-2 border-foreground bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground">
              ★ Featured · {CATEGORY_LABEL[post.category]}
            </span>
            <h2 className="mt-5 font-display text-4xl leading-[1] sm:text-5xl lg:text-6xl">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-5 max-w-prose text-base leading-relaxed sm:text-lg">
                {post.excerpt}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest">
            <span>{formatDate(post.published_at)}</span>
            {post.read_time_minutes ? <span>{post.read_time_minutes} min read →</span> : <span>Read →</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
