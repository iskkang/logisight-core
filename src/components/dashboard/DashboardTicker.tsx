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
      <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-400">{it.code}</span>
      <span className="text-xs font-black tabular-nums text-white">{it.value}</span>
      <span className={`text-xs font-semibold tabular-nums ${dirCls(it.changePct)}`}>
        {glyph(it.changePct)} {it.changePct != null ? `${it.changePct >= 0 ? "+" : ""}${it.changePct.toFixed(2)}%` : "—"}
      </span>
      <span className="mx-5 inline-block h-3 w-px bg-white/18" aria-hidden />
    </li>
  );
}

export function DashboardTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const track = items.map((it, i) => <Item key={it.code + "-" + i} it={it} />);
  return (
    <div className="sticky top-14 z-40 border-b border-white/10 bg-[#0f2037] text-slate-300">
      <div className="mx-auto max-w-[1540px] overflow-hidden whitespace-nowrap">
        <ul className="animate-ticker inline-flex min-w-max items-center px-4 py-2 lg:px-12">
          {track}
          {track}
        </ul>
      </div>
    </div>
  );
}
