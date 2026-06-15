// /rates KITA 스타일 검색 — 순수 선택 헬퍼(클라이언트 필터). year_mon은 YYYYMM로 정규화.
const ym6 = (s: string) => String(s).replace(/\D/g, "").slice(0, 6);

export function inMonthRange<T extends { year_mon: string }>(rows: T[], startYM: string, endYM: string): T[] {
  const lo = startYM <= endYM ? startYM : endYM;
  const hi = startYM <= endYM ? endYM : startYM;
  return rows.filter((r) => {
    const m = ym6(r.year_mon);
    return m.length === 6 && m >= lo && m <= hi;
  });
}

export function monthBounds<T extends { year_mon: string }>(rows: T[]): { min: string; max: string } | null {
  const ms = rows.map((r) => ym6(r.year_mon)).filter((m) => m.length === 6).sort();
  return ms.length ? { min: ms[0], max: ms[ms.length - 1] } : null;
}

export function regionsOf<T extends { region: string | null }>(rows: T[]): string[] {
  return [...new Set(rows.map((r) => r.region).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
}

export function portsOf<T extends { region: string | null; dest: string }>(rows: T[], region: string): string[] {
  return [...new Set(rows.filter((r) => r.region === region).map((r) => r.dest))].sort((a, b) => a.localeCompare(b));
}

export function routeSeries<T extends { dest: string; year_mon: string }>(
  rows: T[],
  dest: string,
  value: (r: T) => number | null,
): { ym: string; value: number }[] {
  return rows
    .filter((r) => r.dest === dest)
    .map((r) => ({ ym: ym6(r.year_mon), value: value(r) }))
    .filter((p): p is { ym: string; value: number } => p.ym.length === 6 && p.value != null)
    .sort((a, b) => a.ym.localeCompare(b.ym));
}

export type PortLatest = { dest: string; ym: string; value: number | null; mom: number | null };

export function regionPortsLatest<T extends { region: string | null; dest: string; year_mon: string }>(
  rows: T[],
  region: string,
  value: (r: T) => number | null,
): PortLatest[] {
  return portsOf(rows, region)
    .map((dest) => {
      const s = routeSeries(rows, dest, value);
      const last = s.at(-1);
      const prev = s.at(-2);
      const mom = last && prev && prev.value !== 0 ? ((last.value - prev.value) / prev.value) * 100 : null;
      return { dest, ym: last?.ym ?? "", value: last?.value ?? null, mom };
    })
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
}

export function topPorts(latest: PortLatest[], n: number): string[] {
  return latest.filter((p) => p.value != null).slice(0, n).map((p) => p.dest);
}

// 전월대비 변동률 히트맵 격자 — 주어진 dest들에 대해 최근 monthsBack개월의 MoM(%) 셀.
// prev는 "데이터가 있는 직전 월"(결측월 건너뜀) 기준. 셀 결측은 null.
export function heatmapMoM<T extends { dest: string; year_mon: string }>(
  rows: T[],
  dests: string[],
  value: (r: T) => number | null,
  monthsBack = 6,
): { months: string[]; rows: { dest: string; cells: (number | null)[] }[] } {
  const monthSet = new Set<string>();
  for (const r of rows) {
    const m = ym6(r.year_mon);
    if (m.length === 6) monthSet.add(m);
  }
  const months = [...monthSet].sort().slice(-monthsBack);
  const out = dests.map((dest) => {
    const series = new Map<string, number>();
    for (const r of rows) {
      if (r.dest !== dest) continue;
      const m = ym6(r.year_mon);
      const v = value(r);
      if (m.length === 6 && v != null) series.set(m, v);
    }
    const sorted = [...series.keys()].sort();
    const cells = months.map((m) => {
      const v = series.get(m);
      if (v == null) return null;
      const prevM = sorted[sorted.indexOf(m) - 1];
      const prev = prevM ? series.get(prevM) : undefined;
      if (prev == null || prev === 0) return null;
      return ((v - prev) / prev) * 100;
    });
    return { dest, cells };
  });
  return { months, rows: out };
}
