interface Props {
  label: string;
}

export function SectionDivider({ label }: Props) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-0.5 flex-1 bg-foreground" />
      <span className="font-display text-sm tracking-wider">{label}</span>
      <div className="h-0.5 flex-1 bg-foreground" />
    </div>
  );
}
