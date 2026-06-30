// 지수 티커 — freight_indices + NYFI 실데이터. 프로토타입 NavTicker 스타일
// (코드: 시안 언더라인 · 모노 숫자 · ▲/▼ 방향 글리프 · 우측 기준일).
import { useQuery } from "@tanstack/react-query";
import {
  freightIndicesQueryOptions,
  indexDisplayLabel,
  formatIndexDisplayValue,
} from "@/lib/api/freight-indices";
import { nyfiQueryOptions, sortNyfiLanes, formatNyfiValue } from "@/lib/api/nyfi";

type Item = { code: string; label: string; value: string; change?: number | null };

function ChangeChip({ change }: { change: number | null | undefined }) {
  if (change == null)
    return <span className="text-xs text-[var(--color-ink-muted)]">—</span>;
  const pos = change >= 0;
  return (
    <span
      className="text-xs font-semibold tabular-nums"
      style={{
        fontFamily: "var(--font-mono)",
        color: pos ? "var(--color-direction-up)" : "var(--color-direction-down)",
      }}
    >
      {pos ? "▲ +" : "▼ −"}
      {Math.abs(change).toFixed(2)}%
    </span>
  );
}

function TickerItem({ it, last }: { it: Item; last: boolean }) {
  return (
    <li className="inline-flex items-center gap-[7px] whitespace-nowrap">
      <span
        className="pb-px text-[11.5px] uppercase tracking-wide text-[var(--color-ink-muted)]"
        style={{ borderBottom: "2px solid color-mix(in oklch, var(--color-cyan) 55%, transparent)" }}
      >
        {it.label}
      </span>
      <span
        className="text-[13.5px] font-bold tabular-nums text-[var(--color-ink)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {it.value}
      </span>
      <ChangeChip change={it.change} />
      {!last && <span className="mx-4 inline-block h-3 w-px bg-[var(--color-line)]" />}
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
  const asOf = (data ?? [])[0]?.week_date?.slice(0, 10) ?? null;

  return (
    <div
      className="border-b"
      style={{ background: "var(--color-card)", borderColor: "var(--color-line)" }}
    >
      <div className="mx-auto flex max-w-[1540px] items-center overflow-x-auto px-4 lg:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="inline-flex min-w-max items-center py-[9px]">
          {resolved.map((it, i) => (
            <TickerItem key={it.code + "-" + i} it={it} last={i === resolved.length - 1} />
          ))}
        </ul>
        <span className="ml-auto whitespace-nowrap pl-4 text-[11.5px] text-[var(--color-ink-muted)]">
          {asOf ? `기준일 ${asOf} (KST) · ` : ""}출처 각 지수 발표기관(SSE·KOBC·Drewry·NYSHEX 등)
        </span>
      </div>
    </div>
  );
}
