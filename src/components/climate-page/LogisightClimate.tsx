// 기후예측(Climate) 페이지 — 사용자 제공 샘플(LogisightClimate) 디자인을 실데이터에 연결.
// 핵심 지구본은 기존 실데이터 컴포넌트(RiskGlobe: assets/asset_risk/routes/events)를 재사용한다.
// 샘플의 합성 기상(SPOTS·하드코딩 KPI·임의 지연·타임스탬프)은 쓰지 않고, 실 리스크 데이터로 대체하거나
// 없으면 "데이터 수집 중"으로 표시(더미 수치 실데이터 행세 금지).
import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import { RiskGlobe } from "@/components/climate/RiskGlobe";
import {
  climateRiskQueryOptions,
  HDAYS,
  HCONF,
  type AssetRow,
  type ClimateForecastRow,
  type EventRow,
  type RiskRow,
  type RouteRow,
} from "@/lib/api/climate";
import {
  buildClimateForecastQuality,
  forecastQualityLabel,
  forecastQualityTone,
  formatForecastAge,
  type ClimateForecastQuality,
} from "@/lib/climate-quality";
import { GeoArticleSchema } from "@/components/geo/GeoArticleSchema";
import { gateEvent, type GateVerdict, type GateTier } from "@/lib/climate-gate";

/* ============================ STYLE ============================ */
const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";
const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const CHIP = "rounded-full border border-[#d8dfe9] bg-[#eef1f6] px-[9px] py-[3px] text-[11px] text-[#828d9d]";

const STYLE = `
.lsgc-root{font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
.lsgc-root tbody tr:hover{background:#eef2f8}
.lsgc-root ::-webkit-scrollbar{width:9px;height:9px}
.lsgc-root ::-webkit-scrollbar-track{background:transparent}
.lsgc-root ::-webkit-scrollbar-thumb{background:rgba(120,134,156,.45);border-radius:9px;border:2px solid transparent;background-clip:padding-box}
.lsgc-root ::-webkit-scrollbar-thumb:hover{background:rgba(120,134,156,.72);background-clip:padding-box}
.lsgc-root *{scrollbar-width:thin;scrollbar-color:rgba(120,134,156,.5) transparent}
.lsgc-crit .lsgc-pulse{animation:lsgcpulse 1.4s ease-out infinite}
@keyframes lsgcpulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}70%{box-shadow:0 0 0 7px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@media (prefers-reduced-motion:reduce){.lsgc-crit .lsgc-pulse{animation:none}}
`;

/* ============================ RISK HELPERS (실데이터) ============================ */
type Lv = "r" | "a" | "g";
const level = (s: number): Lv => (s >= 60 ? "r" : s >= 30 ? "a" : "g");
const levelKo = (c: Lv) => (c === "r" ? "경보" : c === "a" ? "주의" : "정상");
const rc = (c: Lv) => (c === "r" ? "#dc2626" : c === "a" ? "#d97706" : "#16a34a");
type RiskMap = Record<string, Record<number, RiskRow>>;
function buildRiskMap(rows: RiskRow[]): RiskMap {
  const m: RiskMap = {};
  for (const r of rows) (m[r.asset_id] ||= {})[r.horizon_days] = r;
  return m;
}
const riskAt = (rm: RiskMap, id: string, h: number) => rm[id]?.[HDAYS[h]]?.score ?? 0;
const driverAt = (rm: RiskMap, id: string, h: number) => {
  const row = rm[id]?.[HDAYS[h]];
  return row && row.score >= 30 ? row.driver || "정상" : "정상";
};

type RouteG = RouteRow & { keys: string[] };
function routeKeys(r: RouteRow): string[] {
  return (r.waypoints || []).filter((w): w is string => typeof w === "string");
}
function routeRisk(rm: RiskMap, r: RouteG, h: number): number {
  let m = 0;
  for (const k of r.keys) { const s = riskAt(rm, k, h); if (s > m) m = s; }
  return m;
}

// 이벤트 종류 표기(globe와 동일 매핑) + 지리 연결(실 이벤트 좌표 ↔ 노선 경로 근접).
const KIND_KO: Record<string, string> = { cyclone: "태풍", storm: "폭풍", flood: "홍수", snow: "폭설", drought: "가뭄", other: "기상경보" };
const EARTH_KM = 6371;
function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const t = Math.PI / 180;
  const dla = (lat2 - lat1) * t, dlo = (lon2 - lon1) * t;
  const x = Math.sin(dla / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dlo / 2) ** 2;
  return 2 * EARTH_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function coordsOf(wp: RouteRow["waypoints"], nodes: Record<string, AssetRow>): [number, number][] {
  return (wp || [])
    .map((w): [number, number] | null => (typeof w === "string" ? (nodes[w] ? [nodes[w].lon, nodes[w].lat] : null) : (w as [number, number])))
    .filter((c): c is [number, number] => !!c);
}
function routeCoords(r: RouteG, nodes: Record<string, AssetRow>): [number, number][] {
  return coordsOf(r.waypoints, nodes);
}
// 경로 거리(해리). 날짜변경선 점프는 제외(routeRisk와 동일 가드).
function routeDistanceNm(coords: [number, number][]): number {
  let km = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    if (Math.abs(b[0] - a[0]) < 180) km += hav(a[1], a[0], b[1], b[0]);
  }
  return Math.round(km / 1.852);
}
// 자산의 지금-시점 실측 기상 표기(파고·풍속) — 더미 아님.
function segWx(rm: RiskMap, id: string): string {
  const row = rm[id]?.[HDAYS[0]];
  if (!row) return "정상";
  if (row.score >= 30 && row.driver) return row.driver;
  const p: string[] = [];
  if (row.wave_height != null) p.push(`파고 ${row.wave_height}m`);
  if (row.wind_gust != null) p.push(`풍속 ${Math.round(row.wind_gust)}kt`);
  return p.join(" · ") || "정상";
}
type NearEv = { e: EventRow; km: number };
// 광역 시스템(태풍·폭풍)을 거리보다 우선 — 사용자가 가장 알고 싶어하는 영향 요인이므로.
const kindPriority = (k: string) => (k === "cyclone" ? 2 : k === "storm" ? 1 : 0);
function nearbyEvents(coords: [number, number][], events: EventRow[], km: number): NearEv[] {
  const out: NearEv[] = [];
  for (const e of events) {
    if (e.lon == null || e.lat == null) continue;
    let min = Infinity;
    for (const c of coords) { const d = hav(c[1], c[0], e.lat, e.lon); if (d < min) min = d; }
    if (min <= km) out.push({ e, km: Math.round(min) });
  }
  return out.sort(
    (a, b) =>
      (b.e.severity === "r" ? 1 : 0) - (a.e.severity === "r" ? 1 : 0) ||
      kindPriority(b.e.kind) - kindPriority(a.e.kind) ||
      a.km - b.km,
  );
}
function eventHasForecastSignal(e: EventRow): boolean {
  if (e.kind !== "cyclone") return false;
  if (Array.isArray(e.track)) return e.track.length > 1;
  if (typeof e.track === "string") {
    try {
      const parsed = JSON.parse(e.track);
      return Array.isArray(parsed) ? parsed.length > 1 : !!parsed;
    } catch {
      return false;
    }
  }
  return !!e.track && typeof e.track === "object";
}

