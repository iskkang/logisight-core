// 종합 Control Tower — 사용자 제공 샘플(LogisightControlTower) 디자인을 실데이터에 연결.
// 데이터 빌더/소스는 기존 /dashboard 와 동일(forecasts·alerts·KITA·환율·유라시아·지수·항공유). 표현만 샘플 디자인.
import { useId, useMemo } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DIR_META, FACTOR_LABEL, baseIndexCaption, sentences } from "@/components/forecasts/forecastUtils";
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
  type Forecast,
  type ForecastSeries,
} from "@/lib/api/forecasts";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";
const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

const STYLE = `
.lsgct-root{font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
@media (prefers-reduced-motion:reduce){.lsgct-root [data-anim]{display:none}}
`;

export const JUDGMENT_TAB_CODES = ["KCCI", "WCI", "SCFI"] as const;
export type JudgmentTabCode = (typeof JUDGMENT_TAB_CODES)[number];

const routeApi = getRouteApi("/dashboard");

type KeyLane = { laneId: string; origin: string; dest: string; mode: "ocean" | "rail"; metricType: "rate" | "delay"; displayOrder: number };
type KeyLaneRow = { lane: KeyLane; value: string | null; mom: number | null; values: number[]; asOf: string | null };
const KEY_LANES: KeyLane[] = [
  { laneId: "PUS-LAX", origin: "부산", dest: "로스앤젤레스", mode: "ocean", metricType: "rate", displayOrder: 1 },
  { laneId: "PUS-NYC", origin: "부산", dest: "뉴욕", mode: "ocean", metricType: "rate", displayOrder: 2 },
  { laneId: "PUS-CHI", origin: "부산", dest: "시카고", mode: "ocean", metricType: "rate", displayOrder: 3 },
  { laneId: "KR-ANDIJAN", origin: "한국", dest: "안디잔", mode: "rail", metricType: "delay", displayOrder: 4 },
  { laneId: "CN-ALMATY", origin: "중국", dest: "알마티", mode: "rail", metricType: "delay", displayOrder: 5 },
];
type AirLaneRow = { origin: string; dest: string; value: string | null; mom: number | null; values: number[]; asOf: string | null };

const AIR_PRIORITY_DESTS = ["로스", "시카고", "하노이"];
const INDEX_ORDER = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"];
const SEV_LABEL: Record<AlertCandidate["severity"], string> = { high: "경고", medium: "주의", low: "낮음", info: "정보" };
const SEV_TONE: Record<AlertCandidate["severity"], string> = {
  high: "border-[#fdd3cf] bg-[#fef0ef] text-[#b42318]",
  medium: "border-[#fed7aa] bg-[#fff7ed] text-[#b54708]",
  low: "border-[#c7ead6] bg-[#ecfdf3] text-[#067647]",
  info: "border-[#d8dfe9] bg-[#eef2f7] text-[#54606f]",
};

