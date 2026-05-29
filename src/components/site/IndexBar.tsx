// Sticky financial-terminal-style index ticker — live from freight_indices.
import { useQuery } from "@tanstack/react-query";
import {
  freightIndicesQueryOptions,
  formatIndexValue,
  formatWeekLabel,
} from "@/lib/api/freight-indices";

type Item = { code: string; label: string; value: string; change?: number | null };

function ChangeChip({ change }: { change: number | null | undefined }) {
  if (change == null) return <span className="text-xs text-[var(--color-ink-muted)]">—</span>;
  const pos = change >= 0;
  return (
    <span
      className="text-xs font-semibold tabular-nums"
      style={{
        color: pos ? "var(--color-success)" : "var(--color-danger)",
      }}
    >
      {pos ? "+" : ""}
      {change.toFixed(2)}%
    </span>
  );
}

export function IndexBar({
  items,
  updatedLabel,
}: {
  items?: Item[];
  updatedLabel?: string;
}) {
  const { data, isLoading } = useQuery(freightIndicesQueryOptions());

  const resolved: Item[] =
    items ??
    (data ?? []).map((r) => ({
      code: r.index_code,
      label: r.index_code,
      value: isLoading ? "…" : formatIndexValue(r.value),
      change: r.change_pct,
    }));

  const latestWeek = (data ?? [])
    .map((r) => r.week_date)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <div
      className="sticky top-14 z-40 border-b"
      style={{ background: "#fff", borderColor: "var(--color-line)" }}
    >
      <div className="mx-auto max-w-7xl overflow-x-auto scrollbar-thin">
        <ul className="flex min-w-max items-center gap-6 px-4 py-2 lg:px-6">
          {resolved.map((it) => (
            <li key={it.code} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                {it.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-[var(--color-ink)]">
                {it.value}
              </span>
              <ChangeChip change={it.change} />
            </li>
          ))}
          <li className="ml-2 whitespace-nowrap text-[11px] text-[var(--color-ink-muted)]">
            {updatedLabel ?? formatWeekLabel(latestWeek)}
          </li>
        </ul>
      </div>
    </div>
  );
}