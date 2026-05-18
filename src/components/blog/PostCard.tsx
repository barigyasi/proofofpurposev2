import { Link } from "react-router-dom";
import { CATEGORY_LABEL, formatDate, type BlogPost } from "@/lib/blog";

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/stories/${post.slug}`}
      className="brutal brutal-hover group flex h-full flex-col overflow-hidden bg-card"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b-2 border-foreground bg-secondary">
        {post.cover_url ? (
          <img
            src={post.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-4xl text-muted-foreground/30">
            //
          </div>
        )}
        <span className="absolute left-3 top-3 border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-widest">
          {CATEGORY_LABEL[post.category]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl leading-tight sm:text-2xl">{post.title}</h3>
        {post.excerpt && (
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{formatDate(post.published_at)}</span>
          {post.read_time_minutes ? <span>{post.read_time_minutes} min read</span> : null}
        </div>
      </div>
    </Link>
  );
}
