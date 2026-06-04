type Props = {
  asOf: string | null;
  expectedDays?: number;
};

function staleDays(asOf: string): number {
  const diff = Date.now() - new Date(asOf).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function FreshnessBadge({ asOf, expectedDays = 7 }: Props) {
  if (!asOf) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        기준일 없음
      </span>
    );
  }

  const days = staleDays(asOf);
  const stale = days > expectedDays * 1.5;
  const color = stale ? "bg-status-caution" : "bg-status-normal";

  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <span className={["h-1.5 w-1.5 rounded-full flex-shrink-0", color].join(" ")} />
      기준 {asOf}
    </span>
  );
}
