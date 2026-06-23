import type { IndexStats, KitaAirRateRow } from "@/lib/api/rates";
import { orderedTickerStats, latestByRoute, computeMoM } from "@/lib/api/rates";

export type TickerDir = "up" | "down" | "flat";
export type TickerVM = { sym: string; value: string; delta: string; dir: TickerDir };

export function toTickerItems(stats: IndexStats[]): TickerVM[] {
  return orderedTickerStats(stats).map((s) => {
    const p = s.change_pct;
    const dir: TickerDir = p == null || p === 0 ? "flat" : p > 0 ? "up" : "down";
    const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
    const sign = dir === "up" ? "+" : "";
    const delta = `${glyph} ${sign}${(p ?? 0).toFixed(2)}%`;
    return {
      sym: s.index_code,
      value: s.latest_value!.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      delta,
      dir,
    };
  });
}

export type PortCongestionVM = { value: number | null; topPorts: string[] };

export function aggregatePortCongestion(
  snapshot: { ports: { name: string; congestion: number | null }[] } | null,
): PortCongestionVM {
  const ports = (snapshot?.ports ?? []).filter(
    (p): p is { name: string; congestion: number } => p.congestion != null,
  );
  if (ports.length === 0) return { value: null, topPorts: [] };
  const avg = Math.round(ports.reduce((s, p) => s + p.congestion, 0) / ports.length);
  const topPorts = [...ports].sort((a, b) => b.congestion - a.congestion).slice(0, 2).map((p) => p.name);
  return { value: avg, topPorts };
}

export type AirMoMVM = { mom: number | null; routeLabel: string; yearMon: string | null };

export function pickAirMoM(rows: KitaAirRateRow[]): AirMoMVM {
  const top =
    latestByRoute(rows)
      .map((r) => {
        const series = rows
          .filter((a) => a.origin === r.origin && a.dest === r.dest)
          .map((a) => ({ year_mon: a.year_mon, value: a.kg300 }));
        return { r, mom: computeMoM(series) };
      })
      .filter((c) => c.mom !== null && Math.abs(c.mom) <= 200)
      .sort((a, b) => Math.abs(b.mom!) - Math.abs(a.mom!))
      .at(0) ?? null;
  return {
    mom: top?.mom ?? null,
    routeLabel: top ? `인천→${top.r.dest}` : "인천발",
    yearMon: top?.r.year_mon ?? null,
  };
}
