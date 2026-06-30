// 운임(Rates) 페이지 — 사용자 제공 샘플(LogisightRates) 디자인을 실데이터에 연결.
// 데이터/상태 로직은 기존 /rates 와 동일(KITA 해상·항공 + freight_indices + 환율 + 발행 전망 + 파트너 운임).
// 표현만 샘플 디자인. 더미 수치는 전부 실데이터로 대체하고, 없으면 "데이터 수집 중"으로 표시.
// 정책: 해상 우선 — 항공 모드는 같은 레이아웃에 데이터만 교체. 미검수 AI 문구·임의 수치 금지.
import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import {
  inMonthRange,
  monthBounds,
  regionsOf,
  portsOf,
  routeSeries,
  regionPortsLatest,
  topPorts,
  heatmapMoM,
  type PortLatest,
} from "@/lib/rates-search";
import {
  freightIndicesHistoryQueryOptions,
  bunkerPricesQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  indexStatsQueryOptions,
  kcciRouteStatsQueryOptions,
  KCCI_ROUTE_LABELS,
  type KitaAirRateRow,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import { publishedPartnerRatesQueryOptions } from "@/lib/api/partner-rates";
import { regionOf } from "@/lib/api/partner-rates.normalize";
import { publishedForecastsQueryOptions } from "@/lib/api/forecasts";
import { recentRateReports, SERIES_LABEL, type RateReport } from "@/components/forecasts/forecastUtils";
import { GeoArticleSchema } from "@/components/geo/GeoArticleSchema";
import { StatBadge, isStatLowOceanUsd } from "@/components/ui/StatBadge";

/* ============================ STYLE ============================ */
const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";
const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const CHIP = "rounded-full border border-[#d8dfe9] bg-[#eef1f6] px-[9px] py-[3px] text-[11px] text-[#828d9d]";
const FONT = "Pretendard, system-ui, sans-serif";

const STYLE = `
.lsgr-root{font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
.lsgr-root tbody tr:hover{background:#eef2f8}
@media (prefers-reduced-motion:reduce){.lsgr-root [data-anim]{display:none}}
`;

const LINE_COLORS = ["#0d9488", "#2563eb", "#d97706", "#16a34a", "#7c3aed", "#0891b2", "#dc2626", "#64748b"];

type Mode2 = "sea" | "air";
const ORIGIN_BY_MODE: Record<Mode2, string> = { sea: "부산", air: "인천" };
const ALL_PORTS = "__all__";
const REGION_CAP = 8;
const ym6 = (s: string) => String(s).replace(/\D/g, "").slice(0, 6);

/* ============================ HELPERS ============================ */
function fmtMonth(value: string | null | undefined) {
  if (!value) return "—";
  const d = String(value).replace(/\D/g, "");
  if (d.length < 6) return value;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}`;
}
function fmtPct(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
function median(arr: number[]) {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function Spark({ vals, color, className }: { vals: number[]; color: string; className?: string }) {
  const rawId = useId();
  const id = "sp" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  if (vals.length < 2) return null;
  const w = 120, h = 32, min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  const cls = kind === "up" ? "border-[#c7ead6] bg-[#ecfdf3] text-[#067647]"
    : kind === "dn" ? "border-[#fbd5d5] bg-[#fef2f2] text-[#dc2626]"
      : "border-[#d8dfe9] bg-[#eef1f6] text-[#54606f]";
  return <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-[3px] text-[11px] font-bold ${cls}`}>{children}</span>;
}

function RangeBar({ pos }: { pos: number | null }) {
  if (pos == null) return <span className="text-[11px] text-[#828d9d]">데이터 수집 중</span>;
  return (
    <>
      <div className="relative h-[6px] w-[130px] rounded-[4px] bg-[#e2e8f1]">
        <span className="absolute inset-y-0 left-0 rounded-[4px] bg-gradient-to-r from-[#bbf7d0] to-[#16a34a]" style={{ width: `${pos}%` }} />
        <span className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0d9488] bg-white" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 text-[10.5px] text-[#828d9d]">최근 1년 위치 {pos}%{pos >= 90 ? " · 고점 구간" : ""}</div>
    </>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1.5">{swatch}{label}</span>;
}
function CardHead({ title, chip, right }: { title: string; chip: string; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5"><h3 className="text-[16px] font-extrabold text-[#1a2433]">{title}</h3><span className={CHIP}>{chip}</span></div>
      {right}
    </div>
  );
}
function Seg<T extends string>({ a, b, value, onChange }: { a: T; b: T; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex gap-[3px] rounded-[8px] border border-[#d8dfe9] bg-[#e7ecf3] p-[3px]">
      {[a, b].map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)} className={t === value
          ? "rounded-[6px] bg-white px-3 py-[5px] text-[12.5px] font-semibold text-[#0d9488] shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
          : "rounded-[6px] px-3 py-[5px] text-[12.5px] text-[#54606f]"}>{t}</button>
      ))}
    </div>
  );
}
function Select({ value, onChange, opts, width }: { value: string; onChange: (v: string) => void; opts: { v: string; label: string }[]; width?: number }) {
  return (
    <span className="relative inline-block">
      <select value={value} onChange={(e) => onChange(e.target.value)} style={width ? { width } : undefined}
        className="appearance-none rounded-[8px] border border-[#d8dfe9] bg-white py-[7px] pl-[11px] pr-[26px] text-[12.5px] font-semibold text-[#1a2433]">
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[9px] text-[#54606f]">▾</span>
    </span>
  );
}
function ymOpts(bounds: { min: string; max: string } | null, part: "y" | "m") {
  if (!bounds) return [] as { v: string; label: string }[];
  if (part === "y") {
    const y0 = Number(bounds.min.slice(0, 4)), y1 = Number(bounds.max.slice(0, 4));
    return Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ v: String(y0 + i), label: `${y0 + i}년` }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1).padStart(2, "0"), label: `${i + 1}월` }));
}

