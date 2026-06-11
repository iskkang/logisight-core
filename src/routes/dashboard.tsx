import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  DIR_META,
  FACTOR_LABEL,
  baseIndexCaption,
  dirCls,
  displayLabelOf,
  sentences,
} from "@/components/forecasts/forecastUtils";

import { alertCandidatesQueryOptions, type AlertCandidate } from "@/lib/api/alerts";
import {
  iataJetFuelQueryOptions,
  computeMoM,
  formatNumber,
  indexStatsQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  latestByRoute,
  type IataJetFuelRow,
  type IndexStats,
  type KitaAirRateRow,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { eurasiaDisruptionsActiveQueryOptions } from "@/lib/api/eurasia-disruptions";
import { eurasiaDelaysQueryOptions, type DelayWeeklyRow } from "@/lib/api/eurasia";
import { latestExchangeRateQueryOptions, type ExchangeRateRow } from "@/lib/api/exchange-rates";
import {
  dataUpdatesQueryOptions,
  forecastSeriesQueryOptions,
  publishedForecastsQueryOptions,
  riskNotesQueryOptions,
  type Forecast,
  type ForecastSeries,
} from "@/lib/api/forecasts";

import "./dashboard.css";

const JUDGMENT_TAB_CODES = ["KCCI", "WCI", "SCFI"] as const;
type JudgmentTabCode = (typeof JUDGMENT_TAB_CODES)[number];
type DashboardSearch = { judgment?: JudgmentTabCode };

function parseJudgmentMetric(value: unknown): JudgmentTabCode | undefined {
  return JUDGMENT_TAB_CODES.includes(value as JudgmentTabCode) ? (value as JudgmentTabCode) : undefined;
}

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    judgment: parseJudgmentMetric(s.judgment),
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(alertCandidatesQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions());
    context.queryClient.ensureQueryData(kitaAirRatesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(latestExchangeRateQueryOptions());
    context.queryClient.ensureQueryData(iataJetFuelQueryOptions());
    context.queryClient.ensureQueryData(publishedForecastsQueryOptions());
    context.queryClient.ensureQueryData(forecastSeriesQueryOptions());
    context.queryClient.ensureQueryData(riskNotesQueryOptions());
    context.queryClient.ensureQueryData(dataUpdatesQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "종합 Control Tower — Logisight" },
      {
        name: "description",
        content: "오늘의 핵심 변화, 주요 노선 현황, 운임 상승 현황, 정책·장애 요약.",
      },
    ],
  }),
  component: DashboardPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type KeyLane = {
  laneId: string;
  origin: string;
  dest: string;
  mode: "ocean" | "rail";
  metricType: "rate" | "delay";
  displayOrder: number;
};

type KeyLaneRow = {
  lane: KeyLane;
  value: string | null;
  mom: number | null;
  values: number[];
  asOf: string | null;
};

