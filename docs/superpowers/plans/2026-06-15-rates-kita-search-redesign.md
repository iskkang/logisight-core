# /rates KITA-Style Search Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the /rates filter bar + long stacked rate tables with a KITA-style search (분류·출발지·도착지 권역▸항만·기간) that drives a result chart + table, while keeping the MoM heatmap.

**Architecture:** All search/filtering is client-side over already-loaded `kita_sea_rates` / `kita_air_rates`. Pure selection helpers (TDD with vitest) live in `src/routes/rates.search.ts`. Three new presentational components (search bar, result chart, result table) live in `src/routes/rates.tsx`. Existing heatmap, global-index trend, and recent-reports blocks stay.

**Tech Stack:** React 19, TanStack Router/Query, Recharts, vitest. Repo conventions: inline styles with CSS vars, no RTL (UI verified via `vite build`); pure logic via vitest.

Spec: `docs/superpowers/specs/2026-06-15-rates-kita-search-redesign-design.md`

---

## File Structure

- Create: `src/routes/rates.search.ts` — pure helpers (month-range filter, regions/ports, route series, region per-port latest+MoM, top-N).
- Create: `src/routes/__tests__/rates.search.test.ts` — vitest unit tests for helpers.
- Modify: `src/routes/rates.tsx` — add search state + 3 components; remove 전체 mode, KPI strip, long tables, old filter bar, old comparison chart.

No new routes, APIs, or DB tables.

---

## Task 1: Pure search/select helpers

**Files:**
- Create: `src/routes/rates.search.ts`
- Test: `src/routes/__tests__/rates.search.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/routes/__tests__/rates.search.test.ts
import { describe, it, expect } from "vitest";
import {
  inMonthRange,
  monthBounds,
  regionsOf,
  portsOf,
  routeSeries,
  regionPortsLatest,
  topPorts,
} from "../rates.search";

type Row = { origin: string; dest: string; region: string | null; year_mon: string; feu: number | null };
const mk = (p: Partial<Row>): Row =>
  ({ origin: "부산", dest: "롱비치", region: "북미", year_mon: "202606", feu: 100, ...p });

describe("inMonthRange", () => {
  it("filters inclusive by YYYYMM and tolerates reversed bounds", () => {
    const rows = [mk({ year_mon: "202604" }), mk({ year_mon: "202606" }), mk({ year_mon: "202601" })];
    expect(inMonthRange(rows, "202606", "202604").map((r) => r.year_mon).sort()).toEqual(["202604", "202606"]);
  });
});

describe("monthBounds", () => {
  it("returns min/max YYYYMM or null", () => {
    expect(monthBounds([mk({ year_mon: "202601" }), mk({ year_mon: "202606" })])).toEqual({ min: "202601", max: "202606" });
    expect(monthBounds([])).toBeNull();
  });
});

describe("regionsOf / portsOf", () => {
  it("lists distinct regions and ports within a region, sorted", () => {
    const rows = [
      mk({ region: "북미", dest: "롱비치" }),
      mk({ region: "북미", dest: "서배너" }),
      mk({ region: "유럽", dest: "함부르크" }),
    ];
    expect(regionsOf(rows)).toEqual(["북미", "유럽"]);
    expect(portsOf(rows, "북미")).toEqual(["롱비치", "서배너"]);
  });
});

describe("routeSeries", () => {
  it("returns sorted non-null monthly values for one dest", () => {
    const rows = [
      mk({ dest: "롱비치", year_mon: "202606", feu: 4950 }),
      mk({ dest: "롱비치", year_mon: "202605", feu: 2900 }),
      mk({ dest: "롱비치", year_mon: "202604", feu: null }),
      mk({ dest: "서배너", year_mon: "202606", feu: 5000 }),
    ];
    expect(routeSeries(rows, "롱비치", (r) => r.feu)).toEqual([
      { ym: "202605", value: 2900 },
      { ym: "202606", value: 4950 },
    ]);
  });
});

describe("regionPortsLatest", () => {
  it("gives one row per port (latest month) with MoM, sorted by value desc", () => {
    const rows = [
      mk({ dest: "롱비치", year_mon: "202605", feu: 2900 }),
      mk({ dest: "롱비치", year_mon: "202606", feu: 4950 }),
      mk({ dest: "서배너", year_mon: "202606", feu: 5100 }),
    ];
    const out = regionPortsLatest(rows, "북미", (r) => r.feu);
    expect(out[0]).toEqual({ dest: "서배너", ym: "202606", value: 5100, mom: null });
    expect(out[1].dest).toBe("롱비치");
    expect(Math.round(out[1].mom!)).toBe(71);
  });
});

describe("topPorts", () => {
  it("returns up to N dest names with non-null value", () => {
    const latest = [
      { dest: "a", ym: "202606", value: 5, mom: null },
      { dest: "b", ym: "202606", value: null, mom: null },
      { dest: "c", ym: "202606", value: 3, mom: null },
    ];
    expect(topPorts(latest, 1)).toEqual(["a"]);
    expect(topPorts(latest, 5)).toEqual(["a", "c"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/routes/__tests__/rates.search.test.ts`