/* ---------- helpers (DB 기준, 결측 —) ---------- */
function pctText(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}
function trendSym(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return v > 0 ? "▲" : "▼";
}
function trendColor(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-[#828d9d]";
  return v > 0 ? "text-[#16a34a]" : "text-[#dc2626]";
}
function yyyymmLabel(ym: string | null | undefined): string {
  if (!ym || ym.length < 6) return "—";
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}
function kstDateString(): string {
  // 빌드/SSR 안전을 위해 Date.now() 사용 후 KST 보정
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return [kst.getUTCFullYear(), String(kst.getUTCMonth() + 1).padStart(2, "0"), String(kst.getUTCDate()).padStart(2, "0")].join("-");
}
function latestDataUpdate(dataUpdates: { updated_at: string | null }[]): string | null {
  return dataUpdates.map((u) => u.updated_at).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
}
function statByCode(stats: IndexStats[], code: string): IndexStats | undefined {
  return stats.find((s) => s.index_code === code);
}
function orderedStats(stats: IndexStats[]): IndexStats[] {
  const rank = new Map(INDEX_ORDER.map((code, i) => [code, i]));
  return [...stats].filter((s) => s.latest_value != null).sort((a, b) => (rank.get(a.index_code) ?? 99) - (rank.get(b.index_code) ?? 99));
}
function sourceList(stats: IndexStats[], dataUpdates: { dataset: string; updated_at: string | null }[]): string {
  const fromUpdates = dataUpdates.map((u) => u.dataset).filter(Boolean);
  if (fromUpdates.length > 0) return fromUpdates.slice(0, 4).join(" · ");
  const fromStats = [...new Set(stats.map((s) => s.source).filter((s): s is string => Boolean(s)))];
  if (fromStats.length > 0) return fromStats.slice(0, 4).join(" · ");
  return "데이터 수집 중";
}

/* ---------- data builders (기존 /dashboard 동일) ---------- */
function buildLaneRows(seaRates: KitaSeaRateRow[], delays: DelayWeeklyRow[]): KeyLaneRow[] {
  const latestSea = latestByRoute(seaRates);
  const fixedRows = [...KEY_LANES]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((lane): KeyLaneRow => {
      if (lane.metricType === "rate") {
        const row = latestSea.find((r) => r.origin === lane.origin && r.dest === lane.dest);
        const series = seaRates.filter((x) => x.origin === lane.origin && x.dest === lane.dest).sort((a, b) => a.year_mon.localeCompare(b.year_mon));
        const values = series.map((x) => x.feu).filter((v): v is number => v != null);
        if (!row || row.feu == null) return { lane, value: null, mom: null, values, asOf: row?.year_mon ?? null };
        const mom = computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x.feu })));
        return { lane, value: `$${row.feu.toLocaleString("en-US")}/FEU`, mom, values, asOf: row.year_mon };
      }
      const laneDelays = delays.filter((d) => d.lane_id === lane.laneId).sort((a, b) => a.week_iso.localeCompare(b.week_iso));
      const latest = laneDelays.at(-1);
      const values = laneDelays.map((d) => d.median_delay_d).filter((v): v is number => v != null);
      return { lane, value: latest?.median_delay_d != null ? `지연 ${latest.median_delay_d.toFixed(1)}일` : null, mom: null, values, asOf: latest?.week_iso ?? null };
    });

  const visibleRows = fixedRows.filter((row) => row.value != null);
  const usedSeaKeys = new Set(visibleRows.filter((r) => r.lane.metricType === "rate").map((r) => `${r.lane.origin}__${r.lane.dest}`));
  const supplemental = latestSea
    .flatMap((row) => {
      if (row.feu == null || usedSeaKeys.has(`${row.origin}__${row.dest}`)) return [];
      const series = seaRates.filter((x) => x.origin === row.origin && x.dest === row.dest).sort((a, b) => a.year_mon.localeCompare(b.year_mon));
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
      lane: { laneId: `KITA-${candidate.row.origin}-${candidate.row.dest}`, origin: candidate.row.origin, dest: candidate.row.dest, mode: "ocean", metricType: "rate", displayOrder: visibleRows.length + 1 },
      value: `$${candidate.row.feu!.toLocaleString("en-US")}/FEU`,
      mom: candidate.mom, values: candidate.values, asOf: candidate.row.year_mon,
    });
  }
  return visibleRows;
}

function buildAirLaneRows(airRates: KitaAirRateRow[]): AirLaneRow[] {
  const incheon = airRates.filter((r) => r.origin.includes("인천") || r.origin.toUpperCase().includes("ICN"));
  const latest = latestByRoute(incheon);
  function toRow(row: KitaAirRateRow): AirLaneRow {
    const tier = row.kg300 != null ? "kg300" : row.kg100 != null ? "kg100" : "kg500";
    const series = incheon.filter((x) => x.origin === row.origin && x.dest === row.dest).sort((a, b) => a.year_mon.localeCompare(b.year_mon));
    const values = series.map((x) => x[tier]).filter((v): v is number => v != null);
    const rateVal = row[tier];
    return {
      origin: row.origin, dest: row.dest,
      value: rateVal != null ? `₩${rateVal.toLocaleString("ko-KR")}/kg` : null,
      mom: computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x[tier] ?? null }))),
      values, asOf: row.year_mon,
    };
  }
  const rows: AirLaneRow[] = [];
  for (const keyword of AIR_PRIORITY_DESTS) {
    const match = latest.find((r) => r.dest.includes(keyword));
    if (match) rows.push(toRow(match));
  }
  return rows.filter((r) => r.value != null);
}