// 희망봉 우회 아시아–유럽 항로 — routes 테이블엔 아직 없어 프론트에서 경로선을 보강해 지구본에 그린다.
// 경유점은 실 자산 id(malacca/colombo/goodhope/gibraltar/rotterdam) + 대양 구간 좌표. 리스크는 경유 자산의
// 실 asset_risk로 산출(임의 수치 아님). DB 영구 반영은 파이프라인 spec #4.
const CAPE_ROUTE: RouteRow = {
  id: "asia-europe-cape",
  name: "아시아–유럽 (희망봉 우회)",
  waypoints: ["malacca", "colombo", [78, -6], [55, -22], [33, -35], "goodhope", [6, -28], [-3, -8], [-13, 8], [-18, 20], [-13, 32], "gibraltar", [-8, 44], "rotterdam"] as RouteRow["waypoints"],
  chokes: ["malacca", "goodhope", "gibraltar"],
};

// 심각도 티어 — 소스별 규칙(HKO 태풍급 / GDACS·Meteoalarm 적색·주황). name·intensity는 title("이름 (강도)")에서 파싱.
type Tier = "CRITICAL" | "WARNING" | "INFO";
const NEAR_KM = 1000;
function parseIntensity(title: string | null): string | null {
  const m = (title || "").match(/\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}
function eventName(e: EventRow): string {
  return (e.title || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || (e.title || "이벤트");
}
function severityTier(e: EventRow): Tier {
  const src = (e.source || "").toLowerCase();
  const inten = (parseIntensity(e.title) || "").toLowerCase();
  if (src === "hko" && /(super\s+typhoon|severe\s+typhoon|typhoon)/.test(inten)) return "CRITICAL";
  if ((src === "gdacs" || src === "meteoalarm") && e.severity === "r") return "CRITICAL";
  if (src === "hko" && /severe\s+tropical\s+storm/.test(inten)) return "WARNING";
  if ((src === "gdacs" || src === "meteoalarm") && e.severity === "a") return "WARNING";
  return "INFO";
}
const tierRank = (t: Tier) => (t === "CRITICAL" ? 3 : t === "WARNING" ? 2 : 1);
function minDistToRoutes(e: EventRow, routes: RouteG[], nodes: Record<string, AssetRow>): number {
  if (e.lon == null || e.lat == null) return Infinity;
  let min = Infinity;
  for (const r of routes) for (const c of routeCoords(r, nodes)) { const d = hav(c[1], c[0], e.lat, e.lon); if (d < min) min = d; }
  return min;
}
function nearRouteCount(e: EventRow, routes: RouteG[], nodes: Record<string, AssetRow>, km: number): number {
  if (e.lon == null || e.lat == null) return 0;
  return routes.filter((r) => routeCoords(r, nodes).some((c) => hav(c[1], c[0], e.lat!, e.lon!) <= km)).length;
}

/* ============================ SMALL UI ============================ */
const LOGI_BADGE: Record<GateTier, { label: string; cls: string }> = {
  LINKED_HIGH: { label: "물류 연관", cls: "border-[#fbd5d5] bg-[#fef2f2] text-[#dc2626]" },
  LINKED_WATCH: { label: "연관 가능", cls: "border-[#fde6c8] bg-[#fff7ed] text-[#b45309]" },
  LIMITED: { label: "영향 제한적", cls: "border-[#d8dfe9] bg-[#eef1f6] text-[#828d9d]" },
};
function logiVerdictText(v: GateVerdict): string {
  if (v.tier === "LIMITED") return v.nearestAsset ? `최근접 ${v.nearestAsset.name} ~${v.nearestKm}km` : "물류 거점 원거리";
  const lead = v.linkedAssets[0]?.name ?? (v.linkedRoutes[0] ? `${v.linkedRoutes[0].name} 항로 인근` : "주요 항로 인근");
  const more = v.linkedAssets.length > 1 ? ` 외 ${v.linkedAssets.length - 1}곳` : "";
  return `${lead}${more}`;
}
function Spark({ vals, color, className }: { vals: number[]; color: string; className?: string }) {
  const rawId = useId();
  const id = "sp" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  if (vals.length < 2) return null;
  const w = 120, h = 30, min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Badge({ c, children }: { c: Lv; children: ReactNode }) {
  const cls = c === "r" ? "border-[#fbd5d5] bg-[#fef2f2] text-[#dc2626]" : c === "a" ? "border-[#fde6c8] bg-[#fff7ed] text-[#b45309]" : "border-[#c7ead6] bg-[#ecfdf3] text-[#067647]";
  return <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-[3px] text-[11px] font-bold ${cls}`}>{children}</span>;
}

/* ============================ HERO + GLOBE ============================ */
function HeroAndGlobe({ data, pills, forecastQuality }: { data: Parameters<typeof RiskGlobe>[0]["data"]; pills: { c: string; t: ReactNode }[]; forecastQuality: ClimateForecastQuality }) {
  return (
    <section className="relative overflow-hidden bg-[#070b16]">
      <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[500px] w-[900px] -translate-x-1/2" style={{ background: "radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)" }} />
      <div className={`${WRAP} relative z-[1]`}>
        <div className="pt-12 pb-[22px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">Global Climate Forecast</span>
          <h1 className="mt-3 text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#e9eef7]">세계 기후 예측</h1>
          <p className="mt-3.5 max-w-[620px] text-[15px] leading-[1.6] text-[#93a1b7]">전 세계 항만·주요 해협·내륙 철도 거점의 기상 리스크를 AI 예보 기반, 영향을 받는 노선과 리스크를 감지합니다.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {pills.map((p, i) => <span key={i} className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]"><span className={`h-[7px] w-[7px] rounded-full ${p.c}`} />{p.t}</span>)}
          </div>
          <div id="climate-globe" className="mt-3.5 scroll-mt-[80px] pb-14"><RiskGlobe data={data} forecastQuality={forecastQuality} /></div>
        </div>
      </div>
    </section>
  );
}

/* ============================ LIGHT BODY ============================ */
function Kpis({ items }: { items: { lab: string; v: string; c: string; s: string }[] }) {
  return (
    <div className="mt-[22px] grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-4">
      {items.map((k, i) => (
        <div key={i} className={`px-[18px] py-4 ${CARD}`}>
          <div className="text-[11.5px] text-[#828d9d]">{k.lab}</div>
          <div className="mt-[7px] lsg-mono text-[26px] font-extrabold tracking-[-0.02em]" style={{ color: k.c }}>{k.v}</div>
          <div className="mt-1 text-[11.5px] text-[#828d9d]">{k.s}</div>
        </div>
      ))}
    </div>
  );
}

function ForecastQualityPanel({ quality }: { quality: ClimateForecastQuality }) {
  const tone = forecastQualityTone(quality.status);
  const issues = [...new Set(quality.horizons.flatMap((h) => h.issues))].slice(0, 3);
  return (
    <section className={`mt-3.5 border px-[18px] py-4 ${CARD} ${tone.border} ${tone.bg}`}>
      <div className="flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between">
        <div>
          <div className={`inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] ${tone.text}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            예보 데이터 상태
          </div>
          <h2 className="mt-1 text-[16px] font-extrabold tracking-[-0.02em] text-[#1a2433]">{forecastQualityLabel(quality.status)}</h2>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[#54606f]">
            지도의 자산·항로 색상은 선택한 시점의 기상 예보로 산출한 리스크 등급입니다. 태풍·지진 등 실제 발생 이벤트는 별도 핀으로 표시되며, 그 시점의 예보가 없으면 색상은 표시하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quality.horizons.map((h) => {
            const hTone = forecastQualityTone(h.status);
            return (
              <span key={h.horizonDays} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-[6px] text-[11.5px] font-semibold ${hTone.border} ${hTone.bg} ${hTone.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${hTone.dot}`} />
                {h.label} · {forecastQualityLabel(h.status)}
              </span>
            );
          })}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-black/10 pt-3 min-[760px]:grid-cols-3">
        <div>
          <div className="text-[10.5px] font-bold text-[#828d9d]">최종 갱신</div>
          <div className="mt-1 lsg-mono text-[13px] font-bold text-[#1a2433]">{formatForecastAge(quality.latestAgeHours)}</div>
        </div>
        <div>
          <div className="text-[10.5px] font-bold text-[#828d9d]">커버리지</div>
          <div className="mt-1 text-[13px] font-bold text-[#1a2433]">{quality.horizons.every((h) => h.rows === h.expectedRows) ? "전체 자산 수신" : "일부 자산 누락"}</div>
        </div>
        <div>
          <div className="text-[10.5px] font-bold text-[#828d9d]">주의 항목</div>
          <div className="mt-1 text-[12.5px] leading-[1.45] text-[#54606f]">{issues.length ? issues.join(" · ") : "없음"}</div>
        </div>
      </div>
    </section>
  );
}

// 전 노선 상시 모니터링 — DB의 모든 주력 항로를 평가하고, 리스크가 오른 노선만 상세 카드로 펼친다.
// 정상 노선은 하단에 요약 칩으로 표시(전체를 보고 있음을 명시 + 문제 노선에 집중). 거리·수에즈 대비는 실 지오메트리 기반.
function RouteMonitor({ rm, routes, suez, nodes }: { rm: RiskMap; routes: RouteG[]; suez: RouteG | null; nodes: Record<string, AssetRow> }) {
  if (routes.length === 0) return null;
  const fromMalacca = (r: RouteG | null) => {
    if (!r) return null;
    const i = (r.waypoints || []).findIndex((w) => w === "malacca");
    return i < 0 ? null : routeDistanceNm(coordsOf((r.waypoints || []).slice(i), nodes));
  };
  const suezMal = fromMalacca(suez);
  const summaries = routes
    .map((r) => {
      const segs = r.keys.map((k) => ({ a: nodes[k], c: level(riskAt(rm, k, 0)), wx: segWx(rm, k) })).filter((s) => s.a);
      const maxRisk = routeRisk(rm, r, 0);
      const overall = level(maxRisk);
      const worst = [...segs].sort((a, b) => riskAt(rm, b.a.id, 0) - riskAt(rm, a.a.id, 0))[0];
      const worstRow = worst ? rm[worst.a.id]?.[HDAYS[0]] : undefined;
      const totalNm = routeDistanceNm(coordsOf(r.waypoints, nodes));
      const isCape = r.keys.includes("goodhope") || /희망봉|우회/.test(r.name);
      const capeMal = isCape ? fromMalacca(r) : null;
      const vsSuez = isCape && capeMal != null && suezMal != null ? capeMal - suezMal : null;
      return { r, segs, maxRisk, overall, worst, worstRow, totalNm, isCape, vsSuez };
    })
    .sort((a, b) => b.maxRisk - a.maxRisk);
  const elevated = summaries.filter((s) => s.overall !== "g");
  const normal = summaries.filter((s) => s.overall === "g");
  const counts: Record<Lv, number> = { r: 0, a: 0, g: 0 };
  for (const s of summaries) counts[s.overall] += 1;
  const Dot = ({ c }: { c: Lv }) => <span className="inline-block h-2 w-2 rounded-full" style={{ background: rc(c) }} />;
  return (
    <>
      <div className="mb-3 mt-[26px] flex items-center justify-between gap-2.5">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">주요 항로 모니터링</h2>
        <span className={CHIP}>전 {summaries.length}개 노선 · 지금 시점</span>
      </div>
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-[#54606f]">
        <span>주력 항로 <b className="text-[#1a2433]">{summaries.length}개</b> 상시 모니터링</span>
        <span className="inline-flex items-center gap-1.5"><Dot c="g" />정상 {counts.g}</span>
        <span className="inline-flex items-center gap-1.5"><Dot c="a" />주의 {counts.a}</span>
        <span className="inline-flex items-center gap-1.5"><Dot c="r" />경보 {counts.r}</span>
      </div>

      {elevated.length === 0 ? (
        <div className={`border-l-[3px] border-l-[#16a34a] px-6 py-5 ${CARD}`}>
          <b className="text-[14px] font-extrabold text-[#067647]">전 노선 정상 범위</b>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[#54606f]">현재 모니터링 중인 {summaries.length}개 항로 모두 실측 기상 기준 정상 범위입니다. 특정 노선의 리스크가 상승하면 해당 노선이 상세 카드로 펼쳐집니다.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {elevated.map(({ r, segs, maxRisk, overall, worst, worstRow, totalNm, isCape, vsSuez }) => {
            const kpis: { k: string; v: string; c?: string }[] = [
              { k: "총 항로 거리", v: `~${totalNm.toLocaleString()} nm` },
              ...(isCape && vsSuez != null ? [{ k: "수에즈 대비", v: `+${vsSuez.toLocaleString()} nm`, c: vsSuez > 0 ? "#b45309" : undefined }] : []),
              { k: "통과 주요 해협", v: `${(r.chokes || []).length}개` },
              { k: "최대 리스크", v: String(maxRisk), c: rc(overall) },
              { k: "예보 신뢰도", v: `${HCONF[0]}%` },
            ];
            return (
              <div key={r.id} className={`border-l-[3px] px-6 py-[22px] ${CARD}`} style={{ borderLeftColor: rc(overall) }}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {isCape && <span className="rounded-full border border-[#bae6fd] bg-[#e0f2fe] px-[9px] py-[3px] text-[11px] font-bold text-[#0369a1]">수에즈 우회</span>}
                    <b className="text-[15px] font-extrabold text-[#1a2433]">{r.name}</b>
                  </div>
                  <Badge c={overall}>종합 {levelKo(overall)} · 최대 리스크 {maxRisk}</Badge>
                </div>
                {segs.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {segs.map((s, i) => (
                      <div key={s.a.id} className="contents">
                        <div className="flex flex-none items-center gap-2"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: rc(s.c) }} /><div><b className="block whitespace-nowrap text-[12.5px] font-bold text-[#1a2433]">{s.a.name}</b><span className="whitespace-nowrap text-[11px] text-[#828d9d]">{s.wx}</span></div></div>
                        {i < segs.length - 1 && <div className="h-0.5 min-w-[24px] flex-1" style={{ background: "repeating-linear-gradient(90deg,#cbd5e1 0 6px,transparent 6px 12px)" }} />}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-[18px] grid grid-cols-2 gap-3 border-t border-[#d8dfe9] pt-4 min-[640px]:grid-cols-5">
                  {kpis.map((m, i) => <div key={i} className="flex flex-col gap-1"><span className="text-[11px] text-[#828d9d]">{m.k}</span><b className="lsg-mono text-[17px] font-extrabold tracking-[-0.02em]" style={{ color: m.c || "#1a2433" }}>{m.v}</b></div>)}
                </div>
                {worst && worst.c !== "g" && (
                  <p className="mt-4 text-[12.5px] leading-[1.55] text-[#54606f]">
                    현재 주요 리스크 요인: <b className="text-[#b45309]">{worst.a.name} · {worst.wx}</b>{worstRow?.wave_height != null ? <> (파고 {worstRow.wave_height}m)</> : null}.
                    {isCape ? " 홍해·수에즈 통항 리스크 시 아시아–유럽 컨테이너의 주력 우회 항로입니다." : ""}
                    {" "}선박 추적·실 소요일·예상 지연은 미연동(데이터 수집 중)입니다.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {normal.length > 0 && (
        <div className="mt-3.5 grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-3">
          {normal.map(({ r, maxRisk, totalNm, isCape }) => (
            <div key={r.id} className={`px-4 py-[15px] ${CARD}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-bold text-[#1a2433]">{r.name}</span><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: rc("g") }} /></div>
              <div className="mt-1.5 text-[11px] text-[#828d9d]">~{totalNm.toLocaleString()} nm · 통과 해협 {(r.chokes || []).length}개{isCape ? " · 수에즈 우회" : ""}</div>
              <span className="mt-2 inline-block rounded-[6px] bg-[#ecfdf3] px-2 py-[3px] text-[10.5px] font-bold text-[#067647]">정상 · 최대 {maxRisk}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ===== published climate forecast(AI 분석) — read만, 카드 보강 ===== */
// metric_ref='climate:<route>:<event>:<via>' → route id
function fcRouteId(ref: string | null): string | null {
  if (!ref) return null;
  const p = ref.split(":");
  return p[0] === "climate" && p[1] ? p[1] : null;
}
// basis "걸린 관문: 미야코해협 · 100km · …" → 관문명
function fcVia(basis: string[] | null): string | null {
  const line = (basis || []).find((b) => b.startsWith("걸린 관문:"));
  return line ? line.replace("걸린 관문:", "").split("·")[0].trim() || null : null;
}
// statement "[기상 리스크 변화]\n…\n\n[영향]\n…" → {weather, impact}
function fcSections(statement: string): { weather: string; impact: string } {
  const W = "[기상 리스크 변화]", I = "[영향]";
  const ii = statement.indexOf(I);
  if (ii < 0) return { weather: statement.replace(W, "").trim(), impact: "" };
  const wi = statement.indexOf(W);
  return {
    weather: statement.slice(wi >= 0 ? wi + W.length : 0, ii).trim(),
    impact: statement.slice(ii + I.length).trim(),
  };
}
function fcAction(note: string | null): string {
  return (note || "").replace("[권장 행동]", "").trim();
}
function fcSummary(weather: string): string {
  const first = weather.split(/(?<=[.。])\s/)[0] || weather;
  return first.length > 160 ? `${first.slice(0, 160).trim()}…` : first;
}
function RouteForecast({ fc }: { fc: ClimateForecastRow }) {
  const [open, setOpen] = useState(false);
  const via = fcVia(fc.basis);
  const { weather, impact } = fcSections(fc.statement);
  const action = fcAction(fc.impact_note);
  const sections: [string, string][] = [["기상", weather], ["영향", impact], ["권장 행동", action]];
  return (
    <div className="mt-3 rounded-[8px] border border-[#bfe6e0] bg-[#f0faf8] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-[5px] bg-[#0d9488] px-1.5 py-[2px] text-[10px] font-extrabold tracking-[0.04em] text-white">AI 분석</span>
        {via && <span className="text-[11px] font-semibold text-[#0f766e]">via {via}</span>}
      </div>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-[#334155]">{fcSummary(weather)}</p>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-[11px] font-semibold text-[#0d9488] hover:underline">
        {open ? "접기 ▲" : "상세 보기 ▾"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-[#cfe9e4] pt-2">
          {sections.filter(([, t]) => t).map(([lab, t]) => (
            <div key={lab}>
              <div className="text-[10.5px] font-bold text-[#0f766e]">{lab}</div>
              <p className="mt-0.5 text-[12px] leading-[1.55] text-[#475569]">{t}</p>
            </div>
          ))}
          <div className="text-[10.5px] text-[#94a3b8]">AI 자동 분석 · 코드 가드 검증 · 트랙 교차판정 기반</div>
        </div>
      )}
    </div>
  );
}

function Impact({ rm, routes, events, nodes, forecasts }: { rm: RiskMap; routes: RouteG[]; events: EventRow[]; nodes: Record<string, AssetRow>; forecasts: ClimateForecastRow[] }) {
  // route id → 발행된 climate forecast. 이 섹션은 관측 이벤트 전체가 아니라 예보 산출물/track 중심으로 선정한다.
  const fcByRoute: Record<string, ClimateForecastRow> = {};
  for (const f of forecasts) { const rid = fcRouteId(f.metric_ref); if (rid && !fcByRoute[rid]) fcByRoute[rid] = f; }
  const forecastEvents = events.filter(eventHasForecastSignal);
  const ROUTE_KM = NEAR_KM; // 노선 경로점 기준 이벤트 근접 반경
  const rows = routes
    .map((r) => {
      const base = routeRisk(rm, r, 0);
      const forecast = fcByRoute[r.id] ?? null;
      const evs = nearbyEvents(routeCoords(r, nodes), forecastEvents, ROUTE_KM).map((x) => ({ ...x, tier: severityTier(x.e) }));
      const worst = evs.reduce((m, x) => Math.max(m, tierRank(x.tier)), 0); // 0=없음
      // 카드 대표 이벤트 = 최상위 티어 → 동순위는 근접순. (asset_risk 점수가 아니라 이벤트 심각도+근접 기준)
      const lead = [...evs].sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || a.km - b.km)[0] ?? null;
      return { r, base, evs, lead, worst, forecast };
    })
    // 카드 노출은 '현재 살아있는 신호'만으로 결정 — 발행된 forecast는 삭제 불가(CLAUDE.md)라
    // 그것만으로 노출하면 태풍이 지나가도 카드가 영구히 남는다. forecast는 살아있는 노선에만 덧붙이는 보강 정보.
    .filter((x) => x.worst >= 1 || x.base >= 30)
    .sort((a, b) => (b.forecast ? 1 : 0) - (a.forecast ? 1 : 0) || b.worst - a.worst || (a.lead?.km ?? 1e9) - (b.lead?.km ?? 1e9) || b.base - a.base)
    .slice(0, 3);
  if (rows.length === 0) return null;
  return (
    <>
      <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5"><h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">예보 리스크 → 영향 노선</h2><span className={CHIP}>asset_risk 예보 · track/AI 분석 우선</span></div>
      <div className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-3">
        {rows.map(({ r, base, evs, lead, worst, forecast }) => {
          const crit = worst === 3;
          const c: Lv = crit ? "r" : worst === 2 || evs.length ? "a" : level(base);
          const tag = forecast ? "AI 예보 연결" : crit ? "경보 · 예보 track" : worst === 2 ? "주의 · 예보 track" : evs.length ? "track 주시" : "영향 낮음";
          const traj = HDAYS.map((_, h) => routeRisk(rm, r, h));
          const chk = (r.chokes || []).join(" · ") || "—";
          const inten = lead ? parseIntensity(lead.e.title) : null;
          return (
            <div key={r.id} className={`p-[18px] ${CARD} ${crit ? "!border-[#dc2626] !border-2 shadow-[0_0_0_1px_#dc2626,0_8px_22px_-12px_rgba(220,38,38,0.5)]" : ""}`}>
              {crit && <div className="-mx-[18px] -mt-[18px] mb-3 rounded-t-[13px] bg-[#dc2626] px-[18px] py-1.5 text-[11px] font-extrabold tracking-[0.06em] text-white">🚨 CRITICAL · 심각 기상 접근</div>}
              <div className="flex items-center gap-2"><span className="text-[14px] font-extrabold text-[#1a2433]">{r.name}</span><Badge c={c}>{tag}</Badge></div>
              {lead ? (
                <div className="mt-2.5 text-[12px] leading-[1.5] text-[#54606f]">
                  <b className={`font-bold ${crit ? "text-[#dc2626]" : "text-[#1a2433]"}`}>
                    {crit && inten ? `${inten} ` : ""}{eventName(lead.e)}{!crit ? ` · ${KIND_KO[lead.e.kind] || lead.e.kind}` : ""} · {lead.e.area || "—"}
                  </b> 인근 ~{lead.km}km{evs.length > 1 ? ` 외 ${evs.length - 1}건` : ""}
                  {crit ? " — 통과 구간 위협 접근, 통항 시점·우회 검토" : " — 영향 구간 ETA 버퍼 권고"}
                </div>
              ) : (
                <div className="mt-2.5 text-[12px] leading-[1.5] text-[#54606f]">통과 주요 해협 <b className="font-bold text-[#1a2433]">{chk}</b> · 자산 기상 리스크 상승</div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-[6px] border border-[#d8dfe9] bg-[#eef1f6] px-2 py-[3px] text-[11px] text-[#54606f] lsg-mono">노선 리스크 {base}</span>
                {evs.length > 0 && <span className="rounded-[6px] border border-[#fde6c8] bg-[#fff7ed] px-2 py-[3px] text-[11px] font-semibold text-[#b45309]">예보 track {evs.length}건 인근</span>}
              </div>
              <Spark vals={traj} color={rc(c)} className="my-2.5 block h-[30px] w-full" />
              {forecast && <RouteForecast fc={forecast} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

// 관측 경보 → 물류 영향. 게이트가 LINKED인 이벤트만 카드화(LIMITED은 타임라인 배지가 담당).
// published 이벤트 forecast(metric_ref='climate:event:<id>')가 있으면 AI 3단 서술을 RouteForecast로 표시.
function RegionImpact({ events, assets, routes, nodes, forecasts }: { events: EventRow[]; assets: AssetRow[]; routes: RouteG[]; nodes: Record<string, AssetRow>; forecasts: ClimateForecastRow[] }) {
  const fcByEvent: Record<string, ClimateForecastRow> = {};
  const PFX = "climate:event:";
  for (const f of forecasts) {
    const ref = f.metric_ref ?? "";
    if (ref.startsWith(PFX)) { const eid = ref.slice(PFX.length); if (eid && !fcByEvent[eid]) fcByEvent[eid] = f; }
  }
  const linked = events
    .map((e) => ({ e, v: gateEvent(e, assets, routes, nodes), fc: fcByEvent[e.id] ?? null }))
    .filter((x) => x.v.tier !== "LIMITED")
    .sort((a, b) => (a.v.tier === "LINKED_HIGH" ? 0 : 1) - (b.v.tier === "LINKED_HIGH" ? 0 : 1) || (a.v.nearestKm ?? 1e9) - (b.v.nearestKm ?? 1e9))
    .slice(0, 6);
  if (linked.length === 0) return null;
  return (
    <>
      <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5"><h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">지역 경보 → 물류 영향</h2><span className={CHIP}>관측 경보 · 물류 거점 근접</span></div>
      <div className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-2">
        {linked.map(({ e, v, fc }) => {
          const b = LOGI_BADGE[v.tier];
          const sev: Lv = e.severity === "r" ? "r" : "a";
          return (
            <div key={e.id} className={`p-[18px] ${CARD}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-extrabold text-[#1a2433]">{eventName(e)}</span>
                <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-[3px] text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                <Badge c={sev}>{KIND_KO[e.kind] || e.kind}</Badge>
              </div>
              <div className="mt-2 text-[12px] leading-[1.5] text-[#54606f]">
                {e.area ? <><b className="font-bold text-[#1a2433]">{e.area}</b> · </> : null}{e.source.toUpperCase()} · {logiVerdictText(v)}
              </div>
              {v.linkedAssets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.linkedAssets.slice(0, 4).map((la) => (
                    <span key={la.id} className="rounded-[6px] border border-[#d8dfe9] bg-[#eef1f6] px-2 py-[3px] text-[11px] text-[#54606f] lsg-mono">{la.name} ~{la.km}km</span>
                  ))}
                </div>
              )}
              {fc ? <RouteForecast fc={fc} /> : <div className="mt-3 rounded-[8px] border border-[#e6ebf2] bg-[#f6f8fb] px-3 py-2 text-[11.5px] text-[#828d9d]">AI 영향 분석 검수 중 — 발행되면 여기에 표시됩니다.</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// 최상단 CRITICAL 배너 — 심각 이벤트(태풍 등)가 노선 인근(≤1000km)에 있을 때. 문구는 '접근/위협'.
function CriticalBanner({ events, routes, nodes }: { events: EventRow[]; routes: RouteG[]; nodes: Record<string, AssetRow> }) {
  const [closedId, setClosed] = useState<string | null>(null);
  const crit = events
    .map((e) => ({ e, dist: minDistToRoutes(e, routes, nodes) }))
    .filter((x) => severityTier(x.e) === "CRITICAL" && x.dist <= NEAR_KM)
    .sort((a, b) => a.dist - b.dist);
  if (crit.length === 0) return null;
  const top = crit[0].e;
  if (closedId === top.id) return null; // 닫아도 새 CRITICAL(다른 id) 시 재노출
  const inten = parseIntensity(top.title);
  const k = nearRouteCount(top, routes, nodes, NEAR_KM);
  const more = crit.length - 1;
  return (
    <div className="lsgc-crit relative z-[40] w-full border-y border-[#7f1d1d] bg-gradient-to-r from-[#b91c1c] to-[#dc2626] text-white">
      <div className={`${WRAP} flex items-center gap-3 py-2.5`}>
        <span className="lsgc-pulse inline-flex h-2.5 w-2.5 flex-none rounded-full bg-white" />
        <span className="flex-none text-[13px] font-extrabold tracking-[0.06em]">🚨 CRITICAL</span>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          <b className="font-extrabold">{eventName(top)}{inten ? ` (${inten})` : ""}</b> {top.area || ""} 방면 접근 · 인근 노선 {k}개{more > 0 ? ` · 외 ${more}건` : ""}
        </span>
        <a href="#climate-globe" className="flex-none rounded-[6px] border border-white/40 px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-white/10">지도에서 보기</a>
        {top.url && <a href={top.url} target="_blank" rel="noopener noreferrer" className="flex-none text-[12px] underline opacity-90 hover:opacity-100">출처</a>}
        <button type="button" onClick={() => setClosed(top.id)} aria-label="배너 닫기" className="flex-none rounded p-1 text-[14px] leading-none text-white/80 hover:text-white">✕</button>
      </div>
    </div>
  );
}

function Straits({ rm, chokes, routes }: { rm: RiskMap; chokes: AssetRow[]; routes: RouteG[] }) {
  if (chokes.length === 0) return null;
  const passCount = (id: string) => routes.filter((r) => (r.chokes || []).includes(id) || r.keys.includes(id)).length;
  const wx = (id: string) => {
    const row = rm[id]?.[HDAYS[0]];
    if (!row) return "데이터 수집 중";
    const parts: string[] = [];
    if (row.wind_gust != null) parts.push(`풍속 ${Math.round(row.wind_gust)}kt`);
    if (row.wave_height != null) parts.push(`파고 ${row.wave_height}m`);
    if (parts.length === 0 && row.driver) return row.score >= 30 ? row.driver : "안정";
    return parts.join(" · ") || "안정";
  };
  const sorted = [...chokes].sort((a, b) => riskAt(rm, b.id, 0) - riskAt(rm, a.id, 0));
  return (
    <>
      <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5"><h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">주요 해협 리스크 보드</h2><span className={CHIP}>통과 노선 기준 · 지금</span></div>
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-5">
        {sorted.map((s) => {
          const c = level(riskAt(rm, s.id, 0));
          return (
            <div key={s.id} className={`px-4 py-[15px] ${CARD}`}>
              <div className="flex items-center justify-between"><span className="text-[13.5px] font-extrabold text-[#1a2433]">{s.name}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: rc(c) }} /></div>
              <div className="mt-2 text-[11.5px] text-[#54606f]">통과 노선 <b className="font-bold text-[#1a2433]">{passCount(s.id)}개</b></div>
              <div className="mt-1.5 text-[11px] text-[#828d9d]">{wx(s.id)}</div>
              <span className={`mt-2.5 inline-block rounded-[6px] px-2 py-[3px] text-[10.5px] font-bold ${c === "g" ? "bg-[#ecfdf3] text-[#067647]" : c === "a" ? "bg-[#fff7ed] text-[#b45309]" : "bg-[#fef2f2] text-[#dc2626]"}`}>{levelKo(c)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Timeline({ events, assets, routes, nodes }: { events: EventRow[]; assets: AssetRow[]; routes: RouteG[]; nodes: Record<string, AssetRow> }) {
  const [filter, setFilter] = useState<"all" | "r" | "a">("all");
  const verdicts = useMemo(() => {
    const m: Record<string, GateVerdict> = {};
    for (const e of events) m[e.id] = gateEvent(e, assets, routes, nodes);
    return m;
  }, [events, assets, routes, nodes]);
  if (events.length === 0) return null;
  // 태풍·폭풍 등 광역 시스템을 상단에 노출(다수의 홍수 경보에 묻히지 않게), 그 뒤 경보>주의 순.
  const kp = (k: string) => (k === "cyclone" ? 3 : k === "storm" ? 2 : 1);
  const ordered = [...events].sort((a, b) => kp(b.kind) - kp(a.kind) || (b.severity === "r" ? 1 : 0) - (a.severity === "r" ? 1 : 0));
  const shown = ordered.filter((e) => filter === "all" || e.severity === filter).slice(0, 12);
  const sources = [...new Set(events.map((e) => e.source.toUpperCase()))].slice(0, 4).join(" · ");
  return (
    <>
      <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5"><h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">현재 관측/경보 이벤트</h2><span className={CHIP}>{sources || "감지 소스"} · 예보 점수와 분리</span></div>
      <div className={`${CARD} py-2`}>
        <div className="flex gap-1.5 px-[18px] pb-1.5 pt-3.5">
          {([["all", "전체"], ["r", "경보"], ["a", "주의"]] as [typeof filter, string][]).map(([k, lbl]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={k === filter ? "rounded-full border border-[#0e1626] bg-[#0e1626] px-3 py-[5px] text-[12px] font-semibold text-white" : "rounded-full border border-[#d8dfe9] bg-white px-3 py-[5px] text-[12px] text-[#54606f]"}>{lbl}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="px-[18px] py-6 text-center text-[12.5px] text-[#828d9d]">해당 등급의 활성 이벤트가 없습니다.</div>
        ) : shown.map((e, i) => {
          const sev: Lv = e.severity === "r" ? "r" : "a";
          const v = verdicts[e.id];
          if (!v) return null; // 모든 행은 verdicts에 키가 있으나 방어적 가드
          const b = LOGI_BADGE[v.tier];
          return (
            <div key={e.id ?? i} className="grid grid-cols-1 items-center gap-3 border-t border-[#e6ebf2] px-[18px] py-3 min-[640px]:grid-cols-[90px_70px_1fr_auto]">
              <span className="lsg-mono text-[11.5px] text-[#828d9d]">{KIND_KO[e.kind] || e.kind || "경보"}</span>
              <span className={`rounded-[6px] px-2 py-[3px] text-center text-[10px] font-bold ${sev === "r" ? "border border-[#fbd5d5] bg-[#fef2f2] text-[#b42318]" : "border border-[#fde6c8] bg-[#fff7ed] text-[#b45309]"}`}>{sev === "r" ? "경보" : "주의"}</span>
              <span className="text-[13px] text-[#1a2433]">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#0d9488]">{e.title}</a> : e.title}{e.area ? <small className="ml-1 font-normal text-[#828d9d]">· {e.area}</small> : null}</span>
              <span className="flex items-center gap-2 text-[11px] text-[#828d9d]">
                <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-[3px] text-[10px] font-bold ${b.cls}`} title={logiVerdictText(v)}>
                  {b.label}
                </span>
                <span className="whitespace-nowrap">{e.source.toUpperCase()}</span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ============================ PAGE ============================ */
export function LogisightClimate() {
  const { data } = useSuspenseQuery(climateRiskQueryOptions());
  const forecastQuality = buildClimateForecastQuality(data);
  const forecastTone = forecastQualityTone(forecastQuality.status);

  const rm = buildRiskMap(data.risk);
  const nodes: Record<string, AssetRow> = Object.fromEntries(data.assets.map((a) => [a.id, a]));
  // goodhope 자산이 있고 DB에 희망봉 노선이 없으면 경로선을 보강해 지구본·분석에 함께 반영.
  const hasGoodhope = data.assets.some((a) => a.id === "goodhope");
  const routeRows: RouteRow[] =
    hasGoodhope && !data.routes.some((r) => r.id === CAPE_ROUTE.id || /희망봉/.test(r.name))
      ? [...data.routes, CAPE_ROUTE]
      : data.routes;
  const globeData = { ...data, routes: routeRows };
  const routesG: RouteG[] = routeRows.map((r) => ({ ...r, keys: routeKeys(r) }));
  const chokes = data.assets.filter((a) => a.type === "choke");

  // KPI (지금 시점)
  const cautionAssets = data.assets.filter((a) => level(riskAt(rm, a.id, 0)) === "a").length;
  const alertAssets = data.assets.filter((a) => level(riskAt(rm, a.id, 0)) === "r").length;
  const alertEvents = data.events.filter((e) => e.severity === "r").length;
  const topCaution = [...data.assets].filter((a) => level(riskAt(rm, a.id, 0)) === "a").sort((a, b) => riskAt(rm, b.id, 0) - riskAt(rm, a.id, 0))[0];
  // 대표 이벤트 = 심각도 티어 최상위(동순위는 노선 근접순) — 임의 첫 이벤트 대신.
  const repEvent = [...data.events]
    .map((e) => ({ e, tier: severityTier(e), dist: minDistToRoutes(e, routesG, nodes) }))
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || a.dist - b.dist)[0]?.e;

  const kpis = [
    { lab: "예보장 상태", v: forecastQualityLabel(forecastQuality.status), c: forecastQuality.status === "blocked" ? "#dc2626" : forecastQuality.status === "warn" ? "#b45309" : "#0d9488", s: formatForecastAge(forecastQuality.latestAgeHours) },
    { lab: "현재 경보 (관측)", v: String(alertEvents), c: "#dc2626", s: repEvent ? `${repEvent.source.toUpperCase()} · ${eventName(repEvent)}${parseIntensity(repEvent.title) ? ` (${parseIntensity(repEvent.title)})` : ""}` : "전 세계 정상" },
    { lab: "주의 자산", v: String(cautionAssets), c: "#b45309", s: topCaution ? `${topCaution.name} · ${driverAt(rm, topCaution.id, 0)}` : "주의 자산 없음" },
    { lab: "감시 자산", v: String(data.assets.length), c: "#1a2433", s: "항만·주요 해협·철도" },
  ];

  const suezRoute = routesG.find((r) => (r.chokes || []).includes("suez")) ?? null;

  const pills: { c: string; t: ReactNode }[] = [
    { c: forecastTone.dot, t: <>예보장 <b className="lsg-mono text-[#e9eef7]">{forecastQualityLabel(forecastQuality.status)}</b></> },
    { c: "bg-[#2dd4bf]", t: <>감시 자산 <b className="lsg-mono text-[#e9eef7]">{data.assets.length}개</b></> },
    { c: "bg-[#ef4444]", t: <>관측/경보 이벤트 <b className="lsg-mono text-[#e9eef7]">{data.events.length}건</b></> },
    { c: "bg-[#d97706]", t: <>주의·경보 자산 <b className="lsg-mono text-[#e9eef7]">{cautionAssets + alertAssets}건</b></> },
  ];

  const refTime = forecastQuality.latestUpdatedAt ?? null;

  return (
    <div className="lsgc-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <CriticalBanner events={data.events} routes={routesG} nodes={nodes} />
      <HomeNav active="insight" />
      <InsightSubNav />
      <HeroAndGlobe data={globeData} pills={pills} forecastQuality={forecastQuality} />

      <div className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1] pb-2.5" style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}>
        <div className={WRAP}>
          <div className="pt-[26px] text-[12.5px] text-[#828d9d]">
            <Link to="/" className="hover:text-[#0d9488]">홈</Link> <b className="font-medium text-[#54606f]">›</b> 인사이트 <b className="font-medium text-[#54606f]">›</b> 기후예측
          </div>

          {/* GEO: 보이지 않는 Article JSON-LD만 유지(시각 요소 제거) */}
          <GeoArticleSchema
            article={{
              headline: "세계 기후 예측 — 항만·해협·노선 기상 리스크",
              description:
                "전 세계 항만·주요 해협·내륙 철도 거점의 기상 리스크와 영향 노선을 AI 예보 기반으로 모니터링하는 대시보드.",
              path: "/climate",
              datePublished: refTime,
              dateModified: refTime,
            }}
          />

          <Kpis items={kpis} />
          <ForecastQualityPanel quality={forecastQuality} />
          <RouteMonitor rm={rm} routes={routesG} suez={suezRoute} nodes={nodes} />
          <Impact rm={rm} routes={routesG} events={data.events} nodes={nodes} forecasts={data.forecasts} />
          <RegionImpact events={data.events} assets={data.assets} routes={routesG} nodes={nodes} forecasts={data.forecasts} />
          <Straits rm={rm} chokes={chokes} routes={routesG} />
          <Timeline events={data.events} assets={data.assets} routes={routesG} nodes={nodes} />
          {data.assets.length === 0 && data.events.length === 0 && (
            <div className={`mt-[26px] px-6 py-16 text-center ${CARD}`}>
              <p className="text-[14px] font-semibold text-[#1a2433]">데이터 수집 중</p>
              <p className="mt-1 text-[12px] text-[#828d9d]">기상 리스크 자산·이벤트가 수집되면 이곳에 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}
