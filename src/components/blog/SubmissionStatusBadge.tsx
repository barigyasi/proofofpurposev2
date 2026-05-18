import { cn } from "@/lib/utils";
import { STATUS_LABEL, type BlogStatus } from "@/lib/blog";

const STYLES: Record<BlogStatus, string> = {
  draft: "bg-secondary text-foreground",
  pending: "bg-primary/20 text-foreground",
  approved: "bg-primary text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  published: "bg-primary text-primary-foreground",
  archived: "bg-muted text-muted-foreground",
};

export function SubmissionStatusBadge({ status }: { status: BlogStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border-2 border-foreground px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