type AirLaneRow = {
  origin: string;
  dest: string;
  region: string | null;
  value: string | null;
  mom: number | null;
  values: number[];
  asOf: string | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const KEY_LANES: KeyLane[] = [
  { laneId: "PUS-LAX", origin: "부산", dest: "로스앤젤레스", mode: "ocean", metricType: "rate", displayOrder: 1 },
  { laneId: "PUS-NYC", origin: "부산", dest: "뉴욕", mode: "ocean", metricType: "rate", displayOrder: 2 },
  { laneId: "PUS-CHI", origin: "부산", dest: "시카고", mode: "ocean", metricType: "rate", displayOrder: 3 },
  { laneId: "KR-ANDIJAN", origin: "한국", dest: "안디잔", mode: "rail", metricType: "delay", displayOrder: 4 },
  { laneId: "CN-ALMATY", origin: "중국", dest: "알마티", mode: "rail", metricType: "delay", displayOrder: 5 },
];

const AIR_PRIORITY_DESTS = ["로스", "시카고", "하노이"];
const INDEX_ORDER = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"];

const SEV_TONE_CLASS: Record<AlertCandidate["severity"], string> = {
  high: "ld-tone-red",
  medium: "ld-tone-amber",
  low: "ld-tone-blue",
  info: "ld-tone-gray",
};

const SEV_LABEL: Record<AlertCandidate["severity"], string> = {
  high: "경고",
  medium: "주의",
  low: "낮음",
  info: "정보",
};

// ── Utility functions ─────────────────────────────────────────────────────────

function pctText(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function trendCls(v: number | null | undefined): string {
  if (v == null || v === 0) return "ld-trend--flat";
  return v > 0 ? "ld-trend--up" : "ld-trend--down";
}

function trendSym(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return v > 0 ? "▲" : "▼";
}

function yyyymmLabel(ym: string | null | undefined): string {
  if (!ym || ym.length < 6) return "—";
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

function kstDateString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return [
    kst.getUTCFullYear(),
    String(kst.getUTCMonth() + 1).padStart(2, "0"),
    String(kst.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function latestDataUpdate(dataUpdates: { updated_at: string | null }[]): string | null {
  return dataUpdates.map((u) => u.updated_at).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
}

function statByCode(stats: IndexStats[], code: string): IndexStats | undefined {
  return stats.find((s) => s.index_code === code);
}

function orderedStats(stats: IndexStats[]): IndexStats[] {
  const rank = new Map(INDEX_ORDER.map((code, i) => [code, i]));
  return [...stats]
    .filter((s) => s.latest_value != null)
    .sort((a, b) => (rank.get(a.index_code) ?? 99) - (rank.get(b.index_code) ?? 99));
}

function sourceList(stats: IndexStats[], dataUpdates: { dataset: string; updated_at: string | null }[]): string {
  const fromUpdates = dataUpdates.map((u) => u.dataset).filter(Boolean);
  if (fromUpdates.length > 0) return fromUpdates.slice(0, 4).join(" · ");
  const fromStats = [...new Set(stats.map((s) => s.source).filter((s): s is string => Boolean(s)))];
  if (fromStats.length > 0) return fromStats.slice(0, 4).join(" · ");
  return "데이터 수집 중";
}

// ── Data builders ─────────────────────────────────────────────────────────────

function buildLaneRows(seaRates: KitaSeaRateRow[], delays: DelayWeeklyRow[]): KeyLaneRow[] {
  const latestSea = latestByRoute(seaRates);
  const fixedRows = [...KEY_LANES]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((lane) => {
      if (lane.metricType === "rate") {
        const row = latestSea.find((r) => r.origin === lane.origin && r.dest === lane.dest);
        const series = seaRates
          .filter((x) => x.origin === lane.origin && x.dest === lane.dest)
          .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
        const values = series.map((x) => x.feu).filter((v): v is number => v != null);
        if (!row || row.feu == null) {
          return { lane, value: null, mom: null, values, asOf: row?.year_mon ?? null };
        }
        const mom = computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x.feu })));
        return {
          lane,
          value: `$${row.feu.toLocaleString("en-US")}/FEU`,
          mom,
          values,
          asOf: row.year_mon,
        };
      }
      const laneDelays = delays
        .filter((d) => d.lane_id === lane.laneId)
        .sort((a, b) => a.week_iso.localeCompare(b.week_iso));
      const latest = laneDelays.at(-1);
      const values = laneDelays.map((d) => d.median_delay_d).filter((v): v is number => v != null);
      return {
        lane,
        value: latest?.median_delay_d != null ? `지연 ${latest.median_delay_d.toFixed(1)}일` : null,
        mom: null,
        values,
        asOf: latest?.week_iso ?? null,
      };
    });

  const visibleRows = fixedRows.filter((row) => row.value != null);
  const usedSeaKeys = new Set(
    visibleRows
      .filter((row) => row.lane.metricType === "rate")
      .map((row) => `${row.lane.origin}__${row.lane.dest}`),
  );
  const supplemental = latestSea
    .flatMap((row) => {
      if (row.feu == null || usedSeaKeys.has(`${row.origin}__${row.dest}`)) return [];
      const series = seaRates
        .filter((x) => x.origin === row.origin && x.dest === row.dest)
        .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
      const values = series.map((x) => x.feu).filter((v): v is number => v != null);
      const mom = computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x.feu })));
      return [{ row, values, mom }];
    })
    .sort((a, b) => (b.mom ?? -Infinity) - (a.mom ?? -Infinity) || (b.row.feu ?? 0) - (a.row.feu ?? 0));

  for (const candidate of supplemental) {
    if (visibleRows.length >= 6) break;
    const key = `${candidate.row.origin}__${candidate.row.dest}`;
    if (usedSeaKeys.has(key)) continue;
    usedSeaKeys.add(key);
    visibleRows.push({
      lane: {
        laneId: `KITA-${candidate.row.origin}-${candidate.row.dest}`,
        origin: candidate.row.origin,
        dest: candidate.row.dest,
        mode: "ocean",
        metricType: "rate",
        displayOrder: visibleRows.length + 1,
      },
      value: `$${candidate.row.feu!.toLocaleString("en-US")}/FEU`,
      mom: candidate.mom,
      values: candidate.values,
      asOf: candidate.row.year_mon,
    });
  }
  return visibleRows;
}

function buildAirLaneRows(airRates: KitaAirRateRow[]): AirLaneRow[] {
  const incheon = airRates.filter(
    (r) => r.origin.includes("인천") || r.origin.toUpperCase().includes("ICN"),
  );
  const latest = latestByRoute(incheon);

  function toRow(row: KitaAirRateRow): AirLaneRow {
    const tier = row.kg300 != null ? "kg300" : row.kg100 != null ? "kg100" : "kg500";
    const series = incheon
      .filter((x) => x.origin === row.origin && x.dest === row.dest)
      .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
    const values = series.map((x) => x[tier]).filter((v): v is number => v != null);
    const rateVal = row[tier];
    return {
      origin: row.origin,
      dest: row.dest,
      region: row.region,
      value: rateVal != null ? `₩${rateVal.toLocaleString("ko-KR")}/kg` : null,
      mom: computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x[tier] ?? null }))),
      values,
      asOf: row.year_mon,
    };
  }

  const rows: AirLaneRow[] = [];
  for (const keyword of AIR_PRIORITY_DESTS) {
    const match = latest.find((r) => r.dest.includes(keyword));
    if (match) rows.push(toRow(match));
  }
  return rows.filter((r) => r.value != null);
}