/* ============================ CHARTS ============================ */
// 권역 뷰: 월별 중앙값 + 최소/최대 밴드. 항만 선택 뷰: 단일 라인.
function RateChart({ band, single, cur }: {
  band: { ym: string; med: number; lo: number; hi: number }[] | null;
  single: { ym: string; value: number }[] | null;
  cur: string;
}) {
  const W = 760, H = 300, pL = 56, pR = 16, pT = 16, pB = 30, ix = W - pL - pR, iy = H - pT - pB;
  const pts = band ?? null;
  const sng = single ?? null;
  const all: number[] = pts ? pts.flatMap((p) => [p.lo, p.hi]) : sng ? sng.map((p) => p.value) : [];
  if (all.length < 2) return null;
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1;
  const yMin = Math.max(0, lo - pad), yMax = hi + pad;
  const labels = pts ? pts.map((p) => p.ym) : sng!.map((p) => p.ym);
  const n = labels.length;
  const X = (i: number) => pL + (i / (n - 1)) * ix;
  const Y = (v: number) => pT + (1 - (v - yMin) / (yMax - yMin)) * iy;
  const gx = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) / 3) * i);
  const last = pts ? pts[pts.length - 1].med : sng![sng!.length - 1].value;
  const first = pts ? pts[0].med : sng![0].value;
  const chg = first ? ((last - first) / first) * 100 : 0;
  const tickIdx = Array.from(new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1])).filter((i) => i >= 0 && i < n);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      {gx.map((g) => (
        <g key={g}>
          <line x1={pL} y1={Y(g)} x2={W - pR} y2={Y(g)} stroke="#dbe2ec" strokeWidth="1" />
          <text x={pL - 9} y={Y(g) + 3} textAnchor="end" fontSize="10" fill="#828d9d" fontFamily={FONT}>{cur}{Math.round(g).toLocaleString()}</text>
        </g>
      ))}
      {pts && (
        <polygon
          points={pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.hi).toFixed(1)}`).join(" ") + " " + pts.map((_, i) => `${X(n - 1 - i).toFixed(1)},${Y(pts[n - 1 - i].lo).toFixed(1)}`).join(" ")}
          fill="#0d9488" fillOpacity="0.14"
        />
      )}
      <polyline points={(pts ? pts.map((p) => p.med) : sng!.map((p) => p.value)).map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" stroke="#0d9488" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(n - 1).toFixed(1)} cy={Y(last).toFixed(1)} r="4" fill="#0d9488" />
      <text x={W - pR - 6} y={pT + 11} textAnchor="end" fontFamily={FONT} className="lsg-mono">
        <tspan fontSize="13" fontWeight="800" fill="#0d9488">{cur}{Math.round(last).toLocaleString()}</tspan>
        <tspan fontSize="10" fontWeight="600" fill={chg >= 0 ? "#16a34a" : "#dc2626"} dx="5">{fmtPct(chg, 0)}</tspan>
      </text>
      {tickIdx.map((i) => <text key={i} x={X(i).toFixed(1)} y={H - 9} textAnchor="middle" fontSize="9" fill="#828d9d" fontFamily={FONT}>{fmtMonth(labels[i])}</text>)}
    </svg>
  );
}

function IndexChart({ data, codes, colors }: { data: Record<string, number | string>[]; codes: string[]; colors: Record<string, string> }) {
  const W = 760, H = 280, pL = 44, pR = 14, pT = 16, pB = 28, ix = W - pL - pR, iy = H - pT - pB;
  const vals = data.flatMap((d) => codes.map((c) => d[c]).filter((v): v is number => typeof v === "number"));
  if (vals.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.1 || 1;
  const yMin = Math.max(0, lo - pad), yMax = hi + pad, n = data.length;
  const X = (i: number) => pL + (i / (n - 1)) * ix;
  const Y = (v: number) => pT + (1 - (v - yMin) / (yMax - yMin)) * iy;
  const gx = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) / 3) * i);
  const tickIdx = Array.from(new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1])).filter((i) => i >= 0 && i < n);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      {gx.map((g) => (
        <g key={g}>
          <line x1={pL} y1={Y(g)} x2={W - pR} y2={Y(g)} stroke="#dbe2ec" strokeWidth="1" />
          <text x={pL - 8} y={Y(g) + 3} textAnchor="end" fontSize="10" fill="#828d9d" fontFamily={FONT}>{(g / 1000).toFixed(1)}k</text>
        </g>
      ))}
      {codes.map((code) => {
        const seq = data.map((d, i) => ({ i, v: d[code] })).filter((p): p is { i: number; v: number } => typeof p.v === "number");
        if (seq.length < 2) return null;
        return (
          <g key={code}>
            <polyline points={seq.map((p) => `${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke={colors[code]} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={X(seq[seq.length - 1].i).toFixed(1)} cy={Y(seq[seq.length - 1].v).toFixed(1)} r="3" fill={colors[code]} />
          </g>
        );
      })}
      {tickIdx.map((i) => <text key={i} x={X(i).toFixed(1)} y={H - 9} textAnchor="middle" fontSize="9" fill="#828d9d" fontFamily={FONT}>{String(data[i]?.label ?? "")}</text>)}
    </svg>
  );
}

function HeatCell({ v }: { v: number | null }) {
  if (v == null) return <td className="rounded-[6px] bg-[#eef1f6] px-1 py-[7px] text-center font-bold text-[#54606f]">—</td>;
  const t = fmtPct(v, 0);
  let bg = "#dcfce7", fg = "#166534";
  if (v >= 30) { bg = "#15803d"; fg = "#fff"; }
  else if (v >= 10) { bg = "#22c55e"; fg = "#fff"; }
  else if (v > 0) { bg = "#dcfce7"; fg = "#166534"; }
  else if (v === 0) { bg = "#eef1f6"; fg = "#54606f"; }
  else if (v > -10) { bg = "#fee2e2"; fg = "#b91c1c"; }
  else if (v > -30) { bg = "#ef4444"; fg = "#fff"; }
  else { bg = "#b91c1c"; fg = "#fff"; }
  return <td className="rounded-[6px] px-1 py-[7px] text-center font-bold" style={{ background: bg, color: fg }}>{t}</td>;
}

