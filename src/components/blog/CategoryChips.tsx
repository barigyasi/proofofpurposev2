import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, CATEGORY_ORDER, type BlogCategory } from "@/lib/blog";

interface Props {
  value: BlogCategory | "all";
  onChange: (v: BlogCategory | "all") => void;
}

export function CategoryChips({ value, onChange }: Props) {
  const items: Array<{ id: BlogCategory | "all"; label: string }> = [
    { id: "all", label: "All" },
    ...CATEGORY_ORDER.map((id) => ({ id, label: CATEGORY_LABEL[id] })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "border-2 border-foreground px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-secondary",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