function buildHeroSummary(kcciStat: IndexStats | undefined, stats: IndexStats[], alertCount: number, disruptions: number, openForecasts: Forecast[]): string {
  const parts: string[] = [];
  if (kcciStat?.latest_value != null) {
    const val = kcciStat.latest_value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    const chg = kcciStat.change_pct;
    const dir = chg == null ? "" : Math.abs(chg) < 0.5 ? "보합" : chg > 0 ? "상승" : "하락";
    parts.push(`한국발 해상 운임 지수(KCCI) ${val}pt — 전주 대비 ${chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(1) + "%" : "—"} ${dir} 추세.`);
  }
  const scfi = stats.find((s) => s.index_code === "SCFI");
  if (scfi?.change_pct != null) parts.push(`글로벌 컨테이너 운임(SCFI) ${scfi.change_pct >= 0 ? "+" : ""}${scfi.change_pct.toFixed(1)}% 정합.`);
  if (disruptions > 0) parts.push(`유라시아 회랑 ${disruptions}건 활성 장애 — 리드타임 영향 추정.`);
  const fc = openForecasts[0];
  if (fc?.direction) {
    const dir = ({ up: "상승", down: "하락", flat: "보합" } as Record<string, string>)[fc.direction] ?? "";
    parts.push(`AI 전망(에디터 검수): ${fc.metric_ref ?? "운임"} ${dir} 기조 시사.`);
  }
  if (alertCount > 0) parts.push(`경보 ${alertCount}건 점검 권장.`);
  return parts.join(" ") || "주요 노선 현황과 운임 지수를 확인하세요.";
}

