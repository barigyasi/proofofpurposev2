import type { Database } from "@/integrations/supabase/types";

export type BlogCategory = Database["public"]["Enums"]["blog_category"];
export type BlogStatus = Database["public"]["Enums"]["blog_post_status"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];

export const CATEGORY_LABEL: Record<BlogCategory, string> = {
  champion_story: "Champion stories",
  bounty_recap: "Bounty recaps",
  update: "Updates",
  announcement: "Announcements",
  feature: "Features",
};

export const CATEGORY_ORDER: BlogCategory[] = [
  "champion_story",
  "bounty_recap",
  "feature",
  "update",
  "announcement",
];

export const STATUS_LABEL: Record<BlogStatus, string> = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Changes requested",
  published: "Published",
  archived: "Archived",
};

const slugRand = () => Math.random().toString(36).slice(2, 8);

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${base || "post"}-${slugRand()}`;
}

export function readTimeMinutes(md: string): number {
  const words = (md || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function excerptFromBody(md: string, max = 180): string {
  const stripped = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max - 1).trimEnd() + "…";
}
