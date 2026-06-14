import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, FileText, Search } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHero } from "@/components/site/PageHero";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";
import {
  Collecting,
  DeltaValue,
  FilterSeg,
  Panel,
  PBadge,
  PCard,
  tdStyle,
  thStyle,
} from "@/components/proto/Kit";
import { publishedForecastsQueryOptions } from "@/lib/api/forecasts";
import {
  recentRateReports,
  SERIES_LABEL,
  type RateReport,
} from "@/components/forecasts/forecastUtils";
import {
  bunkerPricesQueryOptions,
  computeMoM,
  freightIndicesHistoryQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  latestByRoute,
  type FreightIndexHistoryRow,
  type KitaAirRateRow,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";

export const Route = createFileRoute("/rates")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions()),
      context.queryClient.ensureQueryData(bunkerPricesQueryOptions()),
      context.queryClient.ensureQueryData(kitaAirRatesQueryOptions()),
      context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions()),
      context.queryClient.ensureQueryData(latestExchangeRateQueryOptions()),
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
    ]);
  },
  pendingMs: 0,
  pendingComponent: RatesPending,
  head: () => ({
    meta: [
      { title: "운임 조회 - Logisight" },
      {
        name: "description",
        content:
          "저장된 KCCI, SCFI, KITA 해상·항공 운임 데이터를 기반으로 글로벌 운임 동향을 조회합니다.",
      },
    ],
  }),
  component: RatesPage,
});

type PeriodKey = "3m" | "6m" | "12m" | "all";
type ModeKey = "all" | "sea" | "air";

type RouteMetric = {
  id: string;
  mode: "해상" | "항공";
  origin: string;
  dest: string;
  region: string | null;
  rate: number | null;
  unit: string;
  currency: "USD" | "KRW";
  latestMonth: string;
  mom: number | null;
  ytd: number | null;
  spark: number[];
};

const MODE_KO = ["전체", "해상", "항공"] as const;
type ModeKo = (typeof MODE_KO)[number];
const MODE_BY_KO: Record<ModeKo, ModeKey> = { 전체: "all", 해상: "sea", 항공: "air" };
const KO_BY_MODE: Record<ModeKey, ModeKo> = { all: "전체", sea: "해상", air: "항공" };

const PERIOD_KO = ["3M", "6M", "12M", "전체"] as const;
type PeriodKo = (typeof PERIOD_KO)[number];
const PERIOD_BY_KO: Record<PeriodKo, PeriodKey> = {
  "3M": "3m",
  "6M": "6m",
  "12M": "12m",
  전체: "all",
};
const KO_BY_PERIOD: Record<PeriodKey, PeriodKo> = {
  "3m": "3M",
  "6m": "6M",
  "12m": "12M",
  all: "전체",
};

const INDEX_COLORS: Record<string, string> = {
  KCCI: "#079455",
  SCFI: "#2563eb",
  BDI: "#f97316",
  WCI: "#8b5cf6",
  CCFI: "#0891b2",
};

const CMP_COLORS = [
  "var(--navy-600)",
  "var(--cyan)",
  "var(--status-caution)",
  "var(--status-normal)",
  "var(--status-alert)",
  "oklch(0.55 0.18 300)",
];

/** 비현실적 MoM 변동률 플래그 기준(%) — 플래그 행은 상승·하락 집계와 정렬 비교에서 분리.
 *  시장 급등기(예: 2026-06 유럽·미주 운임 ~+110%)의 정상 변동은 통과시키고, 닝보 +818% 같은
 *  데이터 의심값만 잡도록 150%로 설정. */
const FLAG_MOM_THRESHOLD = 150;

// 전월대비 히트맵 고정 노선(부산발) — KITA 해상운임 기준. 데이터 없는 노선은 "—"로 표기.
const HEATMAP_ROUTES: { origin: string; dest: string }[] = [
  { origin: "부산", dest: "롱비치" },
  { origin: "부산", dest: "서배너" },
  { origin: "부산", dest: "함부르크" },
  { origin: "부산", dest: "하이퐁" },
  { origin: "부산", dest: "코페르" },
  { origin: "부산", dest: "알렉산드리아" },
];