Expected: FAIL — `Cannot find module '../rates.search'`.

- [ ] **Step 3: Implement the helpers**

```ts
// src/routes/rates.search.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/routes/__tests__/rates.search.test.ts`
Expected: PASS (6 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/routes/rates.search.ts src/routes/__tests__/rates.search.test.ts
git commit -m "feat(rates): pure search/select helpers for KITA-style filter"
```

---

## Task 2: Search bar + result state in RatesPage

**Files:**
- Modify: `src/routes/rates.tsx`

Introduces a normalized in-component value getter and search state. The mode is sea/air only.

- [ ] **Step 1: Add imports and constants (top of rates.tsx)**

Add to imports:

```tsx
import {
  inMonthRange,
  monthBounds,
  regionsOf,
  portsOf,
  routeSeries,
  regionPortsLatest,
  topPorts,
} from "@/routes/rates.search";
```

Add near other module constants:

```tsx
type Mode2 = "sea" | "air";
const ORIGIN_BY_MODE: Record<Mode2, string> = { sea: "부산", air: "인천" };
const ALL_PORTS = "__all__"; // 도착지 "전체(권역)"
const REGION_MULTILINE_CAP = 8; // 권역 멀티라인 상위 N
const CMP_LINE_COLORS = [
  "var(--navy-600)", "var(--cyan)", "var(--status-caution)", "var(--status-normal)",
  "var(--status-alert)", "oklch(0.55 0.18 300)", "var(--status-observe)", "oklch(0.65 0.15 130)",
];
```

- [ ] **Step 2: Replace filter state with search state**

Find in `RatesPage`:

```tsx
  const [mode, setMode] = useState<ModeKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [origin, setOrigin] = useState("all");
  const [dest, setDest] = useState("all");
  const [query, setQuery] = useState("");
```

Replace with:

```tsx
  const [mode, setMode] = useState<Mode2>("sea");
  const [region, setRegion] = useState<string>("");
  const [port, setPort] = useState<string>(ALL_PORTS);
  const [metric, setMetric] = useState<"feu" | "teu">("feu");

  const activeRows = mode === "sea" ? seaRates : airRates;
  const valueOf = (r: KitaSeaRateRow | KitaAirRateRow): number | null =>
    mode === "sea"
      ? metric === "feu"
        ? (r as KitaSeaRateRow).feu
        : (r as KitaSeaRateRow).teu
      : (r as KitaAirRateRow).kg300;

  const bounds = useMemo(() => monthBounds(activeRows), [activeRows]);
  const [startYM, setStartYM] = useState<string>("");
  const [endYM, setEndYM] = useState<string>("");

  // 기본값: 권역=북미(없으면 첫 권역), 기간=최신 13개월
  const regions = useMemo(() => regionsOf(activeRows), [activeRows]);
  useEffect(() => {
    if (!regions.length) return;
    setRegion((r) => (regions.includes(r) ? r : regions.includes("북미") ? "북미" : regions[0]));
  }, [regions]);
  useEffect(() => {
    if (!bounds) return;
    const max = bounds.max;
    const y = Number(max.slice(0, 4));
    const m = Number(max.slice(4, 6));
    const d = new Date(Date.UTC(y, m - 1 - 12, 1));
    const start = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    setEndYM(max);
    setStartYM(start < bounds.min ? bounds.min : start);
  }, [bounds]);
```

Add `useEffect` to the React import if missing:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
```

- [ ] **Step 3: Compute scoped rows + result models**

Add after the state block:

```tsx
  const scoped = useMemo(
    () => (startYM && endYM ? inMonthRange(activeRows, startYM, endYM) : activeRows),
    [activeRows, startYM, endYM],
  );
  const ports = useMemo(() => portsOf(scoped, region), [scoped, region]);
  const portSelected = port !== ALL_PORTS && ports.includes(port);

  // 차트 라인 대상: 항만 선택 → 그 항만 1개 / 권역만 → 상위 N 항만
  const regionLatest = useMemo(
    () => regionPortsLatest(scoped, region, valueOf),
    [scoped, region, metric, mode],
  );
  const chartPorts = useMemo(
    () => (portSelected ? [port] : topPorts(regionLatest, REGION_MULTILINE_CAP)),
    [portSelected, port, regionLatest],
  );
  const chartData = useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string>>();
    for (const p of chartPorts) {
      for (const pt of routeSeries(scoped, p, valueOf)) {
        const row = byMonth.get(pt.ym) ?? { month: pt.ym };
        row[p] = pt.value;
        byMonth.set(pt.ym, row);
      }
    }
    return [...byMonth.values()]
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((r) => ({ ...r, label: fmtMonth(String(r.month)) }));
  }, [chartPorts, scoped, metric, mode]);
```

- [ ] **Step 4: Verify it type-checks via build**

Run: `npx vite build`
Expected: build succeeds (`✓ built`). (Components in later tasks reference these; temporary unused-var warnings are acceptable until Task 5 wires render.)

- [ ] **Step 5: Commit**

```bash
git add src/routes/rates.tsx
git commit -m "feat(rates): search state (mode/region/port/period) + result models"
```

---

## Task 3: Search bar component

**Files:**
- Modify: `src/routes/rates.tsx`

- [ ] **Step 1: Add the `RateSearchBar` component (bottom of file, near other components)**

```tsx
function Sel({ value, onChange, items, width }: {
  value: string; onChange: (v: string) => void; items: { v: string; label: string }[]; width?: number;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ height: 32, width, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", padding: "0 8px", fontSize: 12.5, color: "var(--ink)" }}
    >
      {items.map((it) => <option key={it.v} value={it.v}>{it.label}</option>)}
    </select>
  );
}

function ymItems(bounds: { min: string; max: string } | null, part: "y" | "m") {
  if (!bounds) return [] as { v: string; label: string }[];
  if (part === "y") {
    const y0 = Number(bounds.min.slice(0, 4)), y1 = Number(bounds.max.slice(0, 4));
    return Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ v: String(y0 + i), label: `${y0 + i}년` }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1).padStart(2, "0"), label: `${i + 1}월` }));
}

function RateSearchBar(props: {
  mode: Mode2; setMode: (m: Mode2) => void;
  origin: string;
  region: string; setRegion: (r: string) => void; regions: string[];
  port: string; setPort: (p: string) => void; ports: string[];
  bounds: { min: string; max: string } | null;
  startYM: string; endYM: string; setStartYM: (s: string) => void; setEndYM: (s: string) => void;
  onReset: () => void;
}) {
  const sy = props.startYM.slice(0, 4), sm = props.startYM.slice(4, 6);
  const ey = props.endYM.slice(0, 4), em = props.endYM.slice(4, 6);
  const setStart = (y: string, m: string) => props.setStartYM(`${y}${m}`);
  const setEnd = (y: string, m: string) => props.setEndYM(`${y}${m}`);
  return (
    <PCard pad="md">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "var(--ink-muted)" }}>
        <FilterSeg label="분류" options={["해상", "항공"] as const} value={props.mode === "sea" ? "해상" : "항공"} onChange={(v) => props.setMode(v === "해상" ? "sea" : "air")} />
        <span>출발지</span><Sel value={props.origin} onChange={() => {}} items={[{ v: props.origin, label: props.origin }]} width={86} />
        <span>도착지</span>
        <Sel value={props.region} onChange={props.setRegion} items={props.regions.map((r) => ({ v: r, label: r }))} width={110} />
        <Sel value={props.port} onChange={props.setPort} items={[{ v: ALL_PORTS, label: "전체(권역)" }, ...props.ports.map((p) => ({ v: p, label: p }))]} width={130} />
        <span style={{ marginLeft: 6 }}>기간</span>
        <Sel value={sy} onChange={(y) => setStart(y, sm)} items={ymItems(props.bounds, "y")} width={84} />
        <Sel value={sm} onChange={(m) => setStart(sy, m)} items={ymItems(props.bounds, "m")} width={68} />
        <span>~</span>
        <Sel value={ey} onChange={(y) => setEnd(y, em)} items={ymItems(props.bounds, "y")} width={84} />
        <Sel value={em} onChange={(m) => setEnd(ey, m)} items={ymItems(props.bounds, "m")} width={68} />
        <button type="button" onClick={props.onReset}
          style={{ marginLeft: "auto", height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer" }}>
          초기화
        </button>
      </div>
    </PCard>
  );
}
```

Note: `FilterSeg` already exists in the file and is reused with a 2-option list. No explicit 검색 button — state changes apply live (KITA "검색" parity satisfied by live update + 초기화).

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/rates.tsx
git commit -m "feat(rates): KITA-style search bar component"
```

---

## Task 4: Result chart + result table components

**Files:**
- Modify: `src/routes/rates.tsx`

- [ ] **Step 1: Add `RateResultChart`**

```tsx
function RateResultChart(props: {
  title: string; mode: Mode2; metric: "feu" | "teu"; setMetric: (m: "feu" | "teu") => void;
  lines: string[]; data: Record<string, number | string>[];
}) {
  const unit = props.mode === "sea" ? (props.metric === "feu" ? "$/FEU" : "$/TEU") : "$/kg(kg300)";
  return (
    <Panel
      title={props.title}
      badge={<PBadge variant="secondary">{props.mode === "sea" ? "해상" : "항공"} · {unit}</PBadge>}
      action={props.mode === "sea" ? (
        <div style={{ display: "inline-flex", gap: 4 }}>
          {(["feu", "teu"] as const).map((m) => (
            <button key={m} type="button" onClick={() => props.setMetric(m)}
              style={{ height: 26, padding: "0 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                border: "1px solid var(--border)", background: props.metric === m ? "var(--navy-600)" : "var(--card)",
                color: props.metric === m ? "#fff" : "var(--ink-muted)" }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}
    >
      {props.data.length < 2 || props.lines.length === 0 ? (
        <Collecting note="선택 조건의 시계열이 2개월 이상 확보되면 표시됩니다." />
      ) : (
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={props.data} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} width={52}
                tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`} />
              <Tooltip formatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              {props.lines.map((p, i) => (
                <Line key={p} type="monotone" dataKey={p} stroke={CMP_LINE_COLORS[i % CMP_LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11.5, color: "var(--ink-muted)" }}>
            {props.lines.map((p, i) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: CMP_LINE_COLORS[i % CMP_LINE_COLORS.length] }} />
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Add `RateResultTable`**

```tsx
function RateResultTable(props: {
  mode: Mode2; origin: string; region: string; portSelected: boolean; port: string;
  rows: KitaSeaRateRow[] | KitaAirRateRow[]; regionLatest: import("@/routes/rates.search").PortLatest[];
}) {
  const isSea = props.mode === "sea";
  return (
    <Panel title="세부 운임 동향" badge={<PBadge variant="secondary">{props.portSelected ? `${props.origin} → ${props.port}` : `${props.region} 권역`}</PBadge>} bodyPad={0}>
      <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr>
              <th style={thStyle()}>{props.portSelected ? "년·월" : "노선"}</th>
              {isSea
                ? (<><th style={thStyle("right")}>TEU</th><th style={thStyle("right")}>FEU</th></>)
                : (<><th style={thStyle("right")}>kg100</th><th style={thStyle("right")}>kg300</th><th style={thStyle("right")}>kg500</th></>)}
              {!props.portSelected && <th style={thStyle("right")}>전월대비</th>}
            </tr>
          </thead>
          <tbody>
            {props.portSelected
              ? [...props.rows]
                  .filter((r) => r.dest === props.port)
                  .sort((a, b) => String(b.year_mon).localeCompare(String(a.year_mon)))
                  .map((r) => (
                    <tr key={r.year_mon} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...tdStyle(), fontWeight: 600 }}>{fmtMonth(r.year_mon)}</td>
                      {isSea
                        ? (<><td style={tdStyle("right")}>{fmtNumber((r as KitaSeaRateRow).teu)}</td><td style={tdStyle("right")}>{fmtNumber((r as KitaSeaRateRow).feu)}</td></>)
                        : (<><td style={tdStyle("right")}>{fmtNumber((r as KitaAirRateRow).kg100, 2)}</td><td style={tdStyle("right")}>{fmtNumber((r as KitaAirRateRow).kg300, 2)}</td><td style={tdStyle("right")}>{fmtNumber((r as KitaAirRateRow).kg500, 2)}</td></>)}
                    </tr>
                  ))
              : props.regionLatest.map((p) => {
                  const row = props.rows.find((r) => r.dest === p.dest && String(r.year_mon).replace(/\D/g, "").slice(0, 6) === p.ym);
                  return (
                    <tr key={p.dest} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...tdStyle(), fontWeight: 600 }}>{props.origin} → {p.dest}<div style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 500 }}>{fmtMonth(p.ym)}</div></td>
                      {isSea
                        ? (<><td style={tdStyle("right")}>{fmtNumber((row as KitaSeaRateRow | undefined)?.teu)}</td><td style={tdStyle("right")}>{fmtNumber((row as KitaSeaRateRow | undefined)?.feu)}</td></>)
                        : (<><td style={tdStyle("right")}>{fmtNumber((row as KitaAirRateRow | undefined)?.kg100, 2)}</td><td style={tdStyle("right")}>{fmtNumber((row as KitaAirRateRow | undefined)?.kg300, 2)}</td><td style={tdStyle("right")}>{fmtNumber((row as KitaAirRateRow | undefined)?.kg500, 2)}</td></>)}
                      <td style={tdStyle("right")}><span style={{ display: "inline-flex", justifyContent: "flex-end" }}><DeltaValue value={p.mom} size={12} /></span></td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {(props.portSelected ? props.rows.filter((r) => r.dest === props.port).length : props.regionLatest.length) === 0 && (
          <div style={{ padding: 18 }}><Collecting note="검색 결과가 없습니다." /></div>
        )}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/rates.tsx
git commit -m "feat(rates): result chart + result table components"
```

---

## Task 5: Wire new layout into RatesPage; remove 전체 mode / KPI / long tables

**Files:**
- Modify: `src/routes/rates.tsx`

- [ ] **Step 1: Replace the filter `PCard`, KPI grid, comparison-chart Panel, and "전체 운임 목록" Panel in the returned JSX**

In `RatesPage` return, replace the block that begins with the filter `<PCard pad="md">…</PCard>` through the end of the `<Panel title="전체 운임 목록" …>…</Panel>` with:

```tsx
        <RouteBreadcrumb />
        <RateSearchBar
          mode={mode} setMode={(m) => { setMode(m); setPort(ALL_PORTS); }}
          origin={ORIGIN_BY_MODE[mode]}
          region={region} setRegion={(r) => { setRegion(r); setPort(ALL_PORTS); }} regions={regions}
          port={port} setPort={setPort} ports={ports}
          bounds={bounds} startYM={startYM} endYM={endYM} setStartYM={setStartYM} setEndYM={setEndYM}
          onReset={() => {
            setMode("sea"); setMetric("feu"); setPort(ALL_PORTS);
            setRegion(regions.includes("북미") ? "북미" : regions[0] ?? "");
            if (bounds) { setEndYM(bounds.max); const y = Number(bounds.max.slice(0, 4)); const mo = Number(bounds.max.slice(4, 6)); const d = new Date(Date.UTC(y, mo - 1 - 12, 1)); const s = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; setStartYM(s < bounds.min ? bounds.min : s); }
          }}
        />

        <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
          <RateResultChart
            title={portSelected ? `운임 추이 — ${ORIGIN_BY_MODE[mode]} → ${port}` : `권역별 운임 추이 — ${region}`}
            mode={mode} metric={metric} setMetric={setMetric} lines={chartPorts} data={chartData}
          />
          <Panel title="전월대비 변동률 히트맵" badge={<PBadge variant="secondary">해상 · 최근 {heatmap.months.length}개월</PBadge>}>
            {/* 기존 히트맵 본문 그대로 유지 (heatmap.rows 등) */}
          </Panel>
        </div>

        <RateResultTable
          mode={mode} origin={ORIGIN_BY_MODE[mode]} region={region}
          portSelected={portSelected} port={port}
          rows={scoped as KitaSeaRateRow[] | KitaAirRateRow[]} regionLatest={regionLatest}
        />
```

Keep the existing heatmap body inside the retained `<Panel title="전월대비 변동률 히트맵">` (move the current heatmap JSX into it unchanged). Keep the lower grid (글로벌 지수 추이 + 최근 리포트) untouched.

- [ ] **Step 2: Delete now-dead code**

Remove from the file:
- `CountKpi` component and its 4 usages (the `<div className="grid grid-cols-2 …">` KPI block).
- `RouteGroupTable` component (long table) and `TinySparkline` if unused after removal.
- `seaMetrics`/`airMetrics`/`allMetrics`/`visibleMetrics`/`seaVisible`/`airVisible`/`unflagged`/`risingCount`/`fallingCount`/`flatCount`/`flaggedCount`/`cmpData`/`origins`/`dests` and helpers used only by them (`buildSeaMetrics`, `buildAirMetrics`, `metricValue`, `buildSeries`, `computeYtd`, `formatSeaRate`, `latestMonthFrom`, `inPeriod`, `monthCutoff`, `scopedSea`/`scopedAir` if now unused, `FilterSelect`).
- Old `ModeKey`/`PeriodKey`/`MODE_KO`/`PERIOD_KO` machinery if unused.
- Unused imports (e.g., `Search`, `latestByRoute`, `computeMoM`).

Keep `heatmap` useMemo (still used) — it depends on `scopedSea`; if `scopedSea` was removed, re-derive months from `seaRates` directly inside `heatmap`.

- [ ] **Step 3: Verify build + tests**

Run: `npx vite build && npx vitest run src/routes/__tests__/rates.search.test.ts`
Expected: `✓ built` and tests PASS. Fix any unused-symbol/type errors surfaced by the build.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `npm run dev`, open `/rates`. Verify:
- 분류 해상/항공 토글 switches origin (부산/인천), regions, table columns.
- 도착지 권역만 → 멀티라인 + 항만당 1행 테이블; 항만 선택 → 단일 라인 + 월별 행 테이블.
- 기간 년·월 범위 변경이 차트·테이블에 반영.
- 히트맵(6개 고정), 글로벌 지수 추이, 최근 리포트 정상.

- [ ] **Step 5: Commit**

```bash
git add src/routes/rates.tsx
git commit -m "feat(rates): KITA-style search layout; remove 전체 mode, KPI strip, long tables"
```

---

## Task 6: Final verification + push

- [ ] **Step 1: Full build + unit tests**

Run: `npx vite build && npx vitest run`
Expected: build OK; all tests pass.

- [ ] **Step 2: Push**

```bash
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** 검색바(§3)=Task 2-3; 차트(§4)=Task 3+5; 테이블(§5)=Task 4+5; 히트맵 유지(§6)=Task 5 Step1; 제거(§7)=Task 5 Step2; 헬퍼/테스트(§8-9)=Task 1. All covered.
- **Air toggle:** v1 fixes kg300 (spec §4/§10) — chart unit label notes kg300; table shows kg100/300/500.
- **Type names:** `Mode2`, `ALL_PORTS`, `PortLatest`, `valueOf`, `chartPorts`, `chartData`, `regionLatest`, `portSelected` are used consistently across Tasks 2–5.
- **Known follow-ups (post-build, user will tune on real data):** REGION_MULTILINE_CAP (8), default region (북미), default period width (12 months).
