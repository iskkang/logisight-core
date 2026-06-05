// Sticky financial-terminal-style index ticker — live from freight_indices + NYFI API.
import { useQuery } from "@tanstack/react-query";
import {
  freightIndicesQueryOptions,
  indexDisplayLabel,
  formatIndexDisplayValue,
} from "@/lib/api/freight-indices";
import { nyfiQueryOptions, sortNyfiLanes, formatNyfiValue } from "@/lib/api/nyfi";

type Item = { code: string; label: string; value: string; change?: number | null };

function ChangeChip({ change }: { change: number | null | undefined }) {
  if (change == null) return <span className="text-xs text-[var(--color-ink-muted)]">—</span>;
  const pos = change >= 0;
  return (
    <span
      className="text-xs font-semibold tabular-nums"
      style={{ color: pos ? "var(--color-success)" : "var(--color-danger)" }}
    >
      {pos ? "+" : ""}
      {change.toFixed(2)}%
    </span>
  );
}

function TickerItem({ it }: { it: Item }) {
  return (
    <li className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
        {it.label}
      </span>
      <span className="text-sm font-bold tabular-nums text-[var(--color-ink)]">
        {it.value}
      </span>
      <ChangeChip change={it.change} />
      <span className="mx-4 inline-block h-3 w-px bg-[var(--color-line)]" />
    </li>
  );
}

export function IndexBar({ items }: { items?: Item[] }) {
  const { data, isLoading } = useQuery(freightIndicesQueryOptions());
  const { data: nyfi } = useQuery(nyfiQueryOptions());

  const supabaseItems: Item[] = (data ?? []).map((r) => ({
    code: r.index_code,
    label: indexDisplayLabel(r.index_code),
    value: isLoading ? "…" : formatIndexDisplayValue(r.index_code, r.value),
    change: r.change_pct,
  }));

  const nyfiItems: Item[] = sortNyfiLanes(nyfi ?? []).map((l) => ({
    code: l.code,
    label: `NYFI ${l.nameKo}`,
    value: formatNyfiValue(l.value),
    change: l.wow,
  }));

  const resolved: Item[] = items ?? [...supabaseItems, ...nyfiItems];

  const track = resolved.map((it, i) => <TickerItem key={it.code + "-" + i} it={it} />);

  return (
    <div
      className="sticky top-14 z-40 border-b"
      style={{ background: "var(--color-card)", borderColor: "var(--color-line)" }}
    >
      <div className="mx-auto max-w-7xl overflow-hidden whitespace-nowrap">
        <ul className="animate-ticker inline-flex min-w-max items-center px-4 py-2 lg:px-6">
          {track}
          {track}
        </ul>
      </div>
    </div>
  );
}
