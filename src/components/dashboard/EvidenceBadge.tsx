type Props = { label: string };

export function EvidenceBadge({ label }: Props) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
      {label}
    </span>
  );
}
