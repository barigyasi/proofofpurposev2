import { lazy, Suspense, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MarkdownView = lazy(() =>
  import("./MarkdownView").then((m) => ({ default: m.MarkdownView })),
);

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}

type Tab = "write" | "preview";

export function MarkdownEditor({ value, onChange, rows = 18, placeholder }: Props) {
  const [tab, setTab] = useState<Tab>("write");

  return (
    <div className="brutal flex flex-col bg-card">
      <div className="flex border-b-2 border-foreground">
        {(
          [
            { id: "write" as const, label: "Write", icon: Pencil },
            { id: "preview" as const, label: "Preview", icon: Eye },
          ]
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 border-r-2 border-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-widest last:border-r-0",
                active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[420px] p-4">
        {tab === "write" ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={
              placeholder ??
              "# Heading\n\nWrite the story in Markdown. Supports **bold**, _italic_, [links](https://example.com), lists, images, and quotes."
            }
            className="min-h-[400px] font-mono text-sm leading-relaxed"
          />
        ) : value.trim() ? (
          <Suspense
            fallback={
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Loading preview…
              </p>
            }
          >
            <MarkdownView source={value} />
          </Suspense>
        ) : (
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Nothing to preview yet.
          </p>
        )}
      </div>

      <p className="border-t-2 border-foreground bg-secondary px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Markdown supported · images: ![alt](url) · HTML is sanitized
      </p>
    </div>
  );
}