/* ---------- spark ---------- */
function Spark({ vals, color, className }: { vals: number[]; color: string; className?: string }) {
  const rawId = useId();
  const id = "sp" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  if (vals.length < 2) return null;
  const w = 120, h = 34, min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============================ HERO ============================ */
function Hero({ summary, chips }: { summary: string; chips: { c: string; label: string; value: string }[] }) {
  return (
    <section className="relative overflow-hidden bg-[#070b16]">
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute right-[2%] top-1/2 w-[540px] max-w-[52%] -translate-y-1/2 opacity-85" viewBox="0 0 520 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id="lsgct-rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.16" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" /></radialGradient>
            <linearGradient id="lsgct-sw" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.32" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient>
          </defs>
          <circle cx="300" cy="210" r="200" fill="url(#lsgct-rg)" />
          <g stroke="rgba(120,170,205,.18)" fill="none"><circle cx="300" cy="210" r="60" /><circle cx="300" cy="210" r="110" /><circle cx="300" cy="210" r="160" /><circle cx="300" cy="210" r="200" /><line x1="100" y1="210" x2="500" y2="210" /><line x1="300" y1="10" x2="300" y2="410" /></g>
          <path data-anim d="M300 210 L300 50 A160 160 0 0 1 440 290 Z" fill="url(#lsgct-sw)" opacity="0.5"><animateTransform attributeName="transform" type="rotate" from="0 300 210" to="360 300 210" dur="9s" repeatCount="indefinite" /></path>
          <g fill="#2dd4bf"><circle cx="360" cy="150" r="3" /><circle cx="250" cy="280" r="3" /><circle cx="390" cy="250" r="2.4" /></g>
        </svg>
        <div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 82% 35%, rgba(45,212,191,.12), transparent 55%), linear-gradient(90deg, #070b16 38%, rgba(7,11,22,.5) 66%, transparent 100%)" }} />
      </div>
      <div className={`${WRAP} relative z-[1]`}>
        <div className="max-w-[760px] pt-[58px] pb-[68px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">Control Tower</span>
          <h1 className="mt-3.5 text-[clamp(32px,4.4vw,50px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#e9eef7]">종합 <span className="text-[#2dd4bf]">Control Tower</span></h1>
          <p className="mt-4 max-w-[640px] text-[15px] leading-[1.6] text-[#93a1b7]">{summary}</p>
          <div className="mt-[26px] flex flex-wrap gap-2.5">
            {chips.map((p) => (
              <span key={p.label} className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]">
                <span className={`h-[7px] w-[7px] rounded-full ${p.c}`} />{p.label} <b className="lsg-mono text-[#e9eef7]">{p.value}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ JUDGMENT PANEL (forecast 실데이터) ============================ */
function JudgmentPanel({ forecasts, seriesMap, stats, selectedMetric }: {
  forecasts: Forecast[]; seriesMap: Record<string, ForecastSeries>; stats: IndexStats[]; selectedMetric?: JudgmentTabCode;
}) {
  const forecastByMetric = useMemo(() => {
    const rows = new Map<JudgmentTabCode, Forecast>();
    for (const f of forecasts.filter((f) => f.status === "published")) {
      const metric = f.metric_ref as JudgmentTabCode | null;
      if (metric && JUDGMENT_TAB_CODES.includes(metric) && !rows.has(metric)) rows.set(metric, f);
    }
    return rows;
  }, [forecasts]);

  const fallbackMetric = JUDGMENT_TAB_CODES.find((code) => forecastByMetric.has(code));
  const activeMetric = selectedMetric && forecastByMetric.has(selectedMetric) ? selectedMetric : fallbackMetric;
  const forecast = activeMetric ? forecastByMetric.get(activeMetric) ?? null : null;
  const series = forecast ? seriesMap[forecast.id] : undefined;
  const direction = forecast?.direction ? DIR_META[forecast.direction] : null;
  const lead = sentences(forecast?.statement ?? "")[0] ?? forecast?.statement ?? "";
  const lastSentence = sentences(forecast?.statement ?? "").at(-1) ?? "";
  const invalidation = forecast?.invalidation_condition ?? "";
  const metricStat = activeMetric ? statByCode(stats, activeMetric) : undefined;

  const chartData = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points.map((p) => ({ date: p.date ? p.date.slice(5, 10) : "", value: p.value }));
  }, [series]);

  const factorRows = (forecast?.factor_scores ?? []).filter((f) => !f.missing && f.score != null);
  const maxAbsScore = Math.max(...factorRows.map((f) => Math.abs(f.score as number)), 1);
  const factorTotal = factorRows.reduce((s, f) => s + (f.score as number), 0);

  return (
    <div className={`p-[22px] ${CARD}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-[17px] font-bold text-[#1a2433]">운임 종합 판단</span>
        <span className="rounded-full border border-[#ccfbf1] bg-[#e9f8f4] px-2.5 py-1 text-[11px] font-semibold text-[#0d9488]">AI 인사이트 · 에디터 검수</span>
        {direction && <span className="ml-auto rounded-full border border-[#c7ead6] bg-[#ecfdf3] px-2.5 py-1 lsg-mono text-[11px] font-semibold text-[#067647]">{direction.glyph} {direction.label}</span>}
      </div>

      {/* tabs */}
      <div className="mb-[18px] inline-flex gap-1 rounded-[9px] border border-[#d8dfe9] bg-[#e7ecf3] p-[3px]">
        {JUDGMENT_TAB_CODES.map((code) => {
          const has = forecastByMetric.has(code);
          const active = code === activeMetric;
          if (!has) return <span key={code} className="rounded-[6px] px-4 py-1.5 text-[13px] text-[#aab4c2]">{code}</span>;
          return (
            <Link key={code} to="/dashboard" search={{ judgment: code }} className={active ? "rounded-[6px] bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0d9488] shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "rounded-[6px] px-4 py-1.5 text-[13px] text-[#54606f]"}>{code}</Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 min-[1080px]:grid-cols-[1fr_200px]">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-[#828d9d]">
            <span>{activeMetric ?? "지수"} 추이{baseIndexCaption(forecast as Forecast) ? ` (${baseIndexCaption(forecast as Forecast)})` : ""}</span>
            <span className="lsg-mono font-bold text-[#1a2433]">{metricStat?.latest_value != null ? formatNumber(metricStat.latest_value, 0) : "—"}</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <defs><linearGradient id="lsgctChart" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d9488" stopOpacity={0.18} /><stop offset="95%" stopColor="#0d9488" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="date" tick={{ fill: "#828d9d", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#828d9d", fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={42} tickFormatter={(v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })} />
                <Tooltip contentStyle={{ background: "rgba(10,30,54,0.96)", border: "1px solid rgba(116,177,255,0.28)", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#f4f8ff" }} formatter={(v: number) => [v.toLocaleString("en-US", { maximumFractionDigits: 1 }), activeMetric]} labelFormatter={(l: string) => `기준일 ${l}`} />
                <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2.5} fill="url(#lsgctChart)" dot={false} activeDot={{ r: 4, fill: "#2dd4bf", stroke: "#0d9488", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[200px] place-items-center text-[12px] text-[#828d9d]">{forecast ? "전망 데이터 수집 중" : "발행된 전망이 없습니다"}</div>
          )}
        </div>

        <div>
          <div className="mb-3.5 text-[13px] font-semibold text-[#1a2433]">상승 요인 기여도</div>
          {factorRows.length > 0 ? (
            <>
              {factorRows.slice(0, 5).map((factor) => {
                const score = factor.score as number;
                const width = Math.round((Math.abs(score) / maxAbsScore) * 100);
                return (
                  <div key={factor.factor} className="mb-[13px]">
                    <div className="mb-[5px] flex justify-between text-[12px] text-[#54606f]"><span>{FACTOR_LABEL[factor.factor] ?? factor.factor}</span><span className="lsg-mono font-semibold text-[#1a2433]">{score > 0 ? "+" : ""}{score}</span></div>
                    <div className="h-[6px] overflow-hidden rounded-[4px] bg-[#dde4ee]"><div className="h-full rounded-[4px]" style={{ width: `${width}%`, background: "linear-gradient(90deg,#0d9488,#2dd4bf)" }} /></div>
                  </div>
                );
              })}
              <div className="mt-1 flex items-center justify-between border-t border-[#d8dfe9] pt-3 text-[13px] text-[#54606f]"><span>합계</span><b className="lsg-mono text-[18px] text-[#0d9488]">{factorTotal > 0 ? "+" : ""}{factorTotal.toFixed(1)}</b></div>
            </>
          ) : (
            <div className="mt-4 text-[12px] text-[#828d9d]">팩터 점수 수집 중</div>
          )}
        </div>
      </div>

      <div className="my-[18px] flex gap-3 rounded-[12px] border border-[#d4e6f2] bg-[#eef6fb] px-[17px] py-[15px]">
        <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] bg-[#3b82f6] text-[11px] font-bold text-white">AI</div>
        <div><div className="mb-1 text-[13px] font-semibold text-[#1a2433]">AI 요약 · 에디터 검수</div><p className="text-[13px] leading-[1.55] text-[#54606f]">{lead || "전망 본문 수집 중입니다. 에디터 검수 후 공개됩니다."}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
        <div className="rounded-[12px] border border-[#cdeed8] bg-[#f0fbf4] p-4">
          <div className="mb-[9px] text-[13px] font-bold text-[#067647]">상방 조건</div>
          <p className="text-[12px] leading-[1.55] text-[#54606f]">{forecast?.direction === "up" ? lastSentence : invalidation || "수요 강세 지속 + 공급 제약 심화"}</p>
          {forecast?.range_high_pct != null && <span className="mt-2.5 block lsg-mono text-[12.5px] font-semibold text-[#067647]">전망 범위 상단 +{forecast.range_high_pct}%</span>}
        </div>
        <div className="rounded-[12px] border border-[#d8dfe9] bg-[#eef1f6] p-4">
          <div className="mb-[9px] text-[13px] font-bold text-[#54606f]">기준 시나리오</div>
          <p className="text-[12px] leading-[1.55] text-[#54606f]">{lead || "수요 완만 + 공급 제한적 완화"}</p>
          {forecast?.expected_range_pct && <span className="mt-2.5 block lsg-mono text-[12.5px] font-semibold text-[#1a2433]">전망 {forecast.expected_range_pct}%</span>}
        </div>
        <div className="rounded-[12px] border border-[#fbd5d5] bg-[#fef2f2] p-4">
          <div className="mb-[9px] text-[13px] font-bold text-[#dc2626]">하방 조건</div>
          <p className="text-[12px] leading-[1.55] text-[#54606f]">{forecast?.direction === "down" ? lastSentence : invalidation || "수요 둔화 + 공급 회복 가속"}</p>
          {forecast?.range_low_pct != null && <span className="mt-2.5 block lsg-mono text-[12.5px] font-semibold text-[#dc2626]">전망 범위 하단 {forecast.range_low_pct}%</span>}
        </div>
      </div>
    </div>
  );
}

/* ============================ ROUTE MONITOR ============================ */
function RouteMonitor({ title, icon, rows }: { title: string; icon: string; rows: { label: string; price: string; mom: number | null; asOf: string | null; values: number[] }[] }) {
  return (
    <div className={`p-[22px] ${CARD}`}>
      <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[16px] font-bold text-[#1a2433]">{title}</h3><Link to="/rates" className="rounded-[7px] border border-[#d8dfe9] bg-white px-[11px] py-[5px] text-[12px] text-[#828d9d] transition-colors hover:border-[#0d9488] hover:text-[#0d9488]">더보기</Link></div>
      {rows.length === 0 ? (
        <p className="py-4 text-[12px] text-[#828d9d]">데이터 수집 중</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
          {rows.map((r, i) => (
            <div key={i} className="rounded-[12px] border border-[#d8dfe9] bg-white p-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#c8d2df]">
              <div className="mb-2 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-medium text-[#54606f]">{icon} {r.label}</div>
              <div className="lsg-mono text-[16px] font-bold text-[#1a2433]">{r.price}</div>
              <div className={`mt-[3px] lsg-mono text-[11px] ${trendColor(r.mom)}`}>{trendSym(r.mom)} {pctText(r.mom)}</div>
              {r.values.slice(-8).length > 1 && <Spark vals={r.values.slice(-8)} color={(r.mom ?? 0) < 0 ? "#dc2626" : "#16a34a"} className="mt-2 block h-[34px] w-full" />}
              <div className="mt-1 lsg-mono text-[10px] text-[#828d9d]">{yyyymmLabel(r.asOf)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ SIDEBAR ============================ */
function SideHead({ title, to }: { title: string; to: "/rates" | "/eurasia" }) {
  return <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[16px] font-bold text-[#1a2433]">{title}</h3><Link to={to} className="rounded-[7px] border border-[#d8dfe9] bg-white px-[11px] py-[5px] text-[12px] text-[#828d9d] transition-colors hover:border-[#0d9488] hover:text-[#0d9488]">전체 보기</Link></div>;
}

function Sidebar({ alerts, stats, asOf, disruptions }: {
  alerts: AlertCandidate[]; stats: IndexStats[]; asOf: string;
  disruptions: { id: string; title: string; severity: "high" | "medium" | "low"; delay_contribution_days: number | null }[];
}) {
  const indexRows = orderedStats(stats).slice(0, 6);
  return (
    <div className="flex flex-col gap-5">
      <div className={`p-[22px] ${CARD}`}>
        <SideHead title="Action Queue" to="/rates" />
        {alerts.length === 0 ? <p className="text-[12px] text-[#828d9d]">현재 활성 경보 없음</p> : alerts.slice(0, 4).map((a, i) => (
          <div key={a.title} className={`flex gap-3 py-[13px] ${i === 0 ? "pt-0.5" : "border-t border-[#d8dfe9]"}`}>
            <div className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-[#0e1626] lsg-mono text-[11px] font-bold text-white">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1a2433]">{a.title}<span className={`flex-none rounded-[5px] border px-[7px] py-0.5 text-[10px] font-bold ${SEV_TONE[a.severity]}`}>{SEV_LABEL[a.severity]}</span></div>
              <div className="mt-[3px] lsg-mono text-[11.5px] leading-[1.45] text-[#828d9d]">{a.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`p-[22px] ${CARD}`}>
        <SideHead title="글로벌 지수 스냅샷" to="/rates" />
        {indexRows.length === 0 ? <p className="text-[12px] text-[#828d9d]">지수 수집 중</p> : (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#d8dfe9] bg-[#d8dfe9]">
            {indexRows.map((x) => (
              <div key={x.index_code} className="bg-[#f4f7fb] px-3.5 py-[13px]">
                <div className="text-[11px] font-semibold text-[#828d9d]">{x.index_code}</div>
                <div className="mt-[3px] lsg-mono text-[17px] font-bold text-[#1a2433]">{formatNumber(x.latest_value, x.index_code === "SCFI" || x.index_code === "CCFI" ? 2 : 0)}</div>
                <div className={`mt-0.5 lsg-mono text-[11.5px] ${trendColor(x.change_pct)}`}>{trendSym(x.change_pct)} {pctText(x.change_pct)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 lsg-mono text-[11px] text-[#828d9d]">WoW · 기준 {asOf}</div>
      </div>

      <div className={`p-[22px] ${CARD}`}>
        <SideHead title="유라시아 리스크" to="/eurasia" />
        {disruptions.length === 0 ? <p className="text-[12px] text-[#828d9d]">특정 장애 없음 · 정상</p> : disruptions.slice(0, 4).map((d, i) => (
          <div key={d.id} className={`flex items-center justify-between gap-2.5 py-[11px] text-[13px] ${i === 0 ? "pt-0.5" : "border-t border-[#d8dfe9]"}`}>
            <span className="text-[#1a2433]">{d.title}{d.delay_contribution_days != null ? <small className="lsg-mono text-[#828d9d]"> ({d.delay_contribution_days}일)</small> : ""}</span>
            <span className={`flex-none rounded-[5px] border px-[7px] py-0.5 text-[10px] font-bold ${d.severity === "high" ? SEV_TONE.high : d.severity === "medium" ? SEV_TONE.medium : SEV_TONE.low}`}>{d.severity === "high" ? "경고" : d.severity === "medium" ? "주의" : "낮음"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ UTILITY ROW ============================ */
function KV({ rows, src }: { rows: [string, string][]; src?: string }) {
  return (
    <>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2.5 border-b border-[#e6ebf2] py-1.5 text-[12px] last:border-b-0"><span className="text-[#828d9d]">{k}</span><span className="lsg-mono text-right text-[#1a2433]">{v}</span></div>
      ))}
      {src && <div className="mt-2 lsg-mono text-[11px] text-[#828d9d]">{src}</div>}
    </>
  );
}

function UtilityRow({ asOf, dataUpdates, stats, seaRates, exRate, jetFuel }: {
  asOf: string; dataUpdates: { dataset: string; updated_at: string | null }[]; stats: IndexStats[];
  seaRates: KitaSeaRateRow[]; exRate: ExchangeRateRow | null; jetFuel: IataJetFuelRow[];
}) {
  const latestUpdate = latestDataUpdate(dataUpdates);
  const availableIndexes = stats.filter((s) => s.latest_value != null).length;
  const latestSeaMonth = seaRates.map((r) => r.year_mon).sort().at(-1) ?? null;
  const basisRows: [string, string][] = [
    ["기준일", asOf],
    ["데이터 갱신", latestUpdate ? `${latestUpdate.slice(0, 16).replace("T", " ")} KST` : "수집 이력 확인 중"],
    ["수집 소스", sourceList(stats, dataUpdates)],
    ["지수 커버리지", `${availableIndexes}/${stats.length || 0}개`],
    ["KITA 해상", yyyymmLabel(latestSeaMonth)],
    ["환율 기준", exRate?.rate_date?.slice(0, 10) ?? "수집 중"],
  ];
  const fxRows: [string, string][] = exRate
    ? ([
        ["USD / KRW", exRate.usd_krw], ["EUR / KRW", exRate.eur_krw], ["CNY / KRW", exRate.cny_krw], ["JPY(100) / KRW", exRate.jpy_krw], ["RUB / KRW", exRate.rub_krw],
      ] as [string, number | null][]).map(([k, v]) => [k, v != null ? `₩${v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}` : "—"])
    : [];
  const oilLatest = jetFuel.at(-1);
  const oilData = jetFuel.filter((r) => r.price_usd_bbl != null).map((r) => ({ date: r.as_of.slice(5, 10), price: r.price_usd_bbl as number }));
  const wow = oilLatest?.fuel_wow_pct ?? null;

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-4">
      <div className={`p-[18px] ${CARD}`}><div className="mb-3.5 text-[14px] font-bold text-[#1a2433]">데이터 기준</div><KV rows={basisRows} /></div>
      <div className={`p-[18px] ${CARD}`}><div className="mb-3.5 text-[14px] font-bold text-[#1a2433]">환율 정보</div>{fxRows.length === 0 ? <p className="text-[12px] text-[#828d9d]">데이터 수집 중</p> : <KV rows={fxRows} src={exRate?.rate_date ? `하나은행 · ${exRate.rate_date.slice(0, 10)}` : undefined} />}</div>
      <div className={`p-[18px] ${CARD}`}>
        <div className="mb-3.5 text-[14px] font-bold text-[#1a2433]">항공유 가격</div>
        {oilData.length === 0 ? <p className="text-[12px] text-[#828d9d]">데이터 수집 중</p> : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="lsg-mono text-[22px] font-extrabold text-[#1a2433]">${oilLatest?.price_usd_bbl?.toLocaleString("en-US", { maximumFractionDigits: 2 })}<span className="ml-1 text-[11px] font-bold text-[#828d9d]">/bbl</span></span>
              {wow != null && <span className={`lsg-mono text-[12px] font-bold ${wow >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{wow >= 0 ? "+" : ""}{wow.toFixed(1)}% WoW</span>}
            </div>
            <div className="mt-2 h-[60px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={oilData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs><linearGradient id="lsgctOil" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.2} /><stop offset="95%" stopColor="#d97706" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="date" hide /><YAxis domain={["auto", "auto"]} hide />
                  <Tooltip contentStyle={{ background: "rgba(15,34,56,0.96)", border: "1px solid rgba(85,166,255,0.28)", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#f0f7ff" }} formatter={(v: number) => [`$${v.toFixed(2)}/bbl`, "Jet Fuel"]} labelFormatter={(l: string) => `기준일 ${l}`} />
                  <Area type="monotone" dataKey="price" stroke="#d97706" strokeWidth={2} fill="url(#lsgctOil)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 lsg-mono text-[11px] text-[#828d9d]">IATA/Platts · 기준 {oilLatest?.as_of?.slice(0, 10)}</div>
          </>
        )}
      </div>
      <div className={`p-[18px] ${CARD}`}><div className="mb-3.5 text-[14px] font-bold text-[#1a2433]">업데이트</div><p className="text-[13px] leading-[1.55] text-[#54606f]">최신 데이터로 업데이트되었습니다.</p><div className="mt-3 lsg-mono text-[11px] text-[#828d9d]">마지막 수집<br />{latestUpdate ? `${latestUpdate.slice(0, 16).replace("T", " ")} KST` : "수집 이력 확인 중"}</div></div>
    </div>
  );
}

/* ============================ PAGE ============================ */
export function LogisightControlTower() {
  const { judgment } = routeApi.useSearch();
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: exRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: jetFuel } = useSuspenseQuery(iataJetFuelQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const { data: dataUpdates } = useSuspenseQuery(dataUpdatesQueryOptions());

  const today = kstDateString();
  const kcciStat = statByCode(stats, "KCCI");
  const asOf = kcciStat?.latest_date?.slice(0, 10) ?? orderedStats(stats)[0]?.latest_date?.slice(0, 10) ?? "수집 중";
  const openForecasts = forecasts.filter((f) => f.status === "published");
  const alertCount = alerts.filter((a) => a.severity === "high" || a.severity === "medium").length;
  const laneRows = useMemo(() => buildLaneRows(seaRates, delays), [seaRates, delays]);
  const airRows = useMemo(() => buildAirLaneRows(airRates), [airRates]);
  const summary = useMemo(() => buildHeroSummary(kcciStat, stats, alertCount, disruptions.length, openForecasts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kcciStat, stats, alertCount, disruptions.length, openForecasts.length]);

  const pressureUp = (kcciStat?.change_pct ?? 0) > 0;
  const chips = [
    { c: pressureUp ? "bg-[#ef4444]" : "bg-[#16a34a]", label: "운임 압력", value: pressureUp ? "상승" : "안정" },
    { c: "bg-[#d97706]", label: "유라시아 리스크", value: disruptions.length > 0 ? `${disruptions.length}건` : "정상" },
    { c: "bg-[#ef4444]", label: "경보", value: `${alertCount}건` },
    { c: "bg-[#3b82f6]", label: "기준일", value: today },
  ];

  const seaMonitorRows = laneRows.filter((r) => r.lane.mode === "ocean" && r.value != null).map((r) => ({ label: `${r.lane.origin} → ${r.lane.dest}`, price: r.value ?? "—", mom: r.mom, asOf: r.asOf, values: r.values }));
  const airMonitorRows = airRows.map((r) => ({ label: `${r.origin} → ${r.dest}`, price: r.value ?? "—", mom: r.mom, asOf: r.asOf, values: r.values }));

  return (
    <div className="lsgct-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />
      <Hero summary={summary} chips={chips} />

      <div className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1] pb-2.5" style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}>
        <div className={WRAP}>
          <div className="pt-[26px] lsg-mono text-[12.5px] text-[#828d9d]">홈 <b className="font-medium text-[#54606f]">›</b> 인사이트</div>
          <div className="mt-2.5 grid grid-cols-1 items-start gap-5 min-[1080px]:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-5">
              <JudgmentPanel forecasts={openForecasts} seriesMap={series} stats={stats} selectedMetric={judgment} />
              <RouteMonitor title="해상 노선 모니터" icon="🚢" rows={seaMonitorRows} />
              <RouteMonitor title="항공 노선 모니터" icon="✈" rows={airMonitorRows} />
              <UtilityRow asOf={asOf} dataUpdates={dataUpdates} stats={stats} seaRates={seaRates} exRate={exRate ?? null} jetFuel={jetFuel} />
            </div>
            <Sidebar alerts={alerts} stats={stats} asOf={asOf} disruptions={disruptions} />
          </div>
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}