function RatesPending() {
  return (
    <main className="flex min-h-[62vh] items-center justify-center bg-[#edf3fb] px-4 text-slate-900">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-[#d8e3ef] bg-white px-8 py-7 shadow-[0_10px_28px_rgba(15,35,65,0.08)]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-black tracking-normal text-slate-800">Loading</p>
      </div>
    </main>
  );
}

function fmtNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function fmtPct(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtMonth(value: string | null | undefined) {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
}

function compactMonth(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function latestMonthFrom(rows: { year_mon: string }[]) {
  return (
    rows
      .map((row) => compactMonth(row.year_mon))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  );
}

function monthCutoff(latest: string | null, period: PeriodKey) {
  if (!latest || period === "all") return null;
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const year = Number(latest.slice(0, 4));
  const month = Number(latest.slice(4, 6));
  const date = new Date(Date.UTC(year, month - months, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function inPeriod<T extends { year_mon: string }>(
  rows: T[],
  latest: string | null,
  period: PeriodKey,
) {
  const cutoff = monthCutoff(latest, period);
  if (!cutoff) return rows;
  return rows.filter((row) => compactMonth(row.year_mon) >= cutoff);
}

function valueTone(value: number | null | undefined) {
  if (value == null) return "보합";
  return value > 0 ? "상승" : value < 0 ? "하락" : "보합";
}

function routeKey(row: { origin: string; dest: string }) {
  return `${row.origin}__${row.dest}`;
}

function metricValue(row: KitaSeaRateRow | KitaAirRateRow) {
  if ("feu" in row) return row.feu ?? row.teu;
  return row.kg300 ?? row.kg100 ?? row.kg500;
}

function buildSeries<T extends { origin: string; dest: string; year_mon: string }>(
  rows: T[],
  row: T,
  valueGetter: (item: T) => number | null,
) {
  return rows
    .filter((item) => item.origin === row.origin && item.dest === row.dest)
    .map((item) => ({ year_mon: compactMonth(item.year_mon), value: valueGetter(item) }))
    .filter((item) => item.year_mon && item.value != null)
    .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
}

function computeYtd(series: { year_mon: string; value: number | null }[]) {
  const valid = series.filter((point) => point.value != null);
  if (valid.length < 2) return null;
  const latest = valid.at(-1);
  if (!latest?.value) return null;
  const year = latest.year_mon.slice(0, 4);
  const base = valid.find((point) => point.year_mon.startsWith(year)) ?? valid[0];
  if (!base?.value) return null;
  return ((latest.value - base.value) / base.value) * 100;
}

function buildSeaMetrics(rows: KitaSeaRateRow[]): RouteMetric[] {
  return latestByRoute(rows)
    .map((row) => {
      const series = buildSeries(rows, row, (item) => item.feu ?? item.teu);
      const values = series
        .map((point) => point.value)
        .filter((value): value is number => value != null);
      const rate = metricValue(row);
      return {
        id: `sea-${routeKey(row)}`,
        mode: "해상" as const,
        origin: row.origin,
        dest: row.dest,
        region: row.region,
        rate,
        unit: row.feu != null ? "FEU" : "TEU",
        currency: "USD" as const,
        latestMonth: compactMonth(row.year_mon),
        mom: computeMoM(series),
        ytd: computeYtd(series),
        spark: values.slice(-8),
      };
    })
    .filter((row) => row.rate != null);
}

function buildAirMetrics(rows: KitaAirRateRow[]): RouteMetric[] {
  return latestByRoute(rows)
    .map((row) => {
      const series = buildSeries(rows, row, (item) => item.kg300 ?? item.kg100 ?? item.kg500);
      const values = series
        .map((point) => point.value)
        .filter((value): value is number => value != null);
      const rate = metricValue(row);
      return {
        id: `air-${routeKey(row)}`,
        mode: "항공" as const,
        origin: row.origin,
        dest: row.dest,
        region: row.region,
        rate,
        unit: row.kg300 != null ? "kg300" : row.kg100 != null ? "kg100" : "kg500",
        // kita_air_rates kg100/300/500은 USD/kg 원본 (KITA 발표 원본)
        currency: "USD" as const,
        latestMonth: compactMonth(row.year_mon),
        mom: computeMoM(series),
        ytd: computeYtd(series),
        spark: values.slice(-8),
      };
    })
    .filter((row) => row.rate != null);
}

function isFlagged(row: RouteMetric) {
  return row.mom != null && Math.abs(row.mom) >= FLAG_MOM_THRESHOLD;
}

function indexSeries(history: FreightIndexHistoryRow[], code: string) {
  return history
    .filter((row) => row.index_code === code && row.value != null)
    .sort((a, b) => a.week_date.localeCompare(b.week_date));
}

function formatSeaRate(row: RouteMetric) {
  return `$${fmtNumber(row.rate)}/${row.unit}`;
}

function RatesPage() {
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: bunker } = useSuspenseQuery(bunkerPricesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: exchangeRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());

  const [mode, setMode] = useState<ModeKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [origin, setOrigin] = useState("all");
  const [dest, setDest] = useState("all");
  const [query, setQuery] = useState("");

  const latestMonth = useMemo(
    () => latestMonthFrom([...seaRates, ...airRates]),
    [airRates, seaRates],
  );
  const scopedSea = useMemo(
    () => inPeriod(seaRates, latestMonth, period),
    [latestMonth, period, seaRates],
  );
  const scopedAir = useMemo(
    () => inPeriod(airRates, latestMonth, period),
    [airRates, latestMonth, period],
  );

  const seaMetrics = useMemo(() => buildSeaMetrics(scopedSea), [scopedSea]);
  const airMetrics = useMemo(() => buildAirMetrics(scopedAir), [scopedAir]);
  const allMetrics = useMemo(
    () => [...(mode !== "air" ? seaMetrics : []), ...(mode !== "sea" ? airMetrics : [])],
    [airMetrics, mode, seaMetrics],
  );

  const origins = useMemo(
    () => [...new Set(allMetrics.map((row) => row.origin))].sort((a, b) => a.localeCompare(b)),
    [allMetrics],
  );
  const dests = useMemo(
    () => [...new Set(allMetrics.map((row) => row.dest))].sort((a, b) => a.localeCompare(b)),
    [allMetrics],
  );

  const visibleMetrics = useMemo(
    () =>
      allMetrics
        .filter((row) => (origin === "all" ? true : row.origin === origin))
        .filter((row) => (dest === "all" ? true : row.dest === dest))
        .filter((row) => {
          const normalized = query.trim().toLowerCase();
          if (!normalized) return true;
          return [row.origin, row.dest, row.region ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalized);
        }),
    [allMetrics, dest, origin, query],
  );

  // Ocean/Air 단일 정렬 테이블 혼합 금지 — mode-group 분리, 그룹 내 MoM(USD 기준) 내림차순
  const seaVisible = useMemo(
    () =>
      visibleMetrics
        .filter((row) => row.mode === "해상")
        .sort((a, b) => (b.mom ?? -999) - (a.mom ?? -999)),
    [visibleMetrics],
  );
  const airVisible = useMemo(
    () =>
      visibleMetrics
        .filter((row) => row.mode === "항공")
        .sort((a, b) => (b.mom ?? -999) - (a.mom ?? -999)),
    [visibleMetrics],
  );

  const unflagged = visibleMetrics.filter((row) => !isFlagged(row));
  const risingCount = unflagged.filter((row) => (row.mom ?? 0) > 0).length;
  const fallingCount = unflagged.filter((row) => (row.mom ?? 0) < 0).length;
  const flatCount = unflagged.length - risingCount - fallingCount;
  const flaggedCount = visibleMetrics.length - unflagged.length;

  // 노선 운임 추이 비교 — 히트맵과 동일한 고정 노선(HEATMAP_ROUTES)
  const cmpData = useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string>>();
    for (const route of HEATMAP_ROUTES) {
      for (const item of scopedSea) {
        if (item.origin !== route.origin || item.dest !== route.dest) continue;
        const month = compactMonth(item.year_mon);
        const value = item.feu ?? item.teu;
        if (!month || value == null) continue;
        const point = byMonth.get(month) ?? { month };
        point[`${route.origin} → ${route.dest}`] = value;
        byMonth.set(month, point);
      }
    }
    return [...byMonth.values()]
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((point) => ({ ...point, month: fmtMonth(String(point.month)) }));
  }, [scopedSea]);

  // 전월대비 변동률 히트맵 — 고정 노선(HEATMAP_ROUTES), 최근 6개월 실측 MoM
  const heatmap = useMemo(() => {
    const monthSet = new Set<string>();
    for (const item of scopedSea) {
      const month = compactMonth(item.year_mon);
      if (month) monthSet.add(month);
    }
    const months = [...monthSet].sort().slice(-6);
    const rows = HEATMAP_ROUTES.map((route) => {
      const series = new Map<string, number>();
      for (const item of scopedSea) {
        if (item.origin !== route.origin || item.dest !== route.dest) continue;
        const month = compactMonth(item.year_mon);
        const value = item.feu ?? item.teu;
        if (month && value != null) series.set(month, value);
      }
      const sortedMonths = [...series.keys()].sort();
      const cells = months.map((month) => {
        const value = series.get(month);
        if (value == null) return null;
        const prevMonth = sortedMonths[sortedMonths.indexOf(month) - 1];
        const prev = prevMonth ? series.get(prevMonth) : undefined;
        if (prev == null || prev === 0) return null;
        return ((value - prev) / prev) * 100;
      });
      return { label: `${route.origin} → ${route.dest}`, cells };
    });
    return { months, rows };
  }, [scopedSea]);

  // 글로벌 지수 추이 — 최신 주 기준 최근 6개월, week_date로 정렬(연말 버킷 오류 방지)
  const trendData = useMemo(() => {
    const codes = ["SCFI", "KCCI", "BDI", "WCI"];
    const rows = history.filter((item) => codes.includes(item.index_code) && item.value != null);
    const latest = rows
      .map((row) => row.week_date)
      .sort()
      .at(-1);
    if (!latest) return [];
    const cutoff = new Date(latest);
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const byDate = new Map<string, Record<string, number | string>>();
    for (const row of rows) {
      if (row.week_date < cutoffIso) continue;
      const point = byDate.get(row.week_date) ?? {
        label: row.week_date.slice(5, 10),
        date: row.week_date,
      };
      point[row.index_code] = row.value ?? 0;
      byDate.set(row.week_date, point);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [history]);

  const ratesReports = recentRateReports(forecasts);
  const latestBunker = bunker.at(0);

  const fx = exchangeRate?.usd_krw ?? null;
  const fxDate = exchangeRate?.rate_date?.slice(0, 10) ?? null;

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <PageHero
        eyebrow="Rates Control Tower"
        titleMain="운임"
        titleAccent="Control Tower"
        subtitle="저장된 KITA 운임과 글로벌 지수를 기준으로 해상·항공 운임 동향을 한눈에 확인합니다."
        chips={[
          { label: "기준월", value: fmtMonth(latestMonth), color: "var(--color-cyan)" },
          {
            label: "조회 노선",
            value: `${visibleMetrics.length}개`,
            color: "var(--color-status-normal)",
          },
        ]}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1540px] flex-col gap-4 px-4 py-[26px] lg:px-12">
        <RouteBreadcrumb />
        <PCard pad="md">
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <FilterSeg
              label="운송 방식"
              options={MODE_KO}
              value={KO_BY_MODE[mode]}
              onChange={(v) => setMode(MODE_BY_KO[v])}
            />
            <FilterSeg
              label="기간"
              options={PERIOD_KO}
              value={KO_BY_PERIOD[period]}
              onChange={(v) => setPeriod(PERIOD_BY_KO[v])}
            />
            <FilterSelect label="출발지" value={origin} onChange={setOrigin} items={origins} />
            <FilterSelect label="도착지" value={dest} onChange={setDest} items={dests} />
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                기준월 {fmtMonth(latestMonth)} · {visibleMetrics.length}개 노선
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode("all");
                  setPeriod("6m");
                  setOrigin("all");
                  setDest("all");
                  setQuery("");
                }}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </PCard>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <CountKpi label="상승 노선" value={risingCount} color="var(--direction-up)" />
          <CountKpi label="하락 노선" value={fallingCount} color="var(--direction-down)" />
          <CountKpi label="보합 노선" value={flatCount} color="var(--direction-flat)" />
          <CountKpi label="이상치 플래그" value={flaggedCount} color="var(--status-caution)" />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Panel
            title="노선 운임 추이 비교"
            badge={<PBadge variant="secondary">해상 · $/FEU·TEU</PBadge>}
          >
            {cmpData.length < 2 ? (
              <Collecting note="비교 가능한 해상 노선 시계열이 2개월 이상 확보되면 표시됩니다." />
            ) : (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cmpData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
                    />
                    <Tooltip
                      formatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {HEATMAP_ROUTES.map((route, index) => (
                      <Line
                        key={`${route.origin}-${route.dest}`}
                        type="monotone"
                        dataKey={`${route.origin} → ${route.dest}`}
                        stroke={CMP_COLORS[index % CMP_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                    marginTop: 10,
                    fontSize: 11.5,
                    color: "var(--ink-muted)",
                  }}
                >
                  {HEATMAP_ROUTES.map((route, index) => (
                    <span
                      key={`${route.origin}-${route.dest}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 3,
                          borderRadius: 2,
                          background: CMP_COLORS[index % CMP_COLORS.length],
                        }}
                      />
                      {route.origin} → {route.dest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="전월대비 변동률 히트맵"
            badge={<PBadge variant="secondary">해상 · 최근 {heatmap.months.length}개월</PBadge>}
          >
            {heatmap.rows.length === 0 || heatmap.months.length < 2 ? (
              <Collecting note="월별 MoM 산출에 필요한 시계열이 확보되면 표시됩니다." />
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `120px repeat(${heatmap.months.length}, 1fr)`,
                    gap: 4,
                    fontSize: 11,
                  }}
                >
                  <span />
                  {heatmap.months.map((month) => (
                    <span
                      key={month}
                      style={{
                        textAlign: "center",
                        color: "var(--ink-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {fmtMonth(month)}
                    </span>
                  ))}
                  {heatmap.rows.map((row) => (
                    <HeatmapRow key={row.label} row={row} />
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-muted)" }}>
                  상승=녹 · 하락=적. 데이터 없는 달은 — 로 표시됩니다.
                </div>
              </>
            )}
          </Panel>
        </div>

        <Panel
          title="전체 운임 목록"
          badge={
            <PBadge variant="secondary">
              {KO_BY_MODE[mode]} · 최근 {KO_BY_PERIOD[period]} · 해상/항공 분리 표기
            </PBadge>
          }
          action={
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <Search size={13} color="var(--ink-muted)" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="노선·항만 검색"
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 12,
                  width: 150,
                  color: "var(--ink)",
                }}
              />
            </label>
          }
          bodyPad={0}
        >
          {mode !== "air" && (
            <RouteGroupTable
              title="해상 (Ocean)"
              note="USD/FEU·TEU"
              rows={seaVisible}
              air={false}
              fx={fx}
              fxDate={fxDate}
            />
          )}
          {mode !== "sea" && (
            <RouteGroupTable
              title="항공 (Air)"
              note={
                fx != null
                  ? `USD/kg 원본 · 적용환율 ${fmtNumber(fx, 2)} KRW/USD · 환율기준일 ${fxDate ?? "-"}`
                  : "USD/kg 원본 · 환율 데이터 수집 중"
              }
              rows={airVisible}
              air
              fx={fx}
              fxDate={fxDate}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderTop: "1px solid var(--border)",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
              ※ 비현실적 변동률(±{FLAG_MOM_THRESHOLD}% 이상)은 플래그 처리되어 상승·하락 집계에서
              분리됩니다. 해상과 항공은 단일 정렬로 혼합하지 않습니다.
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              해상 {seaVisible.length} · 항공 {airVisible.length}개 노선
            </span>
          </div>
        </Panel>

        <div className="grid items-start gap-4 xl:grid-cols-[1.16fr_1.5fr]">
          <Panel
            title="글로벌 지수 추이"
            badge={<PBadge variant="secondary">SCFI · KCCI · BDI · WCI</PBadge>}
          >
            {trendData.length < 2 ? (
              <Collecting />
            ) : (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {["SCFI", "KCCI", "BDI", "WCI"].map((code) => (
                      <Line
                        key={code}
                        type="monotone"
                        dataKey={code}
                        stroke={INDEX_COLORS[code]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
          <Panel title="최근 리포트" badge={<PBadge variant="outline">운임 전망</PBadge>}>
            <ReportCards reports={ratesReports} bunkerLabel={latestBunker?.grade ?? null} />
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-alt)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-muted)",
              }}
            >
              환율 기준 USD/KRW {fmtNumber(exchangeRate?.usd_krw, 2)} · {fxDate ?? "-"}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: string[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="all">전체</option>
        {items.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function CountKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <PCard pad="md">
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </PCard>
  );
}

function heatColor(value: number) {
  const intensity = Math.min(85, 22 + Math.abs(value) * 2.4);
  return value >= 0
    ? `color-mix(in oklch, var(--direction-up) ${intensity}%, var(--card))`
    : `color-mix(in oklch, var(--direction-down) ${intensity}%, var(--card))`;
}

function HeatmapRow({ row }: { row: { label: string; cells: (number | null)[] } }) {
  return (
    <>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          color: "var(--ink)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.label}
      >
        {row.label}
      </span>
      {row.cells.map((cell, index) => (
        <span
          key={index}
          title={cell == null ? "데이터 없음" : fmtPct(cell)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 32,
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            fontWeight: 600,
            color: cell != null && Math.abs(cell) >= 18 ? "#fff" : "var(--ink)",
            background: cell == null ? "var(--surface-alt)" : heatColor(cell),
          }}
        >
          {cell == null ? "—" : fmtPct(cell, 0)}
        </span>
      ))}
    </>
  );
}

function RouteGroupTable({
  title,
  note,
  rows,
  air,
  fx,
  fxDate,
}: {
  title: string;
  note: string;
  rows: RouteMetric[];
  air: boolean;
  fx: number | null;
  fxDate: string | null;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-alt)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
        <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>{note}</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: "var(--ink-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {rows.length}개 노선
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 18 }}>
          <Collecting note="조건에 맞는 노선이 없습니다." />
        </div>
      ) : (
        <div style={{ overflowX: "auto", maxHeight: 430, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thStyle()}>노선</th>
                <th style={thStyle("right")}>운임</th>
                <th style={thStyle("right")}>전월대비</th>
                <th style={thStyle("right")}>YTD</th>
                <th style={thStyle()}>최근 추이</th>
                <th style={thStyle()}>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const flagged = isFlagged(row);
                return (
                  <tr
                    key={row.id}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: flagged
                        ? "color-mix(in oklch, var(--status-caution) 6%, transparent)"
                        : "transparent",
                    }}
                  >
                    <td style={{ ...tdStyle(), fontWeight: 600 }}>
                      {row.origin} → {row.dest}
                      <div style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 500 }}>
                        {fmtMonth(row.latestMonth)}
                        {row.region ? ` · ${row.region}` : ""}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tdStyle("right"),
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {air ? (
                        <>
                          ${row.rate?.toFixed(2)}
                          <span
                            style={{ fontSize: 10, color: "var(--ink-muted)", fontWeight: 500 }}
                          >
                            /kg · {row.unit}
                          </span>
                          <div
                            style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 500 }}
                          >
                            {fx != null && row.rate != null
                              ? `₩${fmtNumber(row.rate * fx)}/kg (${fxDate ?? "-"})`
                              : "KRW 환산 수집 중"}
                          </div>
                        </>
                      ) : (
                        formatSeaRate(row)
                      )}
                    </td>
                    <td style={tdStyle("right")}>
                      <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                        <DeltaValue value={flagged ? null : row.mom} size={12} />
                      </span>
                    </td>
                    <td style={tdStyle("right")}>
                      <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                        <DeltaValue value={flagged ? null : row.ytd} size={12} />
                      </span>
                    </td>
                    <td style={{ ...tdStyle(), padding: "8px 16px" }}>
                      <TinySparkline values={row.spark} positive={(row.mom ?? 0) >= 0} />
                    </td>
                    <td style={tdStyle()}>
                      {flagged ? (
                        <PBadge variant="outline">이상치 · 검증 필요</PBadge>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color:
                              row.mom == null
                                ? "var(--direction-flat)"
                                : row.mom >= 0
                                  ? "var(--direction-up)"
                                  : "var(--direction-down)",
                          }}
                        >
                          {valueTone(row.mom)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TinySparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const data = values.map((value, index) => ({ index, value }));
  if (data.length < 2) return <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>-</span>;
  return (
    <div style={{ height: 28, width: 110 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 0, bottom: 3, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={positive ? "var(--direction-up)" : "var(--direction-down)"}
            strokeWidth={1.8}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReportCards({
  reports,
  bunkerLabel,
}: {
  reports: RateReport[];
  bunkerLabel: string | null;
}) {
  if (reports.length === 0) {
    return (
      <div>
        <EmptyState>발행된 운임 전망 리포트가 아직 없습니다.</EmptyState>
        {bunkerLabel ? (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--ink-muted)",
            }}
          >
            최신 유가 데이터: {bunkerLabel}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}

function ReportCard({ report }: { report: RateReport }) {
  const [open, setOpen] = useState(false);
  const hasOutlook = report.outlook.trim().length > 0;
  const chip = report.indexCode ? SERIES_LABEL[report.indexCode] : null;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => hasOutlook && setOpen((value) => !value)}
        aria-expanded={hasOutlook ? open : undefined}
        disabled={!hasOutlook}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          border: "none",
          background: "transparent",
          padding: "12px 14px",
          cursor: hasOutlook ? "pointer" : "default",
          font: "inherit",
          color: "inherit",
          touchAction: "manipulation",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={15} color="var(--ink-muted)" style={{ flex: "none" }} />
          <span
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {report.title}
          </span>
          {chip ? (
            <PBadge variant="secondary" style={{ flex: "none" }}>
              {chip}
            </PBadge>
          ) : null}
          <span
            style={{
              flex: "none",
              fontSize: 11.5,
              color: "var(--ink-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {report.date}
          </span>
          {hasOutlook ? (
            <ChevronDown
              size={16}
              color="var(--ink-muted)"
              style={{
                flex: "none",
                transition: "transform 0.18s ease",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          ) : null}
        </div>
        {report.lead ? (
          <p
            style={{
              margin: "6px 0 0 23px",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--ink-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {report.lead}
          </p>
        ) : null}
      </button>
      {open && hasOutlook ? (
        <div
          style={{
            padding: "0 14px 12px 37px",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--ink)",
          }}
        >
          {report.outlook}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: 120,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "1px dashed var(--border)",
        background: "var(--surface-alt)",
        padding: "0 16px",
        textAlign: "center",
        fontSize: 13,
        color: "var(--ink-muted)",
      }}
    >
      {children}
    </div>
  );
}