/* ============================ HERO ============================ */
function Hero({ baseMonth, regionCount, signalCount }: { baseMonth: string; regionCount: number; signalCount: number }) {
  const bars = [[70, 250, 80], [118, 220, 110], [166, 270, 60], [214, 240, 90], [262, 200, 130], [310, 230, 100], [358, 170, 160], [406, 140, 190], [454, 110, 220]];
  const pills: { c: string; t: ReactNode }[] = [
    { c: "bg-[#2dd4bf]", t: <>기준월 <b className="lsg-mono text-[#e9eef7]">{baseMonth}</b></> },
    { c: "bg-[#16a34a]", t: <>권역 <b className="lsg-mono text-[#e9eef7]">{regionCount}개</b></> },
    { c: "bg-[#d97706]", t: <>주목 레인 <b className="lsg-mono text-[#e9eef7]">{signalCount}건</b></> },
  ];
  return (
    <section className="relative overflow-hidden bg-[#070b16]">
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute right-[1%] top-1/2 w-[560px] max-w-[54%] -translate-y-1/2 opacity-90 max-[640px]:opacity-50" viewBox="0 0 560 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id="lsgr-glow" cx="50%" cy="48%" r="55%"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.15" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" /></radialGradient>
            <linearGradient id="lsgr-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.08" /></linearGradient>
          </defs>
          <circle cx="280" cy="210" r="210" fill="url(#lsgr-glow)" />
          <g stroke="rgba(120,170,205,.13)" strokeWidth="1">
            <line x1="50" y1="330" x2="530" y2="330" /><line x1="50" y1="260" x2="530" y2="260" /><line x1="50" y1="190" x2="530" y2="190" /><line x1="50" y1="120" x2="530" y2="120" />
          </g>
          <g fill="url(#lsgr-bar)">{bars.map((b, i) => <rect key={i} x={b[0]} y={b[1]} width="26" height={b[2]} rx="3" />)}</g>
          <polyline points="83,255 131,225 179,275 227,245 275,205 323,235 371,175 419,145 467,115" fill="none" stroke="#2dd4bf" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <g fill="#2dd4bf"><circle cx="275" cy="205" r="3" /><circle cx="467" cy="115" r="4.5" /></g>
          <circle data-anim cx="467" cy="115" r="4.5" fill="none" stroke="#2dd4bf" strokeWidth="1.4" opacity="0.5">
            <animate attributeName="r" from="4.5" to="13" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.5" to="0" dur="2.4s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 82% 35%, rgba(45,212,191,.12), transparent 55%), linear-gradient(90deg, #070b16 38%, rgba(7,11,22,.5) 66%, transparent 100%)" }} />
      </div>
      <div className={`${WRAP} relative z-[1]`}>
        <div className="max-w-[760px] pt-[54px] pb-[64px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">Rates Control Tower</span>
          <h1 className="mt-3.5 text-[clamp(32px,4.4vw,50px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#e9eef7]">운임 <span className="text-[#2dd4bf]">Control Tower</span></h1>
          <p className="mt-4 max-w-[600px] text-[15px] leading-[1.6] text-[#93a1b7]">저장된 KITA 운임과 글로벌 스팟 지수를 결합해 권역별 해상·항공 운임의 수준·추세·이상치를 한눈에 판단합니다.</p>
          <div className="mt-[22px] flex flex-wrap gap-2.5">
            {pills.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]">
                <span className={`h-[7px] w-[7px] rounded-full ${p.c}`} />{p.t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ PAGE ============================ */
/* ===================== GEO: Article 스키마용 최신일자 산출 (실데이터 바인딩) ===================== */
type GeoIdxRow = {
  latest_date: string | null;
};
function buildRatesGeo(indexStats: GeoIdxRow[]) {
  const dates = indexStats.map((s) => s.latest_date).filter(Boolean) as string[];
  const latestDate = dates.sort().slice(-1)[0] ?? null;
  return { latestDate };
}

export function LogisightRates() {
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  useSuspenseQuery(bunkerPricesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: exchangeRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: partnerRates } = useSuspenseQuery(publishedPartnerRatesQueryOptions());
  const { data: indexStats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: kcciRoutes } = useSuspenseQuery(kcciRouteStatsQueryOptions());

  const [mode, setMode] = useState<Mode2>("sea");
  const [regionState, setRegion] = useState<string>("");
  const [port, setPort] = useState<string>(ALL_PORTS);
  const [metric, setMetric] = useState<"feu" | "teu">("feu");

  const activeRows: (KitaSeaRateRow | KitaAirRateRow)[] = mode === "sea" ? seaRates : airRates;
  const valueOf = (r: KitaSeaRateRow | KitaAirRateRow): number | null =>
    mode === "sea"
      ? metric === "feu" ? (r as KitaSeaRateRow).feu : (r as KitaSeaRateRow).teu
      : (r as KitaAirRateRow).kg300;

  const bounds = useMemo(() => monthBounds(activeRows), [activeRows]);
  const [startYM, setStartYM] = useState<string>("");
  const [endYM, setEndYM] = useState<string>("");

  const regions = useMemo(() => regionsOf(activeRows), [activeRows]);
  // 유효 권역을 렌더 시점에 산출 → SSR·클라이언트 동일하게 실데이터 표시(빈 권역 플래시 방지).
  const region = regions.includes(regionState) ? regionState : regions.includes("북미") ? "북미" : regions[0] ?? "";
  useEffect(() => {
    if (!bounds) return;
    const max = bounds.max;
    const y = Number(max.slice(0, 4)), m = Number(max.slice(4, 6));
    const d = new Date(Date.UTC(y, m - 1 - 12, 1));
    const start = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    setEndYM(max);
    setStartYM(start < bounds.min ? bounds.min : start);
  }, [bounds]);

  const scoped = useMemo(
    () => (startYM && endYM ? inMonthRange(activeRows, startYM, endYM) : activeRows),
    [activeRows, startYM, endYM],
  );
  const ports = useMemo(() => portsOf(scoped, region), [scoped, region]);
  const portSelected = port !== ALL_PORTS && ports.includes(port);

  const regionLatest = useMemo(
    () => regionPortsLatest(scoped, region, valueOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, region, metric, mode],
  );
  const chartPorts = useMemo(
    () => (portSelected ? [port] : topPorts(regionLatest, REGION_CAP)),
    [portSelected, port, regionLatest],
  );

  // 권역 밴드(월별 중앙값·최소·최대) — 권역 뷰 전용
  const band = useMemo(() => {
    if (portSelected) return null;
    const byMonth = new Map<string, number[]>();
    for (const r of scoped) {
      if (r.region !== region) continue;
      const m = ym6(r.year_mon), v = valueOf(r);
      if (m.length === 6 && v != null) {
        const arr = byMonth.get(m) ?? [];
        arr.push(v);
        byMonth.set(m, arr);
      }
    }
    const months = [...byMonth.keys()].sort();
    const rows = months.map((m) => {
      const arr = byMonth.get(m)!;
      return { ym: m, med: median(arr), lo: Math.min(...arr), hi: Math.max(...arr) };
    });
    return rows.length >= 2 ? rows : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, region, portSelected, metric, mode]);

  const single = useMemo(
    () => (portSelected ? routeSeries(scoped, port, valueOf) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, port, portSelected, metric, mode],
  );

  const heatmap = useMemo(
    () => heatmapMoM(scoped, chartPorts, valueOf, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, chartPorts, metric, mode],
  );

  // 글로벌 지수 추이 — 최신 주 기준 최근 6개월
  const trendData = useMemo(() => {
    const codes = ["SCFI", "KCCI", "BDI", "WCI"];
    const rows = history.filter((item) => codes.includes(item.index_code) && item.value != null);
    const latest = rows.map((row) => row.week_date).sort().at(-1);
    if (!latest) return [];
    const cutoff = new Date(latest);
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const byDate = new Map<string, Record<string, number | string>>();
    for (const row of rows) {
      if (row.week_date < cutoffIso) continue;
      const point = byDate.get(row.week_date) ?? { label: row.week_date.slice(5, 10), date: row.week_date };
      point[row.index_code] = row.value ?? 0;
      byDate.set(row.week_date, point);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [history]);

  // 권역 종합 — 평균/추세
  const regionAvg = useMemo(() => {
    const vals = regionLatest.map((p) => p.value).filter((v): v is number => v != null);
    const moms = regionLatest.map((p) => p.mom).filter((v): v is number => v != null);
    if (!vals.length) return null;
    const up = moms.filter((m) => m > 0).length;
    return {
      mean: vals.reduce((a, b) => a + b, 0) / vals.length,
      momMean: moms.length ? moms.reduce((a, b) => a + b, 0) / moms.length : null,
      up,
      total: regionLatest.length,
      ym: regionLatest.find((p) => p.ym)?.ym ?? bounds?.max ?? "",
    };
  }, [regionLatest, bounds]);

  // 시그널 — 권역 내 변동률 상위 3개 레인(자동 탐지). 임의 전망치 표기 없음.
  const signals = useMemo(() => {
    return [...regionLatest]
      .filter((p) => p.mom != null)
      .sort((a, b) => Math.abs(b.mom!) - Math.abs(a.mom!))
      .slice(0, 3)
      .map((p) => ({
        ...p,
        spark: routeSeries(scoped, p.dest, valueOf).map((s) => s.value).slice(-8),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionLatest, scoped, metric, mode]);

  // 세부 표 — 노선별 전월/현재/변동/최근위치
  const detailRows = useMemo(() => {
    return regionLatest.map((p) => {
      const series = routeSeries(activeRows, p.dest, valueOf);
      const trailing = series.slice(-12);
      const cur = trailing.at(-1)?.value ?? null;
      const prev = trailing.at(-2)?.value ?? null;
      const vals = trailing.map((s) => s.value);
      let pos: number | null = null;
      if (cur != null && vals.length >= 2) {
        const min = Math.min(...vals), max = Math.max(...vals);
        pos = max > min ? Math.round(((cur - min) / (max - min)) * 100) : 50;
      }
      return { dest: p.dest, ym: p.ym, cur, prev, mom: p.mom, pos };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionLatest, activeRows, metric, mode]);

  const carrierRows = useMemo(() => {
    if (mode !== "sea") return [];
    return (partnerRates as unknown as PartnerRateRow[]).filter((r) => regionOf(r.country, r.pod) === region);
  }, [partnerRates, region, mode]);

  const reports = recentRateReports(forecasts);
  const fxDate = exchangeRate?.rate_date?.slice(0, 10) ?? null;
  const kcciPct = indexStats.find((s) => s.index_code === "KCCI")?.pct_52w ?? null;
  const geo = useMemo(() => buildRatesGeo(indexStats as GeoIdxRow[]), [indexStats]);
  const cur = mode === "sea" ? "$" : "";

  const reset = () => {
    setMode("sea"); setMetric("feu"); setPort(ALL_PORTS);
    setRegion(regions.includes("북미") ? "북미" : regions[0] ?? "");
    if (bounds) {
      setEndYM(bounds.max);
      const y = Number(bounds.max.slice(0, 4)), mo = Number(bounds.max.slice(4, 6));
      const d = new Date(Date.UTC(y, mo - 1 - 12, 1));
      const s = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      setStartYM(s < bounds.min ? bounds.min : s);
    }
  };

  const sy = startYM.slice(0, 4), sm = startYM.slice(4, 6), ey = endYM.slice(0, 4), em = endYM.slice(4, 6);
  const origin = ORIGIN_BY_MODE[mode];
  const unitLabel = mode === "sea" ? (metric === "feu" ? "해상 · $/FEU" : "해상 · $/TEU") : "항공 · USD/kg (kg300)";
  const fxCaption = exchangeRate ? `USD/KRW ${Math.round(exchangeRate.usd_krw).toLocaleString("ko-KR")} · ${fxDate}` : null;

  return (
    <div className="lsgr-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />
      <Hero baseMonth={fmtMonth(bounds?.max ?? null)} regionCount={regions.length} signalCount={signals.length} />

      <div className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1] pb-2.5" style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}>
        <div className={WRAP}>
          <div className="pt-[26px] text-[12.5px] text-[#828d9d]">
            <Link to="/" className="hover:text-[#0d9488]">홈</Link> <b className="font-medium text-[#54606f]">›</b> 인사이트 <b className="font-medium text-[#54606f]">›</b> 운임
          </div>

          {/* GEO: 보이지 않는 Article JSON-LD만 유지 (시각 요소 없음) */}
          <GeoArticleSchema
            article={{
              headline: "운임 Control Tower — 컨테이너·항공 운임 지수",
              description:
                "부산발 KITA 해상·항공 운임과 글로벌 스팟 지수(SCFI·KCCI·CCFI·FBX·WCI·BDI)를 비교·판단하는 대시보드.",
              path: "/rates",
              datePublished: geo.latestDate,
              dateModified: geo.latestDate,
            }}
          />

          {/* Filters */}
          <div className={`mt-[22px] flex flex-wrap items-center gap-x-4 gap-y-3.5 px-[18px] py-3.5 ${CARD}`}>
            <span className="flex items-center gap-2 text-[12.5px] text-[#828d9d]">분류 <Seg a="해상" b="항공" value={mode === "sea" ? "해상" : "항공"} onChange={(v) => { setMode(v === "해상" ? "sea" : "air"); setPort(ALL_PORTS); }} /></span>
            <span className="flex items-center gap-2 text-[12.5px] text-[#828d9d]">출발지 <Select value={origin} onChange={() => {}} opts={[{ v: origin, label: origin }]} width={84} /></span>
            <span className="flex items-center gap-2 text-[12.5px] text-[#828d9d]">도착지 <Select value={region} onChange={(r) => { setRegion(r); setPort(ALL_PORTS); }} opts={regions.map((r) => ({ v: r, label: r }))} width={110} /></span>
            <Select value={port} onChange={setPort} opts={[{ v: ALL_PORTS, label: "전체(권역)" }, ...ports.map((p) => ({ v: p, label: p }))]} width={132} />
            <span className="flex items-center gap-2 text-[12.5px] text-[#828d9d]">기간
              <Select value={sy} onChange={(y) => setStartYM(`${y}${sm}`)} opts={ymOpts(bounds, "y")} width={84} />
              <Select value={sm} onChange={(m) => setStartYM(`${sy}${m}`)} opts={ymOpts(bounds, "m")} width={70} />
              <span className="text-[#828d9d]">~</span>
              <Select value={ey} onChange={(y) => setEndYM(`${y}${em}`)} opts={ymOpts(bounds, "y")} width={84} />
              <Select value={em} onChange={(m) => setEndYM(`${ey}${m}`)} opts={ymOpts(bounds, "m")} width={70} />
            </span>
            <button type="button" onClick={reset} className="ml-auto cursor-pointer rounded-[8px] border border-[#d8dfe9] bg-white px-3.5 py-[7px] text-[12.5px] text-[#828d9d]">초기화</button>
          </div>

          {/* 운임 종합 판단 */}
          <div className={`mt-3.5 px-6 py-[22px] ${CARD}`}>
            <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
              <span className="text-[17px] font-extrabold text-[#1a2433]">운임 종합 판단</span>
              <span className="rounded-full border border-[#ccfbf1] bg-[#e9f8f4] px-2.5 py-1 text-[11px] font-semibold text-[#0d9488]">{origin} → {region} · {mode === "sea" ? "해상" : "항공"}</span>
              {regionAvg?.momMean != null && (
                <span className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-bold ${regionAvg.momMean >= 0 ? "border-[#c7ead6] bg-[#ecfdf3] text-[#067647]" : "border-[#fbd5d5] bg-[#fef2f2] text-[#dc2626]"}`}>{regionAvg.momMean >= 0 ? "▲ 상승" : "▼ 하락"}</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-4">
              {/* 1. 권역 평균 운임 */}
              <div className="rounded-[12px] border border-[#d8dfe9] bg-white px-4 py-[15px]">
                <div className="text-[11.5px] font-medium text-[#828d9d]">권역 평균 운임 {mode === "sea" ? `(${metric.toUpperCase()})` : "(kg300)"}</div>
                {regionAvg ? mode === "sea" ? (
                  <>
                    <div className="mt-[7px] text-[23px] font-extrabold tracking-[-0.02em] text-[#1a2433] lsg-mono">${Math.round(regionAvg.mean).toLocaleString()}</div>
                    <div className={`mt-[5px] text-[11.5px] ${(regionAvg.momMean ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{regionAvg.momMean != null ? `${regionAvg.momMean >= 0 ? "▲" : "▼"} MoM ${fmtPct(regionAvg.momMean)}` : "MoM 수집 중"} · 기준 {fmtMonth(regionAvg.ym)}</div>
                  </>
                ) : (
                  <>
                    <div className="mt-[7px] text-[20px] font-extrabold tracking-[-0.02em] text-[#1a2433] lsg-mono">{regionAvg.mean.toFixed(2)} USD/kg</div>
                    <div className="mt-[5px] text-[11px] leading-[1.5] text-[#828d9d]">{exchangeRate ? `₩${Math.round(regionAvg.mean * exchangeRate.usd_krw).toLocaleString("ko-KR")} 환산 · @${Math.round(exchangeRate.usd_krw).toLocaleString("ko-KR")} · ${fxDate}` : "환율 수집 중"}</div>
                    <div className={`mt-[3px] text-[11.5px] ${(regionAvg.momMean ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{regionAvg.momMean != null ? `MoM ${fmtPct(regionAvg.momMean)}` : "MoM 수집 중"} · 기준 {fmtMonth(regionAvg.ym)}</div>
                  </>
                ) : <div className="mt-[7px] text-[15px] font-semibold text-[#828d9d]">데이터 수집 중</div>}
              </div>
              {/* 2. 52주 백분위 (KCCI 지수 기준) */}
              <div className="rounded-[12px] border border-[#d8dfe9] bg-white px-4 py-[15px]">
                <div className="text-[11.5px] font-medium text-[#828d9d]">52주 백분위</div>
                {mode === "sea" && kcciPct != null ? (
                  <>
                    <div className="mt-[7px] text-[23px] font-extrabold tracking-[-0.02em] text-[#1a2433] lsg-mono">{Math.round(kcciPct)}%</div>
                    <div className="mt-[5px] text-[11.5px] text-[#d97706]">KCCI 지수 기준 · 최근 1년 내 위치</div>
                    <div className="mt-2.5 h-[6px] overflow-hidden rounded-[4px] bg-[#e2e8f1]"><i className="block h-full rounded-[4px]" style={{ width: `${kcciPct}%`, background: "linear-gradient(90deg,#0d9488,#2dd4bf)" }} /></div>
                  </>
                ) : <div className="mt-[7px] text-[15px] font-semibold text-[#828d9d]">데이터 수집 중</div>}
              </div>
              {/* 3. 스팟 대비 베이시스 — 방법론 미확정(SCFI 선행·후행/인과 단정 금지) */}
              <div className="rounded-[12px] border border-[#d8dfe9] bg-white px-4 py-[15px]">
                <div className="text-[11.5px] font-medium text-[#828d9d]">스팟 대비 (베이시스)</div>
                <div className="mt-[7px] text-[15px] font-semibold text-[#828d9d]">데이터 수집 중</div>
                <div className="mt-[5px] text-[11px] leading-[1.5] text-[#828d9d]">계약·스팟 베이시스는 방법론 확정 후 제공됩니다.</div>
              </div>
              {/* 4. 추세 */}
              <div className="rounded-[12px] border border-[#d8dfe9] bg-white px-4 py-[15px]">
                <div className="text-[11.5px] font-medium text-[#828d9d]">추세</div>
                {regionAvg && regionAvg.total > 0 ? (
                  <>
                    <div className={`mt-[7px] text-[23px] font-extrabold tracking-[-0.02em] ${regionAvg.up > regionAvg.total / 2 ? "text-[#16a34a]" : regionAvg.up < regionAvg.total / 2 ? "text-[#dc2626]" : "text-[#1a2433]"}`}>{regionAvg.up > regionAvg.total / 2 ? "상승 우세" : regionAvg.up < regionAvg.total / 2 ? "하락 우세" : "혼조"}</div>
                    <div className="mt-[5px] text-[11.5px] text-[#828d9d]">{regionAvg.total}개 레인 중 {regionAvg.up}개 상승 · MoM 기준</div>
                  </>
                ) : <div className="mt-[7px] text-[15px] font-semibold text-[#828d9d]">데이터 수집 중</div>}
              </div>
            </div>
            {/* AI 요약 — 발행·검수된 운임 전망(forecasts)에서만. 없으면 미표시. */}
            {reports.length > 0 && (
              <div className="mt-[18px] flex gap-3 rounded-[12px] border border-[#d4e6f2] bg-[#eef6fb] px-[17px] py-[15px]">
                <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] bg-[#3b82f6] text-[11px] font-bold text-white">AI</div>
                <div>
                  <b className="mb-1 block text-[13px] font-semibold text-[#1a2433]">AI 초안 · 에디터 검수</b>
                  <p className="text-[13px] leading-[1.55] text-[#54606f]">{[reports[0].lead, reports[0].outlook].filter(Boolean).join(" ")}</p>
                </div>
              </div>
            )}
          </div>

          {/* 주목 레인 · 시그널 */}
          <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">주목 레인 · 시그널</h2>
            <span className={CHIP}>자동 탐지 · MoM 변동률 상위</span>
          </div>
          {signals.length === 0 ? (
            <div className={`px-6 py-10 text-center ${CARD}`}><p className="text-[13px] font-semibold text-[#54606f]">데이터 수집 중</p><p className="mt-1 text-[12px] text-[#828d9d]">권역 노선의 월별 변동률이 확보되면 표시됩니다.</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-3">
              {signals.map((s) => {
                const kind = s.mom! >= 20 ? "up" : s.mom! <= -20 ? "dn" : s.mom! >= 0 ? "up" : "dn";
                const label = s.mom! >= 20 ? "급등 ▲" : s.mom! <= -20 ? "약세 ▼" : s.mom! >= 0 ? "상승 ▲" : "하락 ▼";
                return (
                  <div key={s.dest} className={`px-[18px] py-4 ${CARD}`}>
                    <div className="flex items-center gap-2"><span className="text-[14px] font-extrabold text-[#1a2433]">{origin} → {s.dest}</span><Badge kind={kind}>{label} {fmtPct(s.mom)}</Badge></div>
                    <div className="mt-2 text-[12px] text-[#54606f]">기준 <b className="font-bold text-[#1a2433]">{fmtMonth(s.ym)}</b> · 전월대비 변동</div>
                    <Spark vals={s.spark} color={kind === "dn" ? "#dc2626" : "#16a34a"} className="my-2 block h-8 w-full" />
                    <Link to="/forecasts" search={{ dir: [], series: [] }} className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0d9488]">운임 전망 보기 →</Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* 추이 + 히트맵 */}
          <div className="mt-[26px] grid grid-cols-1 gap-[18px] min-[1080px]:grid-cols-[1.15fr_1fr]">
            <div className={`px-[22px] py-5 ${CARD}`}>
              <CardHead
                title={portSelected ? `운임 추이 — ${origin} → ${port}` : `권역별 운임 추이 — ${region}`}
                chip={unitLabel}
                right={mode === "sea" ? <Seg a="FEU" b="TEU" value={metric === "feu" ? "FEU" : "TEU"} onChange={(v) => setMetric(v === "FEU" ? "feu" : "teu")} /> : undefined}
              />
              {band || (single && single.length >= 2) ? (
                <>
                  <RateChart band={band} single={single} cur={cur} />
                  <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11.5px] text-[#54606f]">
                    <LegendItem swatch={<i className="inline-block h-[3px] w-[14px] rounded bg-[#0d9488]" />} label={portSelected ? "노선 운임" : "권역 중앙값"} />
                    {!portSelected && <LegendItem swatch={<i className="inline-block h-[3px] w-[14px] rounded bg-[#cde7e3]" />} label="범위(최소–최대)" />}
                  </div>
                  {mode === "air" && fxCaption && <div className="mt-2 text-[11px] text-[#828d9d]">USD/kg 원본 · ₩ 환산 기준 {fxCaption}</div>}
                </>
              ) : (
                <div className="grid min-h-[180px] place-items-center text-[13px] text-[#828d9d]">선택 조건의 시계열이 2개월 이상 확보되면 표시됩니다.</div>
              )}
            </div>
            <div className={`px-[22px] py-5 ${CARD}`}>
              <CardHead title="전월대비 변동률 히트맵" chip={`${mode === "sea" ? "해상" : "항공"} · 최근 ${heatmap.months.length}개월`} />
              {heatmap.rows.length === 0 || heatmap.months.length < 2 ? (
                <div className="grid min-h-[180px] place-items-center text-[13px] text-[#828d9d]">월별 MoM 산출에 필요한 시계열이 확보되면 표시됩니다.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-1 text-[11.5px] lsg-mono">
                      <thead><tr><th />{heatmap.months.map((m) => <th key={m} className="p-0.5 text-center text-[10.5px] font-semibold text-[#828d9d]">{fmtMonth(m)}</th>)}</tr></thead>
                      <tbody>
                        {heatmap.rows.map((row) => (
                          <tr key={row.dest}>
                            <td className="whitespace-nowrap pr-1.5 text-left text-[12px] font-semibold text-[#1a2433]">{origin} → {row.dest}</td>
                            {row.cells.map((c, i) => <HeatCell key={i} v={c} />)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 text-[11px] text-[#828d9d]">상승 = 녹 · 하락 = 적 · 데이터 없는 달은 — 로 표시됩니다.</div>
                </>
              )}
            </div>
          </div>

          {/* 세부 운임 동향 */}
          <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">세부 운임 동향</h2>
            <span className={CHIP}>{portSelected ? `${origin} → ${port}` : `${region} 권역`} · 최근 1년 위치 포함</span>
          </div>
          <div className={`overflow-x-auto px-[22px] py-5 ${CARD}`}>
            {detailRows.length === 0 ? (
              <div className="grid min-h-[120px] place-items-center text-[13px] text-[#828d9d]">검색 결과가 없습니다.</div>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead><tr>
                  {["노선", "전월", "현재", "변동", "최근 1년 위치"].map((h, i) => (
                    <th key={h} className={`border-b border-[#d8dfe9] px-3.5 pb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#828d9d] ${i >= 1 && i <= 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {detailRows.map((r) => (
                    <tr key={r.dest}>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3.5"><div className="font-bold text-[#1a2433]">{origin} → {r.dest}</div><div className="mt-0.5 text-[11px] text-[#828d9d]">{fmtMonth(r.ym)} · {mode === "sea" ? `USD/${metric.toUpperCase()}` : "USD/kg"}</div></td>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-right text-[#1a2433] lsg-mono">{r.prev != null ? (mode === "sea" ? Math.round(r.prev).toLocaleString() : r.prev.toFixed(2)) : "—"}</td>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-right text-[#1a2433] lsg-mono">{r.cur != null ? (mode === "sea" ? Math.round(r.cur).toLocaleString() : r.cur.toFixed(2)) : "—"}</td>
                      <td className={`border-b border-[#e6ebf2] px-3.5 py-3.5 text-right font-bold lsg-mono ${r.mom == null ? "text-[#828d9d]" : r.mom >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{r.mom == null ? "—" : `${r.mom >= 0 ? "▲ " : "▼ "}${fmtPct(r.mom)}`}</td>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3.5"><RangeBar pos={r.pos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {mode === "air" && fxCaption && <div className="mt-3 text-[11px] text-[#828d9d]">항공 운임은 USD/kg 원본입니다 · ₩ 환산 기준 {fxCaption}</div>}
          </div>

          {/* 선사별 실시간 운임 — 해상 전용(실측 파트너 운임) */}
          {mode === "sea" && (
            <>
              <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5">
                <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">선사별 실시간 운임</h2>
                <span className={CHIP}>실측 · {region} · 권역 평균 대비 스프레드</span>
              </div>
              <div className={`overflow-x-auto px-[22px] py-5 ${CARD}`}>
                {carrierRows.length === 0 ? (
                  <div className="grid min-h-[120px] place-items-center text-[13px] text-[#828d9d]">{region} 권역에 실측 운임이 없습니다.</div>
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead><tr>
                      {["노선", "선사", "20'", "40'/HQ", "권역 평균 대비", "VALID UNTIL"].map((h, i) => (
                        <th key={h} className={`border-b border-[#d8dfe9] px-3.5 pb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#828d9d] ${i >= 2 && i <= 4 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {carrierRows.map((r) => {
                        const refFeu = regionAvg?.mean ?? null;
                        const d = refFeu && r.rate_40 != null ? Math.round(((r.rate_40 - refFeu) / refFeu) * 1000) / 10 : null;
                        const prem = (d ?? 0) >= 0;
                        return (
                          <tr key={r.id}>
                            <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 font-bold text-[#1a2433]">{(r.pol ?? "—")} → {(r.pod ?? "—")}</td>
                            <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-[#54606f]">{r.carrier ?? "—"}</td>
                            <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-right text-[#1a2433] lsg-mono">{r.rate_20 != null ? `$${Math.round(r.rate_20).toLocaleString()}` : "—"}</td>
                            <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-right text-[#1a2433] lsg-mono">{r.rate_40 != null ? `$${Math.round(r.rate_40).toLocaleString()}` : "—"}</td>
                            <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-right"><span className={`font-bold lsg-mono ${d == null ? "text-[#828d9d]" : prem ? "text-[#d97706]" : "text-[#0d9488]"}`}>{d == null ? "—" : `${prem ? "+" : ""}${d}%`}</span></td>
                            <td className="border-b border-[#e6ebf2] px-3.5 py-3.5 text-[#828d9d] lsg-mono">{r.sheet?.valid_until ? `~ ${r.sheet.valid_until}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* 글로벌 지수 + 최근 리포트 */}
          <div className="mt-[26px] grid grid-cols-1 gap-[18px] min-[1080px]:grid-cols-[1.15fr_1fr]">
            <div className={`px-[22px] py-5 ${CARD}`}>
              <CardHead title="글로벌 지수 추이" chip="SCFI · KCCI · BDI · WCI" />
              {trendData.length < 2 ? (
                <div className="grid min-h-[180px] place-items-center text-[13px] text-[#828d9d]">데이터 수집 중</div>
              ) : (
                <>
                  <IndexChart data={trendData} codes={["SCFI", "KCCI", "BDI", "WCI"]} colors={{ SCFI: "#2563eb", KCCI: "#0d9488", BDI: "#d97706", WCI: "#7c3aed" }} />
                  <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11.5px] text-[#54606f]">
                    {[["#2563eb", "SCFI"], ["#0d9488", "KCCI"], ["#d97706", "BDI"], ["#7c3aed", "WCI"]].map(([c, l]) => (
                      <LegendItem key={l} swatch={<i className="inline-block h-[3px] w-[14px] rounded" style={{ background: c }} />} label={l} />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className={`px-[22px] py-5 ${CARD}`}>
              <CardHead title="최근 리포트" chip="운임 전망" />
              {reports.length === 0 ? (
                <div className="grid min-h-[120px] place-items-center rounded-[12px] border border-dashed border-[#d8dfe9] text-center text-[13px] text-[#828d9d]">발행된 운임 전망 리포트가 아직 없습니다.</div>
              ) : (
                reports.map((r) => <ReportCard key={r.id} r={r} />)
              )}
              <div className="mt-2.5 rounded-[10px] border border-dashed border-[#d8dfe9] px-3.5 py-2.5 text-[11.5px] text-[#828d9d] lsg-mono">{fxCaption ? `환율 기준 ${fxCaption}` : "환율 수집 중"}</div>
            </div>
          </div>

          {/* KCCI 권역별 항로 — 한국(부산)발 13개 항로($/FEU). 종합 외 항로별 운임 노출(KOBC 주간). */}
          <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">KCCI 권역별 항로</h2>
            <span className={CHIP}>한국(부산)발 · $/FEU · 주간</span>
          </div>
          <div className={`overflow-x-auto px-[22px] py-5 ${CARD}`}>
            {kcciRoutes.filter((r) => r.latest_value != null).length === 0 ? (
              <div className="grid min-h-[120px] place-items-center text-[13px] text-[#828d9d]">데이터 수집 중</div>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead><tr>
                  {["항로", "최신값", "기준", "WoW", "MoM"].map((h, i) => (
                    <th key={h} className={`border-b border-[#d8dfe9] px-3.5 pb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#828d9d] ${i >= 1 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {kcciRoutes.filter((r) => r.latest_value != null).map((r) => (
                    <tr key={r.index_code}>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3 font-bold text-[#1a2433]">{KCCI_ROUTE_LABELS[r.index_code] ?? r.index_code}</td>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3 text-right text-[#1a2433] lsg-mono">${Math.round(r.latest_value!).toLocaleString()}{isStatLowOceanUsd(r.latest_value) && <StatBadge kind="stat" />}</td>
                      <td className="border-b border-[#e6ebf2] px-3.5 py-3 text-right text-[#828d9d] lsg-mono">{r.latest_date ? `${r.latest_date.slice(5, 7)}/${r.latest_date.slice(8, 10)}` : "—"}</td>
                      <td className={`border-b border-[#e6ebf2] px-3.5 py-3 text-right font-bold lsg-mono ${r.change_pct == null ? "text-[#828d9d]" : r.change_pct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(r.change_pct)}</td>
                      <td className={`border-b border-[#e6ebf2] px-3.5 py-3 text-right font-bold lsg-mono ${r.mom_pct == null ? "text-[#828d9d]" : r.mom_pct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(r.mom_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 text-[11px] text-[#828d9d]">출처: KOBC KCCI · 부산 출발 권역별 컨테이너 운임지수</div>
          </div>
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}

function ReportCard({ r }: { r: RateReport }) {
  const [open, setOpen] = useState(false);
  const hasOutlook = r.outlook.trim().length > 0;
  const chip = r.indexCode ? SERIES_LABEL[r.indexCode] : null;
  return (
    <div className="mb-2.5 rounded-[12px] border border-[#d8dfe9] bg-white px-4 py-3.5">
      <button type="button" onClick={() => hasOutlook && setOpen((v) => !v)} disabled={!hasOutlook} className="block w-full text-left">
        <div className="mb-1.5 flex items-center gap-2">
          <b className="text-[13.5px] font-extrabold text-[#1a2433]">{r.title}</b>
          {chip && <span className="rounded-full border border-[#ccfbf1] bg-[#e9f8f4] px-2 py-0.5 text-[10px] font-bold text-[#0d9488]">{chip}</span>}
          <span className="ml-auto text-[11px] text-[#828d9d] lsg-mono">{r.date}</span>
          {hasOutlook && <span className={`text-[10px] text-[#828d9d] transition-transform ${open ? "rotate-180" : ""}`}>▼</span>}
        </div>
        {r.lead && <p className="text-[12.5px] leading-[1.55] text-[#54606f]">{r.lead}</p>}
      </button>
      {open && hasOutlook && <p className="mt-2 text-[12.5px] leading-[1.6] text-[#1a2433]">{r.outlook}</p>}
    </div>
  );
}

// 선사별 실시간 운임 — 업로드·발행된 실측 파트너 운임(getPublishedPartnerRates)
type PartnerRateRow = {
  id: string;
  pol: string | null;
  pod: string | null;
  country: string | null;
  carrier: string | null;
  rate_20: number | null;
  rate_40: number | null;
  sheet?: { source: string | null; valid_until: string | null } | null;
};
