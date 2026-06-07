// 티커 — freight_indices 실데이터만(가공 NYFI/FBX 라벨 금지). 방향색 적/녹/황 + 글리프.
type TickerItem = { code: string; value: string; changePct: number | null };

function dirCls(p: number | null): string {
  if (p == null || p === 0) return "text-direction-flat";
  return p > 0 ? "text-direction-up" : "text-direction-down";
}
function glyph(p: number | null): string {
  if (p == null || p === 0) return "▬";
  return p > 0 ? "▲" : "▼";
}

function Item({ it }: { it: TickerItem }) {
  return (
    <li className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{it.code}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{it.value}</span>
      <span className={`text-xs font-semibold tabular-nums ${dirCls(it.changePct)}`}>
        {glyph(it.changePct)} {it.changePct != null ? `${it.changePct >= 0 ? "+" : ""}${it.changePct.toFixed(2)}%` : "—"}
      </span>
      <span className="mx-4 inline-block h-3 w-px bg-border" aria-hidden />
    </li>
  );
}

export function DashboardTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const track = items.map((it, i) => <Item key={it.code + "-" + i} it={it} />);
  return (
    <div className="sticky top-14 z-40 border-b border-border bg-card">
      <div className="mx-auto max-w-7xl overflow-hidden whitespace-nowrap">
        <ul className="animate-ticker inline-flex min-w-max items-center px-4 py-2 lg:px-6">
          {track}
          {track}
        </ul>
      </div>
    </div>
  );
}