// ── Inline SVG sparkline ──────────────────────────────────────────────────────

function LdSparkline({ points, trend }: { points: number[]; trend?: "up" | "down" | "flat" }) {
  if (points.length < 2) return null;
  const W = 120;
  const H = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p - min) / range) * (H - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const cls = trend === "down" ? "ld-sparkline ld-sparkline--down" : trend === "flat" ? "ld-sparkline ld-sparkline--flat" : "ld-sparkline";
  return (
    <svg className={cls} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Ticker bar ────────────────────────────────────────────────────────────────

function LdTickerBar({
  items,
  asOf,
}: {
  items: { code: string; value: string; changePct: number | null }[];
  asOf: string;
}) {
  return (
    <div className="ld-ticker-row">
      <div className="ld-ticker-track ld-shell">
        {items.map((item) => (
          <div className="ld-ticker-item" key={item.code}>
            <span className="ld-ticker-label">{item.code}</span>
            <strong>{item.value}</strong>
            <span className={`ld-trend ${trendCls(item.changePct)}`}>
              {trendSym(item.changePct)} {pctText(item.changePct)}
            </span>
          </div>
        ))}
        <div className="ld-ticker-date">기준일 {asOf} (KST)</div>
      </div>
    </div>
  );
}

// ── Hero AI summary builder ───────────────────────────────────────────────────

function buildHeroSummary(
  kcciStat: IndexStats | undefined,
  stats: IndexStats[],
  alertCount: number,
  disruptions: number,
  openForecasts: Forecast[],
): string {
  const parts: string[] = [];
  if (kcciStat?.latest_value != null) {
    const val = kcciStat.latest_value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    const chg = kcciStat.change_pct;
    const dir = chg == null ? "" : Math.abs(chg) < 0.5 ? "보합" : chg > 0 ? "상승" : "하락";
    parts.push(
      `한국발 해상 운임 지수(KCCI) ${val}pt — 전주 대비 ${chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(1) + "%" : "—"} ${dir} 추세.`,
    );
  }
  const scfi = stats.find((s) => s.index_code === "SCFI");
  if (scfi?.change_pct != null) {
    const chg = scfi.change_pct;
    parts.push(`글로벌 컨테이너 운임(SCFI) ${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% 정합.`);
  }
  if (disruptions > 0) {
    parts.push(`유라시아 회랑 ${disruptions}건 활성 장애 — 리드타임 영향 추정.`);
  }
  const fc = openForecasts[0];
  if (fc?.direction) {
    const dir = ({ up: "상승", down: "하락", flat: "보합" } as Record<string, string>)[fc.direction] ?? "";
    parts.push(`AI 전망(에디터 검수): ${fc.metric_ref ?? "운임"} ${dir} 기조 시사.`);
  }
  if (alertCount > 0) {
    parts.push(`경보 ${alertCount}건 점검 권장.`);
  }
  return parts.join(" ") || "주요 노선 현황과 운임 지수를 확인하세요.";
}

// ── Hero section ──────────────────────────────────────────────────────────────

function LdHeroSection({
  today,
  highAlerts,
  medAlerts,
  kcciStat,
  disruptions,
  aiSummary,
}: {
  today: string;
  highAlerts: number;
  medAlerts: number;
  kcciStat: IndexStats | undefined;
  disruptions: number;
  aiSummary: string;
}) {
  const pressureUp = (kcciStat?.change_pct ?? 0) > 0;
  const alertCount = highAlerts + medAlerts;

  return (
    <section className="ld-hero-card ld-shell">
      <div className="ld-hero-content">
        <h1>오늘의 물류 브리핑</h1>
        <p>{aiSummary}</p>
        <div className="ld-hero-pills">
          <span className={`ld-pill ${pressureUp ? "ld-pill--red" : "ld-pill--green"}`}>
            {pressureUp ? "↗ 운임 압력 상승" : "↘ 운임 안정"}
          </span>
          {disruptions > 0 && (
            <span className="ld-pill ld-pill--amber">⚠ 유라시아 리스크 {disruptions}건</span>
          )}
          {alertCount > 0 && (
            <span className="ld-pill ld-pill--blue">▣ 경보 {alertCount}건</span>
          )}
          <span className="ld-pill ld-pill--slate">◷ 기준일 {today}</span>
        </div>
      </div>
    </section>
  );
}

// ── KPI Grid ──────────────────────────────────────────────────────────────────

function LdKpiCard({
  icon,
  title,
  value,
  sub,
  change,
  trend,
  tone,
  spark,
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  change?: string;
  trend?: "up" | "down" | "flat";
  tone: "blue" | "green" | "red" | "amber" | "gray";
  spark?: number[];
}) {
  return (
    <article className="ld-kpi-card ld-panel-card">
      <div className={`ld-kpi-icon ld-tone-${tone}`}>{icon}</div>
      <div className="ld-kpi-copy">
        <div className="ld-card-eyebrow">{title}</div>
        <div className="ld-kpi-value-row">
          <strong>{value}</strong>
          {change && (
            <span className={`ld-trend ${trend ? `ld-trend--${trend}` : ""}`}>
              {trend === "up" ? "▲" : trend === "down" ? "▼" : ""} {change}
            </span>
          )}
        </div>
        <p>{sub}</p>
      </div>
      {spark && spark.length > 1 && (
        <LdSparkline points={spark.slice(-9)} trend={trend} />
      )}
    </article>
  );
}

// ── Intelligence Panel ────────────────────────────────────────────────────────

function LdIntelligencePanel({
  forecasts,
  seriesMap,
  stats,
  selectedMetric,
}: {
  forecasts: Forecast[];
  seriesMap: Record<string, ForecastSeries>;
  stats: IndexStats[];
  selectedMetric?: JudgmentTabCode;
}) {
  const forecastByMetric = useMemo(() => {
    const rows = new Map<JudgmentTabCode, Forecast>();
    for (const f of forecasts.filter((f) => f.status === "published")) {
      const metric = f.metric_ref as JudgmentTabCode | null;
      if (metric && JUDGMENT_TAB_CODES.includes(metric) && !rows.has(metric)) {
        rows.set(metric, f);
      }
    }
    return rows;
  }, [forecasts]);

  const fallbackMetric = JUDGMENT_TAB_CODES.find((code) => forecastByMetric.has(code));
  const activeMetric =
    selectedMetric && forecastByMetric.has(selectedMetric) ? selectedMetric : fallbackMetric;
  const forecast = activeMetric ? forecastByMetric.get(activeMetric) ?? null : null;
  const series = forecast ? seriesMap[forecast.id] : undefined;

  const direction = forecast?.direction ? DIR_META[forecast.direction] : null;
  const directionClasses = dirCls(forecast?.direction);
  const lead = sentences(forecast?.statement ?? "")[0] ?? forecast?.statement ?? "";
  const lastSentence = sentences(forecast?.statement ?? "").at(-1) ?? "";
  const invalidation = forecast?.invalidation_condition ?? "";

  // Chart data from forecast series points
  const chartData = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points.map((p) => ({
      date: p.date ? p.date.slice(5, 10) : "",
      value: p.value,
      full: p.date,
    }));
  }, [series]);

  // Contribution factors
  const factorRows = (forecast?.factor_scores ?? []).filter(
    (f) => !f.missing && f.score != null,
  );
  const maxAbsScore = Math.max(...factorRows.map((f) => Math.abs(f.score as number)), 1);

  // Current metric stat for display
  const metricStat = activeMetric ? statByCode(stats, activeMetric) : undefined;

  return (
    <section className="ld-intelligence-card ld-panel-card">
      {/* Title row */}
      <div className="ld-section-title-row">
        <div>
          <h2>운임 종합 판단</h2>
          <span className="ld-badge ld-badge--blue">AI 인사이트 · 에디터 검수</span>
        </div>
        {direction && (
          <span className={`ld-badge ${directionClasses.badge}`}>
            {direction.glyph} {direction.label}
          </span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="ld-tabs" role="tablist" aria-label="운임 지수 선택">
        {JUDGMENT_TAB_CODES.map((code) => {
          const hasForecast = forecastByMetric.has(code);
          const active = code === activeMetric;
          const cls = [
            active ? "ld-tab-active" : "",
            !hasForecast ? "ld-tab-disabled" : "",
          ]
            .filter(Boolean)
            .join(" ");
          if (!hasForecast) {
            return (
              <a key={code} className={cls} role="tab" aria-selected={false} aria-disabled="true">
                {code}
              </a>
            );
          }
          return (
            <Link
              key={code}
              to="/dashboard"
              search={{ judgment: code }}
              role="tab"
              aria-selected={active}
              className={cls}
            >
              {code}
            </Link>
          );
        })}
      </div>

      {/* Chart + Contribution factors */}
      <div className="ld-intelligence-grid">
        <div className="ld-chart-wrap">
          <div className="ld-chart-header">
            <h3>
              {activeMetric ?? "지수"} 추이
              {baseIndexCaption(forecast as Forecast) ? (
                <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  ({baseIndexCaption(forecast as Forecast)})
                </span>
              ) : null}
            </h3>
            <span>
              {metricStat?.latest_value != null
                ? formatNumber(metricStat.latest_value, 0)
                : "—"}
            </span>
          </div>
          <div className="ld-chart-inner">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ldChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d6fb5" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#1d6fb5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    width={42}
                    tickFormatter={(v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10, 30, 54, 0.96)",
                      border: "1px solid rgba(116, 177, 255, 0.28)",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#f4f8ff",
                    }}
                    formatter={(v: number) => [v.toLocaleString("en-US", { maximumFractionDigits: 1 }), activeMetric]}
                    labelFormatter={(l: string) => `기준일 ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1d6fb5"
                    strokeWidth={2.5}
                    fill="url(#ldChartGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#93c5fd", stroke: "#1e3a5f", strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: "grid", placeItems: "center", color: "#6f849d", fontSize: 12 }}>
                {forecast ? "전망 데이터 수집 중" : "발행된 전망이 없습니다"}
              </div>
            )}
          </div>
        </div>

        {/* Contribution factors */}
        <div className="ld-contribution-card">
          <h3>상승 요인 기여도</h3>
          {factorRows.length > 0 ? (
            <>
              {factorRows.slice(0, 5).map((factor) => {
                const score = factor.score as number;
                const width = Math.round((Math.abs(score) / maxAbsScore) * 86);
                return (
                  <div className="ld-contribution-row" key={factor.factor}>
                    <span>{FACTOR_LABEL[factor.factor] ?? factor.factor}</span>
                    <div className="ld-bar-track">
                      <i style={{ width: `${width}%` }} />
                    </div>
                    <strong>{score > 0 ? "+" : ""}{score}</strong>
                  </div>
                );
              })}
              <div className="ld-contribution-total">
                <span>합계</span>
                <strong>
                  {factorRows.reduce((s, f) => s + (f.score as number), 0) > 0 ? "+" : ""}
                  {factorRows.reduce((s, f) => s + (f.score as number), 0).toFixed(1)}
                </strong>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 16, color: "#6f849d", fontSize: 12 }}>
              팩터 점수 수집 중
            </div>
          )}
        </div>
      </div>

      {/* AI summary */}
      <div className="ld-ai-summary">
        <div className="ld-ai-icon">AI</div>
        <div>
          <strong>AI 요약 · 에디터 검수</strong>
          <p>{lead || "전망 본문 수집 중입니다. 에디터 검수 후 공개됩니다."}</p>
        </div>
      </div>

      {/* Scenarios */}
      <div className="ld-scenario-grid">
        <article className="ld-scenario ld-scenario--red">
          <h3>상방 조건</h3>
          <p>
            {forecast?.direction === "up" ? lastSentence : invalidation || "수요 강세 지속 + 공급 제약 심화"}
          </p>
          {forecast?.range_high_pct != null && (
            <strong>전망 범위 상단 +{forecast.range_high_pct}%</strong>
          )}
        </article>
        <article className="ld-scenario ld-scenario--blue">
          <h3>기준 시나리오</h3>
          <p>{lead || "수요 완만 + 공급 제한적 완화"}</p>
          {forecast?.expected_range_pct && (
            <strong>전망 {forecast.expected_range_pct}%</strong>
          )}
        </article>
        <article className="ld-scenario ld-scenario--green">
          <h3>하방 조건</h3>
          <p>
            {forecast?.direction === "down" ? lastSentence : invalidation || "수요 둔화 + 공급 회복 가속"}
          </p>
          {forecast?.range_low_pct != null && (
            <strong>전망 범위 하단 {forecast.range_low_pct}%</strong>
          )}
        </article>
      </div>
    </section>
  );
}

// ── Action Queue sidebar ──────────────────────────────────────────────────────

function LdActionQueue({ alerts }: { alerts: AlertCandidate[] }) {
  const items = alerts.slice(0, 4);
  return (
    <section className="ld-panel-card ld-side-card">
      <div className="ld-side-title-row">
        <h2>Action Queue</h2>
        <Link to="/rates">
          <button type="button">전체 보기</button>
        </Link>
      </div>
      {items.length === 0 ? (
        <p style={{ marginTop: 14, color: "#6f849d", fontSize: 12 }}>현재 활성 경보 없음</p>
      ) : (
        <div className="ld-action-list">
          {items.map((alert, i) => (
            <div className="ld-action-item" key={alert.title}>
              <div className="ld-rank">{i + 1}</div>
              <div className="ld-action-copy">
                <strong>{alert.title}</strong>
                <span>{alert.sub}</span>
              </div>
              <span className={`ld-mini-badge ${SEV_TONE_CLASS[alert.severity]}`}>
                {SEV_LABEL[alert.severity]}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Index Snapshot sidebar ────────────────────────────────────────────────────

function LdIndexSnapshot({ stats, asOf }: { stats: IndexStats[]; asOf: string }) {
  const rows = orderedStats(stats).slice(0, 6);
  return (
    <section className="ld-panel-card ld-side-card">
      <div className="ld-side-title-row">
        <h2>글로벌 지수 스냅샷</h2>
        <Link to="/rates">
          <button type="button">전체 보기</button>
        </Link>
      </div>
      <div className="ld-snapshot-grid">
        {rows.map((row) => (
          <div className="ld-snapshot-item" key={row.index_code}>
            <span>{row.index_code}</span>
            <strong>
              {formatNumber(
                row.latest_value,
                row.index_code === "SCFI" || row.index_code === "CCFI" ? 2 : 0,
              )}
            </strong>
            <em className={trendCls(row.change_pct)}>
              {trendSym(row.change_pct)} {pctText(row.change_pct)}
            </em>
          </div>
        ))}
        {rows.length === 0 && (
          <p style={{ gridColumn: "1/-1", color: "#6f849d", fontSize: 12 }}>지수 수집 중</p>
        )}
      </div>
      <p className="ld-card-footnote">WoW · 기준 {asOf}</p>
    </section>
  );
}

// ── Eurasia Risk sidebar ──────────────────────────────────────────────────────

function LdEurasiaRisk({
  disruptions,
}: {
  disruptions: {
    id: string;
    title: string;
    severity: "high" | "medium" | "low";
    delay_contribution_days: number | null;
    segment: string;
  }[];
}) {
  const items = disruptions.slice(0, 4);
  return (
    <section className="ld-panel-card ld-side-card">
      <div className="ld-side-title-row">
        <h2>유라시아 리스크</h2>
        <Link to="/eurasia">
          <button type="button">전체 보기</button>
        </Link>
      </div>
      {items.length === 0 ? (
        <p style={{ marginTop: 14, color: "#6f849d", fontSize: 12 }}>특정 장애 없음 · 정상</p>
      ) : (
        <div className="ld-risk-list">
          {items.map((d) => (
            <div className="ld-risk-row" key={d.id}>
              <span>
                {d.title}
                {d.delay_contribution_days != null ? ` (${d.delay_contribution_days}일)` : ""}
              </span>
              <strong
                className={`ld-mini-badge ${
                  d.severity === "high"
                    ? "ld-tone-red"
                    : d.severity === "medium"
                      ? "ld-tone-amber"
                      : "ld-tone-blue"
                }`}
              >
                {d.severity === "high" ? "경고" : d.severity === "medium" ? "주의" : "낮음"}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Sea / Air Route Monitor ───────────────────────────────────────────────────

function LdRouteCard({
  icon,
  routeLabel,
  price,
  unit,
  mom,
  asOf,
  values,
}: {
  icon: string;
  routeLabel: string;
  price: string;
  unit: string;
  mom: number | null;
  asOf: string | null;
  values: number[];
}) {
  const spark = values.slice(-8);
  const momTrend: "up" | "down" | "flat" =
    mom == null || mom === 0 ? "flat" : mom > 0 ? "up" : "down";

  return (
    <article className="ld-route-card">
      <div className="ld-route-name">
        <span>{icon}</span>
        {routeLabel}
      </div>
      <div className="ld-route-price">
        <strong>{price}</strong>
        <em>{unit}</em>
      </div>
      <div className="ld-route-meta">
        <span className={`ld-trend ld-trend--${momTrend}`}>
          {trendSym(mom)} {pctText(mom)}
        </span>
        <span>{asOf ? yyyymmLabel(asOf) : "—"}</span>
      </div>
      {spark.length > 1 && <LdSparkline points={spark} trend={momTrend} />}
    </article>
  );
}

function LdSeaRouteMonitor({ laneRows }: { laneRows: KeyLaneRow[] }) {
  const seaRows = laneRows.filter((r) => r.lane.mode === "ocean" && r.value != null);
  const gridCls = seaRows.length >= 4 ? "ld-route-grid ld-route-grid--4" : "ld-route-grid";
  return (
    <section className="ld-panel-card ld-route-section">
      <div className="ld-side-title-row">
        <h2>해상 노선 모니터</h2>
        <Link to="/rates">
          <button type="button">더보기</button>
        </Link>
      </div>
      {seaRows.length === 0 ? (
        <p style={{ marginTop: 14, color: "#6f849d", fontSize: 12 }}>데이터 수집 중</p>
      ) : (
        <div className={gridCls}>
          {seaRows.map((row) => (
            <LdRouteCard
              key={row.lane.laneId}
              icon="▣"
              routeLabel={`${row.lane.origin} → ${row.lane.dest}`}
              price={row.value ?? "—"}
              unit=""
              mom={row.mom}
              asOf={row.asOf}
              values={row.values}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LdAirRouteMonitor({ airRows }: { airRows: AirLaneRow[] }) {
  return (
    <section className="ld-panel-card ld-route-section">
      <div className="ld-side-title-row">
        <h2>항공 노선 모니터</h2>
        <Link to="/rates">
          <button type="button">더보기</button>
        </Link>
      </div>
      {airRows.length === 0 ? (
        <p style={{ marginTop: 14, color: "#6f849d", fontSize: 12 }}>데이터 수집 중</p>
      ) : (
        <div className="ld-route-grid">
          {airRows.map((row) => (
            <LdRouteCard
              key={`${row.origin}-${row.dest}`}
              icon="✈"
              routeLabel={`${row.origin} → ${row.dest}`}
              price={row.value ?? "—"}
              unit=""
              mom={row.mom}
              asOf={row.asOf}
              values={row.values}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Bottom utility cards ──────────────────────────────────────────────────────

function LdDataBasisCard({
  asOf,
  dataUpdates,
  stats,
  seaRates,
  exRateDate,
}: {
  asOf: string;
  dataUpdates: { dataset: string; updated_at: string | null }[];
  stats: IndexStats[];
  seaRates: KitaSeaRateRow[];
  exRateDate: string | null | undefined;
}) {
  const latestUpdate = latestDataUpdate(dataUpdates);
  const availableIndexes = stats.filter((s) => s.latest_value != null).length;
  const latestSeaMonth = seaRates.map((r) => r.year_mon).sort().at(-1) ?? null;
  const rows = [
    ["기준일", asOf],
    ["데이터 갱신", latestUpdate ? `${latestUpdate.slice(0, 16).replace("T", " ")} KST` : "수집 이력 확인 중"],
    ["수집 소스", sourceList(stats, dataUpdates)],
    ["지수 커버리지", `${availableIndexes}/${stats.length || 0}개`],
    ["KITA 해상", yyyymmLabel(latestSeaMonth)],
    ["환율 기준", exRateDate ?? "수집 중"],
  ];
  return (
    <section className="ld-panel-card ld-utility-card">
      <h2>데이터 기준</h2>
      <div className="ld-utility-list">
        {rows.map(([label, value]) => (
          <div className="ld-utility-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function LdFxCard({ exRate }: { exRate: ExchangeRateRow | null }) {
  const rows = exRate
    ? [
        { label: "USD / KRW", value: exRate.usd_krw },
        { label: "EUR / KRW", value: exRate.eur_krw },
        { label: "CNY / KRW", value: exRate.cny_krw },
        { label: "JPY(100) / KRW", value: exRate.jpy_krw },
        { label: "RUB / KRW", value: exRate.rub_krw },
      ]
    : [];
  return (
    <section className="ld-panel-card ld-utility-card">
      <h2>환율 정보</h2>
      {rows.length === 0 ? (
        <p style={{ marginTop: 14, color: "#6f849d", fontSize: 12 }}>데이터 수집 중</p>
      ) : (
        <div className="ld-utility-list">
          {rows.map(({ label, value }) => (
            <div className="ld-utility-row" key={label}>
              <span>{label}</span>
              <strong>
                {value != null
                  ? `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`
                  : "—"}
              </strong>
            </div>
          ))}
          {exRate?.rate_date && (
            <p className="ld-card-footnote" style={{ marginTop: 4 }}>
              하나은행 · {exRate.rate_date.slice(0, 10)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function LdOilCard({ jetFuel }: { jetFuel: IataJetFuelRow[] }) {
  const latest = jetFuel.at(-1);
  const chartData = jetFuel
    .filter((r) => r.price_usd_bbl != null)
    .map((r) => ({ date: r.as_of.slice(5, 10), price: r.price_usd_bbl as number }));
  const wow = latest?.fuel_wow_pct ?? null;
  const wowUp = wow !== null && wow >= 0;

  return (
    <section className="ld-panel-card ld-utility-card">
      <h2>항공유 가격</h2>
      {chartData.length === 0 ? (
        <p style={{ marginTop: 14, color: "#6f849d", fontSize: 12 }}>데이터 수집 중</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em" }}>
              ${latest?.price_usd_bbl?.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginLeft: 4 }}>/bbl</span>
            </span>
            {wow !== null && (
              <span style={{ fontSize: 12, fontWeight: 900, color: wowUp ? "#059669" : "#dc2626" }}>
                {wowUp ? "+" : ""}{wow.toFixed(1)}% WoW
              </span>
            )}
          </div>
          <div style={{ height: 60, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ldOilGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis domain={["auto", "auto"]} hide />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 34, 56, 0.96)",
                    border: "1px solid rgba(85, 166, 255, 0.28)",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#f0f7ff",
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}/bbl`, "Jet Fuel"]}
                  labelFormatter={(l: string) => `기준일 ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#d97706"
                  strokeWidth={2}
                  fill="url(#ldOilGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="ld-card-footnote" style={{ marginTop: 4 }}>
            IATA/Platts · 기준 {latest?.as_of?.slice(0, 10)}
          </p>
        </>
      )}
    </section>
  );
}

function LdUpdateCard({ latestUpdate }: { latestUpdate: string | null }) {
  const label = latestUpdate
    ? latestUpdate.slice(0, 16).replace("T", " ") + " KST"
    : "수집 이력 확인 중";
  return (
    <section className="ld-panel-card ld-utility-card">
      <h2>업데이트</h2>
      <div className="ld-update-content">
        <span className="ld-update-icon">◷</span>
        <p>
          최신 데이터로 업데이트되었습니다.
          <br />
          마지막 수집: {label}
        </p>
      </div>
    </section>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────

function DashboardPage() {
  const search = Route.useSearch();
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: exRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: jetFuelHistory } = useSuspenseQuery(iataJetFuelQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const { data: dataUpdates } = useSuspenseQuery(dataUpdatesQueryOptions());

  const today = kstDateString();
  const orderedIndexRows = orderedStats(stats);
  const kcciStat = statByCode(stats, "KCCI");
  const asOf =
    kcciStat?.latest_date?.slice(0, 10) ??
    orderedIndexRows[0]?.latest_date?.slice(0, 10) ??
    "수집 중";
  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  const medAlerts = alerts.filter((a) => a.severity === "medium").length;
  const openForecasts = forecasts.filter((f) => f.status === "published");
  const laneRows = useMemo(() => buildLaneRows(seaRates, delays), [seaRates, delays]);
  const airLaneRows = useMemo(() => buildAirLaneRows(airRates), [airRates]);
  const latestUpdate = latestDataUpdate(dataUpdates);
  const alertCount = highAlerts + medAlerts;
  const heroSummary = useMemo(
    () => buildHeroSummary(kcciStat, stats, alertCount, disruptions.length, openForecasts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kcciStat, stats, alertCount, disruptions.length, openForecasts.length],
  );

  // Ticker items
  const tickerItems = orderedIndexRows.map((s) => ({
    code: s.index_code,
    value: s.latest_value!.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    changePct: s.change_pct,
  }));

  // KPI values
  const kcciChange = kcciStat?.change_pct;
  const kcciTrend: "up" | "down" | "flat" =
    kcciChange == null || kcciChange === 0 ? "flat" : kcciChange > 0 ? "up" : "down";
  const kcciSeries = orderedIndexRows.find((s) => s.index_code === "KCCI");
  const firstAirRow = airLaneRows[0];

  return (
    <div className="ld-dash">
      {/* Ticker */}
      <LdTickerBar items={tickerItems} asOf={asOf} />

      {/* Hero */}
      <LdHeroSection
        today={today}
        highAlerts={highAlerts}
        medAlerts={medAlerts}
        kcciStat={kcciStat}
        disruptions={disruptions.length}
        aiSummary={heroSummary}
      />

      {/* KPI Grid — 4 cards */}
      <section className="ld-kpi-grid ld-shell">
        <LdKpiCard
          icon="↗"
          title="운임 압력"
          value={kcciTrend === "up" ? "상승" : kcciTrend === "down" ? "하락" : "보합"}
          sub={kcciChange != null ? `KCCI WoW ${pctText(kcciChange)}` : "KCCI 수집 중"}
          tone={kcciTrend === "up" ? "red" : kcciTrend === "down" ? "green" : "gray"}
          trend={kcciTrend}
        />
        <LdKpiCard
          icon="K"
          title="한국발 해상 (KCCI)"
          value={
            kcciStat?.latest_value != null
              ? kcciStat.latest_value.toLocaleString("en-US", { maximumFractionDigits: 0 })
              : "수집 중"
          }
          sub={kcciStat?.latest_date ? `기준 ${kcciStat.latest_date.slice(0, 10)}` : "데이터 수집 중"}
          change={kcciChange != null ? pctText(kcciChange) : undefined}
          trend={kcciTrend}
          tone="blue"
          spark={kcciSeries?.normal_range != null ? [
            kcciSeries.normal_range[0],
            kcciSeries.latest_value ?? kcciSeries.normal_range[1],
          ] : undefined}
        />
        <LdKpiCard
          icon="✈"
          title="항공 운임 (KITA)"
          value={firstAirRow?.value ?? "수집 중"}
          sub={
            firstAirRow
              ? `${firstAirRow.origin} → ${firstAirRow.dest}`
              : "인천발 데이터 수집 중"
          }
          change={firstAirRow?.mom != null ? pctText(firstAirRow.mom) : undefined}
          trend={
            firstAirRow?.mom == null
              ? undefined
              : firstAirRow.mom > 0
                ? "up"
                : firstAirRow.mom < 0
                  ? "down"
                  : "flat"
          }
          tone="green"
          spark={firstAirRow?.values}
        />
        <LdKpiCard
          icon="⚠"
          title="리스크 알림"
          value={`${alertCount}건`}
          sub={alertCount > 0 ? `경고 ${highAlerts} · 주의 ${medAlerts}` : "활성 경보 없음"}
          tone={highAlerts > 0 ? "red" : medAlerts > 0 ? "amber" : "gray"}
        />
      </section>

      {/* Main grid: Intelligence Panel + Right Sidebar */}
      <section className="ld-main-grid ld-shell">
        <LdIntelligencePanel
          forecasts={openForecasts}
          seriesMap={series}
          stats={stats}
          selectedMetric={search.judgment}
        />
        <aside className="ld-side-column">
          <LdActionQueue alerts={alerts} />
          <LdIndexSnapshot stats={stats} asOf={asOf} />
          <LdEurasiaRisk disruptions={disruptions} />
        </aside>
      </section>

      {/* Route Monitor */}
      <section className="ld-route-monitor-grid ld-shell">
        <LdSeaRouteMonitor laneRows={laneRows} />
        <LdAirRouteMonitor airRows={airLaneRows} />
      </section>

      {/* Utility row */}
      <section className="ld-utility-grid ld-shell">
        <LdDataBasisCard
          asOf={asOf}
          dataUpdates={dataUpdates}
          stats={stats}
          seaRates={seaRates}
          exRateDate={exRate?.rate_date}
        />
        <LdFxCard exRate={exRate ?? null} />
        <LdOilCard jetFuel={jetFuelHistory} />
        <LdUpdateCard latestUpdate={latestUpdate} />
      </section>
    </div>
  );
}
