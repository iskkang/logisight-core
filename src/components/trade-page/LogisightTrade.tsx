// 무역(Trade) 페이지 — 사용자 제공 샘플(LogisightTrade) 디자인을 실데이터에 연결.
// 데이터/집계 로직은 기존 /trade 와 동일(관세청 수출입무역통계 bundle + freight_indices). 표현만 샘플 디자인.
// 더미 수치는 전부 실데이터로 대체하고, 없으면 "데이터 수집 중".
// 상단 브리핑은 백엔드 생성·캐시를 우선 읽고, 실패 시 규칙 기반 요약(실데이터 파생)으로 대체.
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import {
  formatPeriod,
  pctChange,
  tradeStatisticsBundleQueryOptions,
  type TradeStatRow,
  type TradeStatisticsBundle,
} from "@/lib/api/trade";
import { indexStatsQueryOptions, type IndexStats } from "@/lib/api/rates";
import { DataMeta } from "@/components/ui/DataMeta";
import { DATASET_SOURCE } from "@/lib/dataSources";
import { flagEmoji } from "@/lib/iso-country-codes";

/* ============================ STYLE ============================ */
const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";
const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const CHIP = "rounded-full border border-[#d8dfe9] bg-[#eef1f6] px-[9px] py-[3px] text-[11px] text-[#828d9d]";

const STYLE = `
.lsgt-root{font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
.lsgt-root tbody tr:hover{background:#eef2f8}
.lsgt-root ::-webkit-scrollbar{width:9px;height:9px}
.lsgt-root ::-webkit-scrollbar-thumb{background:rgba(120,134,156,.45);border-radius:9px;border:2px solid transparent;background-clip:padding-box}
.lsgt-root *{scrollbar-width:thin;scrollbar-color:rgba(120,134,156,.5) transparent}
@keyframes lsgtLive{0%,100%{opacity:1}50%{opacity:.3}}
.lsgt-live{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;margin:0 6px 0 8px;vertical-align:1px;animation:lsgtLive 1.4s ease-in-out infinite}
@keyframes lsgtBlink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes lsgtHalo{0%{transform:scale(1);opacity:.5}80%,100%{transform:scale(4.4);opacity:0}}
@keyframes lsgtSk{0%{background-position:140% 0}100%{background-position:-140% 0}}
.lsgt-root .sk{display:block;border-radius:8px;background:linear-gradient(90deg,#e6ebf2 0%,#f7f9fc 42%,#e6ebf2 84%);background-size:240% 100%;animation:lsgtSk 1.2s ease-in-out infinite}
.lsgt-root .mtf-nd{animation:lsgtBlink 1.8s ease-in-out infinite}
.lsgt-root .mtf-nd2{animation-delay:.6s}.lsgt-root .mtf-nd3{animation-delay:1.15s}
.lsgt-root .mtf-halo{transform-box:fill-box;transform-origin:center;animation:lsgtHalo 2.6s ease-out infinite}
.lsgt-root .mtf-halo2{animation-delay:1.3s}
@media(prefers-reduced-motion:reduce){.lsgt-live,.lsgt-root .mtf-nd,.lsgt-root .mtf-halo{animation:none}}
`;

/* ============================ MODEL (기존 /trade 빌더 재사용) ============================ */
type MetricMode = "total" | "export" | "import" | "balance";
type RegionKey = "전체" | "아시아" | "북미" | "유럽" | "중동" | "중남미" | "아프리카" | "오세아니아";
type CountryAgg = { code: string; name: string; region: RegionKey; exportUsd: number; importUsd: number; tradeUsd: number; balanceUsd: number; changePct: number | null };
type ItemAgg = { code: string; name: string; exportUsd: number; importUsd: number; tradeUsd: number; balanceUsd: number; changePct: number | null };
type ContinentAgg = { code: string; name: string; exportUsd: number; importUsd: number; tradeUsd: number; balanceUsd: number };
type MonthlyPoint = { period: string; label: string; exportUsd: number; importUsd: number; balanceUsd: number };
type ProvisionalSnapshot = { period: string | null; priodDt: string | null; exportUsd: number | null; importUsd: number | null; balanceUsd: number | null; totalYoY: number | null; exportYoY: number | null; importYoY: number | null; balanceYoY: number | null };
type TradeBrief = { verdict: string; detail: string };
type TradeBriefState = { status: "loading" | "ready" | "fallback"; data: TradeBrief | null; period: string | null };
type TradeBriefInput = {
  period: string;
  trade: { total: number | null; totalYoY: number | null; totalMoM: number | null; exp: number | null; imp: number | null; balance: number | null; balanceTrend: string };
  movers: { name: string; yoy: number; note: string }[];
  freight: { idx: string; wow: number | null; lane: string; outlook: string }[];
};

const REGIONS: RegionKey[] = ["전체", "아시아", "북미", "유럽", "중동", "중남미", "아프리카", "오세아니아"];
const REGION_BY_CODE: Record<string, RegionKey> = {
  CN: "아시아", JP: "아시아", VN: "아시아", TW: "아시아", HK: "아시아", SG: "아시아", MY: "아시아", IN: "아시아", TH: "아시아", ID: "아시아", PH: "아시아", BD: "아시아", PK: "아시아", KH: "아시아", MM: "아시아", LK: "아시아",
  US: "북미", CA: "북미", MX: "북미",
  DE: "유럽", NL: "유럽", PL: "유럽", FR: "유럽", GB: "유럽", IT: "유럽", ES: "유럽", HU: "유럽", CZ: "유럽", SK: "유럽", RU: "유럽", KZ: "유럽",
  AE: "중동", SA: "중동", TR: "중동", IR: "중동", IQ: "중동", IL: "중동", OM: "중동", KW: "중동", QA: "중동", BH: "중동",
  BR: "중남미", CL: "중남미", PE: "중남미", AR: "중남미",
  ZA: "아프리카", NG: "아프리카", EG: "아프리카", MA: "아프리카",
  AU: "오세아니아", NZ: "오세아니아",
};

const FREIGHT_SYNC: { idx: string; lane: string }[] = [
  { idx: "WCI", lane: "한-미(미서안)" },
  { idx: "KCCI", lane: "한-중" },
  { idx: "FBX", lane: "한-유럽" },
];

const MOVER_NOTES: Record<string, string> = {
  TW: "반도체·전자 관련 변동",
  HK: "환적 수요 변동",
  MY: "전기·전자 관련 변동",
  JP: "전기·전자 관련 변동",
  CN: "주요 교역국 변동",
  US: "주요 교역국 변동",
  VN: "생산거점 교역 변동",
};

const periodKey = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(0, 6);
const latestPeriod = (rows: Pick<TradeStatRow, "period">[]) => [...new Set(rows.map((r) => periodKey(r.period)).filter(Boolean))].sort().at(-1) ?? null;
const prevYearPeriod = (p: string | null) => (!p || p.length < 6 ? null : `${Number(p.slice(0, 4)) - 1}${p.slice(4, 6)}`);
const priodRank = (v: string | null | undefined) => (!v ? 0 : v.includes("말일") ? 3 : v.includes("20") ? 2 : v.includes("10") ? 1 : 0);
const sum = (vals: number[]) => vals.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);
const regionOf = (code: string | null | undefined): RegionKey => (!code ? "아시아" : REGION_BY_CODE[code.toUpperCase()] ?? "아시아");
const metricValue = (r: CountryAgg | ItemAgg | ContinentAgg, m: MetricMode) => (m === "export" ? r.exportUsd : m === "import" ? r.importUsd : m === "balance" ? r.balanceUsd : r.tradeUsd);
const rowsForPeriod = (rows: TradeStatRow[], period: string | null) => (period ? rows.filter((r) => periodKey(r.period) === period) : []);
const latestRows = (rows: TradeStatRow[]) => { const l = latestPeriod(rows); return l ? rows.filter((r) => periodKey(r.period) === l) : []; };

function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}
const moneyUsd = (v: number | null | undefined) => { const m = money(v); return m === "-" ? m : `$${m}`; };
const compactName = (name: string, max = 18) => (name.length > max ? `${name.slice(0, max)}...` : name);

function buildProvisionalSnapshot(rows: TradeStatRow[]): ProvisionalSnapshot {
  const periods = [...new Set(rows.map((r) => periodKey(r.period)).filter(Boolean))].sort();
  const latest = periods.at(-1) ?? null;
  const previous = prevYearPeriod(latest);
  const aggregate = (period: string | null) => {
    const picked = new Map<string, TradeStatRow>();
    for (const row of rows) {
      if (periodKey(row.period) !== period) continue;
      const key = `${row.stat_type}|${(row.country_code ?? "ALL").toUpperCase()}`;
      const ex = picked.get(key);
      if (!ex || priodRank(row.priod_dt) >= priodRank(ex.priod_dt)) picked.set(key, row);
    }
    const allExp = picked.get("provisional_exp|ALL"), allImp = picked.get("provisional_imp|ALL");
    const countryRows = [...picked.values()].filter((r) => (r.country_code ?? "").toUpperCase() !== "ALL");
    const exportUsd = allExp?.export_usd ?? sum(countryRows.filter((r) => r.stat_type === "provisional_exp").map((r) => r.export_usd ?? 0));
    const importUsd = allImp?.import_usd ?? sum(countryRows.filter((r) => r.stat_type === "provisional_imp").map((r) => r.import_usd ?? 0));
    return { exportUsd, importUsd, balanceUsd: exportUsd - importUsd, priodDt: allExp?.priod_dt ?? allImp?.priod_dt ?? null };
  };
  const current = aggregate(latest), prev = aggregate(previous);
  return {
    period: latest, priodDt: current.priodDt, exportUsd: current.exportUsd, importUsd: current.importUsd, balanceUsd: current.balanceUsd,
    totalYoY: pctChange((current.exportUsd ?? 0) + (current.importUsd ?? 0), (prev.exportUsd ?? 0) + (prev.importUsd ?? 0)),
    exportYoY: pctChange(current.exportUsd, prev.exportUsd), importYoY: pctChange(current.importUsd, prev.importUsd), balanceYoY: pctChange(current.balanceUsd, prev.balanceUsd),
  };
}
function prevComparablePeriod(rows: TradeStatRow[], latest: string | null): string | null {
  const py = prevYearPeriod(latest);
  if (py && rows.some((r) => periodKey(r.period) === py)) return py;
  return [...new Set(rows.map((r) => periodKey(r.period)).filter(Boolean))].sort().filter((p) => p !== latest).at(-1) ?? null;
}
function buildCountryAgg(rows: TradeStatRow[], region: RegionKey, metric: MetricMode): CountryAgg[] {
  const latest = latestPeriod(rows), previous = prevComparablePeriod(rows, latest);
  const prevByCode = new Map<string, number>();
  for (const row of rowsForPeriod(rows, previous)) {
    const code = (row.country_code ?? "").toUpperCase();
    if (!code || code === "ALL") continue;
    prevByCode.set(code, (row.export_usd ?? 0) + (row.import_usd ?? 0));
  }
  return rowsForPeriod(rows, latest)
    .filter((r) => r.country_code && r.country_code.toUpperCase() !== "ALL")
    .map((row) => {
      const code = row.country_code!.toUpperCase();
      const exportUsd = row.export_usd ?? 0, importUsd = row.import_usd ?? 0;
      return { code, name: row.country_name ?? code, region: regionOf(code), exportUsd, importUsd, tradeUsd: exportUsd + importUsd, balanceUsd: row.trade_balance ?? exportUsd - importUsd, changePct: pctChange(exportUsd + importUsd, prevByCode.get(code) ?? null) };
    })
    .filter((c) => region === "전체" || c.region === region)
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}
function buildItemAgg(rows: TradeStatRow[], metric: MetricMode): ItemAgg[] {
  const latest = latestPeriod(rows), previous = prevComparablePeriod(rows, latest);
  const prevByHs = new Map<string, number>();
  for (const row of rowsForPeriod(rows, previous)) { const code = row.hs_code ?? "미분류"; prevByHs.set(code, (prevByHs.get(code) ?? 0) + (row.export_usd ?? 0) + (row.import_usd ?? 0)); }
  const byHs = new Map<string, ItemAgg>();
  for (const row of rowsForPeriod(rows, latest)) {
    const code = row.hs_code ?? "미분류";
    const cur = byHs.get(code) ?? { code, name: row.hs_name ?? code, exportUsd: 0, importUsd: 0, tradeUsd: 0, balanceUsd: 0, changePct: null };
    cur.exportUsd += row.export_usd ?? 0; cur.importUsd += row.import_usd ?? 0; cur.tradeUsd = cur.exportUsd + cur.importUsd; cur.balanceUsd = cur.exportUsd - cur.importUsd;
    byHs.set(code, cur);
  }
  return [...byHs.values()].map((it) => ({ ...it, changePct: pctChange(it.tradeUsd, prevByHs.get(it.code) ?? null) })).sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}
function buildContinents(rows: TradeStatRow[], metric: MetricMode): ContinentAgg[] {
  return latestRows(rows).map((row) => {
    const exportUsd = row.export_usd ?? 0, importUsd = row.import_usd ?? 0;
    return { code: row.country_code ?? row.country_name ?? "권역", name: row.country_name ?? row.country_code ?? "권역", exportUsd, importUsd, tradeUsd: exportUsd + importUsd, balanceUsd: row.trade_balance ?? exportUsd - importUsd };
  }).sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}
function buildMonthly(rows: TradeStatRow[]): MonthlyPoint[] {
  const periods = [...new Set(rows.map((r) => periodKey(r.period)).filter(Boolean))].sort();
  return periods.map((period) => {
    const inP = rowsForPeriod(rows, period);
    const exportUsd = sum(inP.map((r) => r.export_usd ?? 0)), importUsd = sum(inP.map((r) => r.import_usd ?? 0));
    return { period, label: `${period.slice(2, 4)}.${period.slice(4, 6)}`, exportUsd, importUsd, balanceUsd: exportUsd - importUsd };
  });
}
function useTradeModel(bundle: TradeStatisticsBundle | undefined, region: RegionKey, metric: MetricMode) {
  return useMemo(() => {
    if (!bundle) return null;
    const countries = buildCountryAgg(bundle.country, region, metric);
    const allCountries = buildCountryAgg(bundle.country, "전체", metric);
    const items = buildItemAgg(bundle.item, metric);
    const continents = buildContinents(bundle.continent, metric);
    const snapshot = buildProvisionalSnapshot(bundle.provisional);
    const monthly = buildMonthly(bundle.country);
    const latestCountryPeriod = latestPeriod(bundle.country);
    const latestItemPeriod = latestPeriod(bundle.item);
    const totalCountryTrade = sum(rowsForPeriod(bundle.country, latestCountryPeriod).map((r) => (r.export_usd ?? 0) + (r.import_usd ?? 0)));
    return { countries, allCountries, items, continents, monthly, snapshot, totalTrade: (snapshot.exportUsd ?? 0) + (snapshot.importUsd ?? 0), totalTradeYoY: snapshot.totalYoY, latestCountryPeriod, latestItemPeriod, totalCountryTrade };
  }, [bundle, region, metric]);
}
type TradeModel = NonNullable<ReturnType<typeof useTradeModel>>;

const METRIC_KO = ["교역액", "수출액", "수입액", "무역수지"] as const;
type MetricKo = (typeof METRIC_KO)[number];
const METRIC_BY_KO: Record<MetricKo, MetricMode> = { 교역액: "total", 수출액: "export", 수입액: "import", 무역수지: "balance" };

/* 교역 ↔ 운임 정적 매핑(대표 레인·연동 지수) — 수치는 실데이터, 레인/지수 선택만 편집상수. */
const LANE_BY_CODE: Record<string, string> = { CN: "부산–상하이 / 닝보", US: "부산–LA / 뉴욕", TW: "부산–가오슝", VN: "부산–호치민 / 하이퐁", JP: "부산–도쿄 / 요코하마", HK: "부산–홍콩", MY: "부산–클랑", SG: "부산–싱가포르", DE: "부산–로테르담" };
const IDX_BY_CODE: Record<string, string> = { CN: "KCCI", US: "WCI", TW: "SCFI", VN: "CCFI", DE: "FBX", JP: "KCCI", HK: "SCFI", MY: "SCFI", SG: "SCFI" };

/* ============================ HELPERS / UI ============================ */
const FC: Record<"up" | "dn" | "fl", string> = { up: "bg-[#ecfdf3] text-[#067647]", dn: "bg-[#fef2f2] text-[#b42318]", fl: "bg-[#f1f5f9] text-[#475569]" };
const fcOf = (wow: number | null): "up" | "dn" | "fl" => (wow == null ? "fl" : wow > 1 ? "up" : wow < -1 ? "dn" : "fl");
const fcLabel = (fc: "up" | "dn" | "fl") => (fc === "up" ? "▲ 상승" : fc === "dn" ? "▼ 약세" : "◆ 보합");
const fmtPct = (v: number | null | undefined, d = 1) => (v == null || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);

function Seg<T extends string>({ items, value, onChange }: { items: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <span className="flex flex-wrap gap-0.5 rounded-[9px] border border-[#d8dfe9] bg-[#eef1f6] p-[3px]">
      {items.map((x) => (
        <button key={x} type="button" onClick={() => onChange(x)} className={x === value
          ? "whitespace-nowrap rounded-[7px] bg-white px-2.5 py-[5px] font-semibold text-[#1a2433] shadow-[0_1px_2px_rgba(16,24,40,.06)]"
          : "whitespace-nowrap rounded-[7px] px-2.5 py-[5px] text-[#54606f]"}>{x}</button>
      ))}
    </span>
  );
}
const SecH = ({ title, chip }: { title: string; chip: string }) => (
  <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5"><h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">{title}</h2><span className={CHIP}>{chip}</span></div>
);

/* ============================ BRIEF (AI cache + 규칙 기반 폴백) ============================ */
const briefPeriod = (period: string | null | undefined) => {
  const p = periodKey(period);
  return p.length >= 6 ? `${p.slice(0, 4)}.${p.slice(4, 6)}` : null;
};
const briefNum = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** digits) / 10 ** digits);
const briefUsdB = (v: number | null | undefined) => {
  const n = briefNum(v, 2);
  if (n == null) return "집계 중";
  const abs = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${abs.toFixed(abs >= 10 ? 1 : 2)}B`;
};
const toBillion = (v: number | null | undefined) => briefNum(v == null ? null : v / 1e9, 2);
function tradeMoM(model: TradeModel): number | null {
  const m = model.monthly;
  if (m.length < 2) return null;
  const a = m.at(-1)!, b = m.at(-2)!;
  return briefNum(pctChange(a.exportUsd + a.importUsd, b.exportUsd + b.importUsd), 1);
}
function balanceTrendLabel(snapshot: ProvisionalSnapshot): string {
  const yoy = snapshot.balanceYoY;
  if (yoy == null) return "판단 보류";
  if ((snapshot.balanceUsd ?? 0) >= 0) return yoy >= 0 ? "확대" : "축소";
  return yoy >= 0 ? "적자 확대" : "적자 축소";
}
function freightOutlook(wow: number | null): string {
  if (wow == null) return "수집 중";
  if (wow > 1) return "상승";
  if (wow < -1) return "보합~약세";
  return "보합";
}
function buildTradeBriefInput(model: TradeModel, indexStats: IndexStats[]): TradeBriefInput {
  const movers = model.allCountries.filter((c) => c.changePct != null);
  const up = [...movers].filter((c) => (c.changePct ?? 0) >= 0).sort((a, b) => b.changePct! - a.changePct!).slice(0, 2);
  const down = [...movers].filter((c) => (c.changePct ?? 0) < 0).sort((a, b) => a.changePct! - b.changePct!).slice(0, 2);
  return {
    period: briefPeriod(model.snapshot.period) ?? formatPeriod(model.snapshot.period),
    trade: {
      total: toBillion(model.totalTrade),
      totalYoY: briefNum(model.totalTradeYoY, 1),
      totalMoM: tradeMoM(model),
      exp: toBillion(model.snapshot.exportUsd),
      imp: toBillion(model.snapshot.importUsd),
      balance: toBillion(model.snapshot.balanceUsd),
      balanceTrend: balanceTrendLabel(model.snapshot),
    },
    movers: [...up, ...down].map((c) => ({
      name: c.name,
      yoy: briefNum(c.changePct, 1) ?? 0,
      note: MOVER_NOTES[c.code] ?? ((c.changePct ?? 0) >= 0 ? "교역 증가" : "교역 둔화"),
    })),
    freight: FREIGHT_SYNC.map(({ idx, lane }) => {
      const row = indexStats.find((s) => s.index_code === idx);
      const wow = briefNum(row?.change_pct, 1);
      return { idx, wow, lane, outlook: freightOutlook(wow) };
    }),
  };
}
function isTradeBrief(value: unknown): value is TradeBrief {
  const row = value as Partial<TradeBrief> | null;
  return typeof row?.verdict === "string" && row.verdict.trim().length > 0 && typeof row.detail === "string" && row.detail.trim().length > 0;
}
function useTradeBrief(period: string | null): TradeBriefState {
  const periodLabel = briefPeriod(period);
  const [state, setState] = useState<TradeBriefState>({ status: periodLabel ? "loading" : "fallback", data: null, period: periodLabel });

  useEffect(() => {
    if (!periodLabel) {
      setState({ status: "fallback", data: null, period: null });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: "loading", data: null, period: periodLabel });
    fetch(`/api/trade/brief?period=${encodeURIComponent(periodLabel)}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`trade brief ${res.status}`);
        return (await res.json()) as unknown;
      })
      .then((data) => {
        if (cancelled) return;
        setState(isTradeBrief(data) ? { status: "ready", data, period: periodLabel } : { status: "fallback", data: null, period: periodLabel });
      })
      .catch((error) => {
        if (cancelled || error?.name === "AbortError") return;
        setState({ status: "fallback", data: null, period: periodLabel });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [periodLabel]);

  return state;
}
function buildFallbackBrief(model: TradeModel, indexStats: IndexStats[]): TradeBrief {
  const input = buildTradeBriefInput(model, indexStats);
  const balKo = input.trade.balance == null ? "집계 중" : input.trade.balance >= 0 ? `흑자 ${briefUsdB(input.trade.balance)}` : `적자 ${briefUsdB(input.trade.balance)}`;
  const verdict = `이번 기준 교역 ${briefUsdB(input.trade.total)}, 무역수지 ${balKo}.`;
  const up = input.movers.filter((m) => m.yoy >= 0).slice(0, 2);
  const down = input.movers.filter((m) => m.yoy < 0).slice(0, 2);
  const freight = input.freight.find((f) => f.wow != null);
  const upTxt = up.length ? `${up.map((m) => `${m.name}(${fmtPct(m.yoy)})`).join("·")} 교역 증가가 두드러지고` : "교역 증가 국가 집계 중이고";
  const downTxt = down.length ? `${down.map((m) => m.name).join("·")}은 둔화` : "둔화 국가는 제한적";
  const freightTxt = freight ? ` ${freight.lane} 운임(${freight.idx} ${fmtPct(freight.wow)})과의 연결은 ${freight.outlook} 신호로 해석 가능` : "";
  return { verdict, detail: `${upTxt}, ${downTxt}.${freightTxt} — 모두 추정이며 확정 통계가 아닙니다.` };
}

/* ============================ HERO ============================ */
function Hero({ snapshot, balanceUsd, latestCountryPeriod }: { snapshot: ProvisionalSnapshot | null; balanceUsd: number | null; latestCountryPeriod: string | null }) {
  const pills: { c: string; t: ReactNode }[] = snapshot
    ? [
        { c: "#2dd4bf", t: <>기준 <b className="lsg-mono text-[#e9eef7]">{formatPeriod(snapshot.period)}</b> 잠정</> },
        { c: balanceUsd != null && balanceUsd >= 0 ? "#16a34a" : "#dc2626", t: <>무역수지 <b className="lsg-mono text-[#e9eef7]">{moneyUsd(balanceUsd)}</b> {balanceUsd != null && balanceUsd >= 0 ? "흑자" : "적자"}</> },
        { c: "#3b82f6", t: <>확정 <b className="lsg-mono text-[#e9eef7]">{formatPeriod(latestCountryPeriod)}</b> · 잠정 <b className="lsg-mono text-[#e9eef7]">{formatPeriod(snapshot.period)}</b></> },
      ]
    : [];
  return (
    <section className="relative overflow-hidden bg-[#070b16]">
      <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[500px] w-[900px] -translate-x-1/2" style={{ background: "radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)" }} />
      <svg className="pointer-events-none absolute right-[-40px] top-0 h-full w-[560px] opacity-50" viewBox="0 0 560 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g stroke="#2dd4bf" strokeWidth="1" opacity="0.26" fill="none">
          <path d="M80 255 Q 190 185 330 205" /><path d="M330 205 Q 425 150 505 92" /><path d="M80 255 Q 150 120 280 102" /><path d="M280 102 Q 400 130 505 92" /><path d="M330 205 Q 380 285 465 300" /><path d="M180 175 Q 250 162 330 205" />
        </g>
        <g fill="#1f5f5a"><circle cx="80" cy="255" r="3.5" /><circle cx="465" cy="300" r="3.5" /><circle cx="280" cy="102" r="4" /></g>
        <g fill="none" stroke="#2dd4bf" strokeWidth="1.4"><circle className="mtf-halo" cx="330" cy="205" r="5" /><circle className="mtf-halo mtf-halo2" cx="505" cy="92" r="5" /></g>
        <g><circle className="mtf-nd" cx="330" cy="205" r="5" fill="#2dd4bf" /><circle className="mtf-nd mtf-nd2" cx="505" cy="92" r="5" fill="#5eead4" /><circle className="mtf-nd mtf-nd3" cx="180" cy="175" r="4" fill="#2dd4bf" /></g>
      </svg>
      <div className={`${WRAP} relative z-[1] pb-[74px] pt-[52px]`}>
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">Trade Intelligence <span className="lsgt-live" /><span className="text-[#34d399]">LIVE</span></span>
        <h1 className="mt-3 text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#e9eef7]">무역 동향</h1>
        <p className="mt-3.5 max-w-[640px] text-[15px] leading-[1.6] text-[#93a1b7]">관세청 수출입무역통계를 국가·대륙·품목으로 분해하고, 교역 변화를 <b className="text-[#cbd5e6]">운임·노선 신호</b>와 연결합니다. 확정·잠정 데이터는 명확히 구분합니다.</p>
        {pills.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {pills.map((p, i) => <span key={i} className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]"><span className="h-[7px] w-[7px] rounded-full" style={{ background: p.c }} />{p.t}</span>)}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================ BRIEF BAND + TILES ============================ */
function BriefBand({ model, indexStats }: { model: TradeModel; indexStats: IndexStats[] }) {
  const briefState = useTradeBrief(model.snapshot.period);
  const fallbackBrief = buildFallbackBrief(model, indexStats);
  const loadingBrief = briefState.status === "loading";
  const brief = briefState.status === "ready" && briefState.data ? briefState.data : fallbackBrief;
  const briefLabel = briefState.status === "ready" ? "AI 종합" : "규칙 기반 요약";
  const briefLabelPeriod = briefState.period ?? formatPeriod(model.snapshot.period);
  const top3 = model.allCountries.slice(0, 3);
  const concentration = model.totalCountryTrade > 0 ? Math.round((sum(top3.map((c) => c.tradeUsd)) / model.totalCountryTrade) * 100) : null;
  const mom = tradeMoM(model);
  const s = model.snapshot;
  const balPos = (s.balanceUsd ?? 0) >= 0;
  const tiles: { k: string; v: ReactNode; d: ReactNode; bar?: { w: string; c: string } }[] = [
    { k: "전체 교역액", v: <span className="lsg-mono">{moneyUsd(model.totalTrade)}</span>, d: <><span className={`lsg-mono ${(s.totalYoY ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>YoY {fmtPct(s.totalYoY)}</span><span className="lsg-mono text-[#828d9d]">MoM {fmtPct(mom)}</span></> },
    { k: "무역수지", v: <span className={`lsg-mono ${balPos ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{moneyUsd(s.balanceUsd)}</span>, d: <span className={balPos ? "text-[#16a34a]" : "text-[#dc2626]"}>{balPos ? "흑자" : "적자"} · 전년比 {fmtPct(s.balanceYoY)}</span>, bar: s.exportUsd && s.importUsd ? { w: `${Math.min(100, Math.round((s.exportUsd / (s.exportUsd + s.importUsd)) * 100))}%`, c: balPos ? "#16a34a" : "#dc2626" } : undefined },
    { k: "수출 / 수입", v: <span className="lsg-mono text-[20px]">{moneyUsd(s.exportUsd)} <span className="font-semibold text-[#828d9d]">/ {moneyUsd(s.importUsd)}</span></span>, d: <><span className={`lsg-mono ${(s.exportYoY ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>수출 {fmtPct(s.exportYoY)}</span><span className={`lsg-mono ${(s.importYoY ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>수입 {fmtPct(s.importYoY)}</span></> },
    { k: "교역 집중도 (상위 3국)", v: <span className="lsg-mono">{concentration != null ? `${concentration}%` : "수집 중"}</span>, d: <span className="text-[#828d9d]">{top3.length ? top3.map((c) => c.name).join("·") + " 비중" : "집계 중"}</span>, bar: concentration != null ? { w: `${concentration}%`, c: "#3b82f6" } : undefined },
  ];
  return (
    <div className="mt-3.5 rounded-[16px] border border-[#d8dfe9] p-[18px_20px]" style={{ background: "linear-gradient(180deg,#fbfcfe,#f4f7fb)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0 flex-1">
          {loadingBrief ? (
            <>
              <span className="sk h-5 w-full max-w-[520px]" />
              <span className="sk mt-2 h-4 w-full max-w-[680px]" />
              <span className="sk mt-1.5 h-4 w-full max-w-[560px]" />
            </>
          ) : (
            <>
              <div className="text-[15px] font-extrabold tracking-[-0.02em] text-[#1a2433]">{brief.verdict}</div>
              <div className="mt-1 max-w-[680px] text-[12.5px] leading-[1.55] text-[#54606f]">{brief.detail}</div>
            </>
          )}
        </div>
        <div className="whitespace-nowrap text-[11px] text-[#828d9d]">{loadingBrief ? <span className="sk h-4 w-[112px]" /> : `${briefLabel} · ${briefLabelPeriod}`}</div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3 min-[880px]:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={i} className="rounded-[12px] border border-[#d8dfe9] bg-white px-3.5 py-[13px]">
            <div className="text-[11.5px] text-[#828d9d]">{t.k}</div>
            <div className="mt-1.5 text-[24px] font-extrabold tracking-[-0.02em] text-[#1a2433]">{t.v}</div>
            <div className="mt-1 flex items-center gap-2 text-[11.5px]">{t.d}</div>
            {t.bar && <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e6ebf2]"><i className="block h-full rounded-full" style={{ width: t.bar.w, background: t.bar.c }} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ SIGNALS ============================ */
function Signals({ model, indexStats }: { model: TradeModel; indexStats: IndexStats[] }) {
  const withChg = model.countries.filter((c) => c.changePct != null);
  if (withChg.length === 0) return null;
  const surge = [...withChg].sort((a, b) => b.changePct! - a.changePct!)[0];
  const drop = [...withChg].sort((a, b) => a.changePct! - b.changePct!)[0];
  const syncBase = model.allCountries.find((c) => c.code === "US") ?? model.countries[0];
  const idxOf = (code: string) => indexStats.find((s) => s.index_code === (IDX_BY_CODE[code] ?? ""));
  const cards = [
    { kind: "surge", label: "▲ 급증", c: surge, bd: "border-[#c7ead6] bg-[#ecfdf3] text-[#067647]" },
    { kind: "drop", label: "▼ 급감", c: drop, bd: "border-[#fbd5d5] bg-[#fef2f2] text-[#b42318]" },
    { kind: "sync", label: "↔ 운임 동조", c: syncBase, bd: "border-[#cfe0fd] bg-[#eff6ff] text-[#1d4ed8]" },
  ].filter((x) => x.c);
  return (
    <>
      <SecH title="이번 달 무역 시그널" chip="자동 탐지 · 급증·급감·운임 연동" />
      <div className="grid grid-cols-1 gap-3.5 min-[980px]:grid-cols-3">
        {cards.map((card, i) => {
          const c = card.c as CountryAgg;
          const idx = idxOf(c.code);
          const fc = fcOf(idx?.change_pct ?? null);
          const lane = LANE_BY_CODE[c.code] ?? `부산–${c.name}`;
          return (
            <div key={i} className={`p-[16px_17px] ${CARD}`}>
              <span className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-[3px] text-[11px] font-bold ${card.bd}`}>{card.label}</span>
              <div className="mt-2.5 flex items-baseline gap-2 text-[16px] font-extrabold text-[#1a2433]">{flagEmoji(c.code)} {c.name}<span className={`lsg-mono text-[13px] font-bold ${(c.changePct ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(c.changePct)}</span></div>
              <div className="mt-0.5 lsg-mono text-[12px] text-[#828d9d]">교역액 {moneyUsd(c.tradeUsd)} · {c.region}{idx ? ` · ${idx.index_code} ${fmtPct(idx.change_pct)}` : ""}</div>
              <div className="mt-2.5 text-[12.5px] leading-[1.5] text-[#54606f]">
                {card.kind === "sync"
                  ? <><b className="font-bold text-[#1a2433]">{c.name} 교역</b>과 {idx?.index_code ?? "운임지수"} 변동의 정합을 상관 관점에서 표시(인과 아님).</>
                  : <><b className="font-bold text-[#1a2433]">{c.name}</b> 교역 전년比 {fmtPct(c.changePct)} {card.kind === "surge" ? "증가" : "감소"} — {c.region} 권역 모멘텀 신호.</>}
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-dashed border-[#d8dfe9] pt-2.5">
                <span className="text-[12px] text-[#54606f]">연동 레인 <b className="font-bold text-[#1a2433]">{lane}</b></span>
                <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold ${FC[fc]}`}>{idx ? `${idx.index_code} ${fcLabel(fc)}` : "운임 수집 중"}</span>
              </div>
              <Link to="/rates" className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0d9488]">레인·운임 보기 →</Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ============================ BRIDGE ============================ */
function Bridge({ model, indexStats }: { model: TradeModel; indexStats: IndexStats[] }) {
  const idxDate = indexStats.find((s) => s.latest_date)?.latest_date?.slice(0, 10) ?? "—";
  const rows = model.allCountries
    .filter((c) => LANE_BY_CODE[c.code])
    .slice(0, 6)
    .map((c) => {
      const idx = indexStats.find((s) => s.index_code === (IDX_BY_CODE[c.code] ?? ""));
      return { c, lane: LANE_BY_CODE[c.code], idx };
    });
  if (rows.length === 0) return null;
  return (
    <>
      <SecH title="교역 ↔ 운임 레인 브리지" chip="교역 변화 → 대표 레인 → 운임지수 → 추세" />
      <div className="overflow-hidden rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className="bg-[#eef2f7]">
              {["교역 국가", "대표 레인", "연동 운임지수", "WoW", "운임 추세"].map((h, i) => (
                <th key={h} className={`border-b border-[#d8dfe9] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#828d9d] ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(({ c, lane, idx }) => {
                const fc = fcOf(idx?.change_pct ?? null);
                return (
                  <tr key={c.code} className="border-b border-[#e6ebf2] last:border-0">
                    <td className="px-4 py-[13px]"><span className="font-bold text-[#1a2433]">{flagEmoji(c.code)} {c.name}</span><small className="mt-0.5 block text-[11px] font-normal text-[#828d9d]">{c.region} · {moneyUsd(c.tradeUsd)} · YoY {fmtPct(c.changePct)}</small></td>
                    <td className="px-4 py-[13px] text-[#54606f]">{lane}</td>
                    <td className="px-4 py-[13px] text-right font-bold text-[#1a2433]">{idx ? <>{idx.index_code} <small className="font-normal text-[#828d9d] lsg-mono">{idx.latest_value != null ? idx.latest_value.toLocaleString() : "—"}</small></> : "수집 중"}</td>
                    <td className={`px-4 py-[13px] text-right lsg-mono ${(idx?.change_pct ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{idx ? fmtPct(idx.change_pct) : "—"}</td>
                    <td className="px-4 py-[13px] text-right"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold ${FC[fc]}`}>{idx ? fcLabel(fc) : "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#d8dfe9] bg-[#f0f3f8] px-4 py-[11px] text-[11.5px] text-[#828d9d]">운임지수 기준 {idxDate} · 교역액은 관세청 집계. 운임 추세는 WoW 부호 기반 표시로, 확정 전망이 아닙니다(상관 관점).</div>
      </div>
    </>
  );
}

/* ============================ FLOW CHARTS ============================ */
function MonthlyChart({ monthly }: { monthly: MonthlyPoint[] }) {
  const pts = monthly.slice(-6);
  if (pts.length < 2) return <div className="grid min-h-[180px] place-items-center text-[13px] text-[#828d9d]">월별 집계가 누적되면 표시됩니다.</div>;
  const W = 620, H = 230, pL = 48, pR = 20, pT = 16, pB = 40, iw = W - pL - pR, ih = H - pT - pB;
  const maxV = Math.max(...pts.flatMap((p) => [p.exportUsd, p.importUsd]), 1);
  const balRange = Math.max(...pts.map((p) => Math.abs(p.balanceUsd)), 1);
  const slot = iw / pts.length, bw = Math.min(22, slot / 3.4);
  const yBar = (v: number) => pT + ih - (v / maxV) * ih;
  const yBal = (v: number) => pT + ih / 2 - (v / balRange) * (ih / 2 - 8);
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ fontFamily: "Pretendard" }}>
      {grid.map((g) => { const y = pT + ih - g * ih; return <g key={g}><line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#e6ebf2" strokeWidth="1" /><text x={pL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#828d9d">{money(maxV * g)}</text></g>; })}
      {pts.map((p, i) => {
        const cx = pL + slot * i + slot / 2;
        return (
          <g key={p.period}>
            <rect x={cx - bw - 2} y={yBar(p.exportUsd)} width={bw} height={pT + ih - yBar(p.exportUsd)} rx="2" fill="#1864ab" />
            <rect x={cx + 2} y={yBar(p.importUsd)} width={bw} height={pT + ih - yBar(p.importUsd)} rx="2" fill="#b7c6dd" />
            <text x={cx} y={H - 22} textAnchor="middle" fontSize="10" fill="#828d9d">{p.label}</text>
          </g>
        );
      })}
      <polyline points={pts.map((p, i) => `${(pL + slot * i + slot / 2).toFixed(1)},${yBal(p.balanceUsd).toFixed(1)}`).join(" ")} fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={p.period} cx={pL + slot * i + slot / 2} cy={yBal(p.balanceUsd)} r="3" fill="#d97706" />)}
    </svg>
  );
}
function FlowCharts({ model, metricKo }: { model: TradeModel; metricKo: MetricKo }) {
  const metric = METRIC_BY_KO[metricKo];
  const segs = (() => {
    const tops = model.continents.slice(0, 4).map((c) => ({ label: c.name, value: Math.max(0, metricValue(c, metric)) }));
    const rest = model.continents.slice(4).reduce((s, c) => s + Math.max(0, metricValue(c, metric)), 0);
    return rest > 0 ? [...tops, { label: "기타", value: rest }] : tops;
  })();
  const total = segs.reduce((s, x) => s + x.value, 0);
  const COLORS = ["#1864ab", "#38bdf8", "#3b82f6", "#f59e0b", "#cbb6d6"];
  let acc = 0;
  const stops = segs.map((seg, i) => { const from = total > 0 ? (acc / total) * 100 : 0; acc += seg.value; const to = total > 0 ? (acc / total) * 100 : 0; return `${COLORS[i % COLORS.length]} ${from.toFixed(1)}% ${to.toFixed(1)}%`; }).join(",");
  return (
    <>
      <SecH title="교역 흐름 & 구조" chip="확정 집계 · USD" />
      <div className="grid grid-cols-1 gap-3.5 min-[980px]:grid-cols-[1.5fr_1fr]">
        <div className={`p-[16px_18px] ${CARD}`}>
          <div className="mb-1.5 flex items-center gap-2"><span className="text-[14px] font-bold text-[#1a2433]">월별 수출·수입·무역수지</span><span className={CHIP}>최근 6개월</span></div>
          <MonthlyChart monthly={model.monthly} />
          <div className="mt-2 flex justify-center gap-3.5 text-[11.5px] text-[#54606f]">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]" style={{ background: "#1864ab" }} />수출</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]" style={{ background: "#b7c6dd" }} />수입</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-[-1px]" style={{ background: "#d97706" }} />무역수지</span>
          </div>
        </div>
        <div className={`p-[16px_18px] ${CARD}`}>
          <div className="mb-1.5 flex items-center gap-2"><span className="text-[14px] font-bold text-[#1a2433]">대륙별 교역 비중</span><span className={CHIP}>{metricKo}</span></div>
          {total <= 0 ? (
            <div className="grid min-h-[150px] place-items-center text-[13px] text-[#828d9d]">데이터 수집 중</div>
          ) : (
            <div className="flex flex-wrap items-center gap-[18px]">
              <div className="relative h-[150px] w-[150px] flex-none rounded-full" style={{ background: `conic-gradient(${stops})` }}>
                <div className="absolute inset-[26px] rounded-full bg-[#f4f7fb]" />
                <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center"><b className="lsg-mono text-[17px] font-extrabold text-[#1a2433]">{moneyUsd(total)}</b><span className="text-[10.5px] text-[#828d9d]">{metricKo}</span></div>
              </div>
              <div className="flex min-w-[170px] flex-1 flex-col gap-[7px]">
                {segs.map((d, i) => (
                  <div key={d.label} className="flex items-center gap-2 text-[12.5px]"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS[i % COLORS.length] }} /><span className="font-semibold text-[#1a2433]">{d.label}</span><span className="ml-auto lsg-mono text-[#54606f]">{moneyUsd(d.value)}</span><span className="lsg-mono min-w-[34px] text-right text-[#828d9d]">{total > 0 ? `${Math.round((d.value / total) * 100)}%` : "—"}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <DataMeta className="mt-2" source={DATASET_SOURCE.trade} cadence="월 1회 · 확정" unit="USD" method="국가·대륙 집계 · 최근 6개월 추이" />
    </>
  );
}

/* ============================ TREEMAP (실 교역액 · 샘플 고정 그리드 템플릿) ============================ */
// 면적 = 교역액 랭크 기반 12열 그리드(샘플과 동일). 값·라벨은 실데이터.
const TM_TEMPLATE: { rank: number; cls: string; big: boolean }[] = [
  { rank: 0, cls: "col-span-6 row-span-4", big: true },   // 1위 — 좌상 대형
  { rank: 2, cls: "col-span-3 row-span-3", big: true },   // 3위 — 중상
  { rank: 3, cls: "col-span-3 row-span-3", big: true },   // 4위 — 우상
  { rank: 4, cls: "col-span-6 row-span-1", big: false },  // 5위 — 가는 띠
  { rank: 1, cls: "col-span-6 row-span-3", big: true },   // 2위 — 좌하 대형
  { rank: 5, cls: "col-span-3 row-span-2", big: true },   // 6위 — 중하
  { rank: 7, cls: "col-span-3 row-span-1", big: false },  // 8위
  { rank: 8, cls: "col-span-3 row-span-1", big: false },  // 9위
  { rank: 6, cls: "col-span-3 row-span-1", big: false },  // 7위
  { rank: 9, cls: "col-span-3 row-span-1", big: false },  // 10위
];
const TM_SHADES = ["#3b4f7a", "#4a5e8c", "#5a6f9e", "#6478a6", "#7d8fb8", "#8294ba", "#8a9bc0", "#92a2c4", "#9aa9c9", "#a2b0ce"];
function Treemap({ model, metricKo }: { model: TradeModel; metricKo: MetricKo }) {
  const metric = METRIC_BY_KO[metricKo];
  const sorted = model.allCountries.slice(0, 10).map((c) => ({ c, v: Math.max(0, metricValue(c, metric)) })).filter((x) => x.v > 0);
  if (sorted.length === 0) return null;
  return (
    <>
      <SecH title="국가별 교역액 트리맵" chip={`상위 ${sorted.length}개국 · 면적 = ${metricKo}`} />
      <div className={`p-[16px_18px] ${CARD}`}>
        <div className="grid grid-cols-12 gap-1.5 [grid-auto-rows:46px]">
          {TM_TEMPLATE.filter((t) => t.rank < sorted.length).map((t) => {
            const x = sorted[t.rank];
            return (
              <div key={x.c.code} className={`flex overflow-hidden rounded-[9px] px-3 py-2.5 text-white ${t.cls} ${t.big ? "flex-col justify-start" : "items-center"}`} style={{ background: TM_SHADES[t.rank] }}>
                {t.big ? (
                  <><b className="text-[13px] font-bold">{x.c.name}</b><span className="lsg-mono mt-0.5 text-[11px] opacity-90">{moneyUsd(x.v)}{x.c.changePct != null ? ` · ${fmtPct(x.c.changePct)}` : ""}</span></>
                ) : (
                  <b className="whitespace-nowrap text-[11.5px] font-bold">{x.c.name} <span className="lsg-mono font-normal opacity-90">{moneyUsd(x.v)}</span></b>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <DataMeta className="mt-2" source={DATASET_SOURCE.trade} cadence="월 1회 · 확정" unit="USD" method="국가별 교역액 랭크" />
    </>
  );
}

/* ============================ TOP10 + SIDE ============================ */
function TopAndSide({ model }: { model: TradeModel }) {
  const top10 = model.countries.slice(0, 10);
  const items = model.items.slice(0, 5);
  const balRows = model.countries.filter((c) => c.balanceUsd != null);
  const surplus = [...balRows].sort((a, b) => b.balanceUsd - a.balanceUsd).slice(0, 3);
  const deficit = [...balRows].sort((a, b) => a.balanceUsd - b.balanceUsd).slice(0, 3);
  return (
    <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 min-[980px]:grid-cols-[1.5fr_1fr]">
      <div className={CARD}>
        <div className="flex items-center justify-between gap-2.5 px-[18px] pb-1.5 pt-4"><h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#1a2433]">주요국 교역 TOP 10</h2><span className={CHIP}>교역액 기준 · {formatPeriod(model.latestCountryPeriod)}</span></div>
        {top10.length === 0 ? (
          <div className="grid min-h-[120px] place-items-center text-[13px] text-[#828d9d]">데이터 수집 중</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead><tr>
                <th className="border-b border-[#d8dfe9] py-[11px] pl-[18px] pr-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#828d9d]">순위 / 국가</th>
                <th className="border-b border-[#d8dfe9] px-3.5 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[#828d9d]">교역액 (USD)</th>
                <th className="border-b border-[#d8dfe9] py-[11px] pl-3.5 pr-[18px] text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[#828d9d]">전년대비</th>
              </tr></thead>
              <tbody>
                {top10.map((r, i) => (
                  <tr key={r.code} className="border-b border-[#e6ebf2] last:border-0">
                    <td className="py-3 pl-[18px] pr-3.5"><span className="mr-0.5 inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-[#eef1f6] text-[11px] font-bold text-[#54606f]">{i + 1}</span><span className="mx-[7px]">{flagEmoji(r.code)}</span>{r.name}<span className="ml-1.5 text-[11.5px] text-[#828d9d]">{r.region}</span></td>
                    <td className="px-3.5 py-3 text-right lsg-mono">{moneyUsd(r.tradeUsd)}</td>
                    <td className={`py-3 pl-3.5 pr-[18px] text-right lsg-mono ${(r.changePct ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{r.changePct != null ? `${(r.changePct ?? 0) >= 0 ? "▲ " : "▼ "}${fmtPct(r.changePct)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DataMeta className="px-[18px] pb-3.5" source={DATASET_SOURCE.trade} asOf={formatPeriod(model.latestCountryPeriod)} cadence="월 1회 · 확정" unit="USD" />
      </div>

      <div className="flex flex-col gap-3.5">
        <div className={`p-[16px_18px] ${CARD}`}>
          <div className="mb-0.5 flex items-center gap-2 text-[14px] font-bold text-[#1a2433]">상위 품목 TOP 5 <span className={CHIP}>item · {formatPeriod(model.latestItemPeriod)}</span></div>
          {items.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-[#828d9d]">데이터 수집 중</div>
          ) : items.map((it, i) => (
            <div key={it.code} className="flex items-center justify-between gap-2.5 border-b border-[#e6ebf2] py-2.5 last:border-0">
              <span className="text-[13px] font-semibold text-[#1a2433]">{compactName(it.name, 18)}<small className="mt-0.5 block text-[11px] font-normal text-[#828d9d]">교역액 기준</small></span>
              <span className="lsg-mono text-[13.5px] font-bold text-[#1a2433]">{moneyUsd(it.tradeUsd)}</span>
            </div>
          ))}
          <Link to="/industries" className="mt-2.5 block rounded-[9px] border border-[#d8dfe9] py-2.5 text-center text-[12.5px] font-semibold text-[#0d9488]">산업별(HS) 랭킹 보기 →</Link>
        </div>

        <div className={`p-[16px_18px] ${CARD}`}>
          <div className="mb-0.5 flex items-center gap-2 text-[14px] font-bold text-[#1a2433]">교역수지 구조 <span className={CHIP}>국가별 흑자/적자</span></div>
          <div className="mb-1.5 mt-0.5 text-[11px] font-semibold text-[#828d9d]">흑자 상위</div>
          {surplus.map((b) => <div key={b.code} className="flex justify-between border-b border-[#e6ebf2] py-[7px] text-[12.5px] last:border-0"><span className="font-semibold text-[#1a2433]">對{b.name}</span><span className="lsg-mono text-[#16a34a]">{moneyUsd(b.balanceUsd)}</span></div>)}
          <div className="mb-1.5 mt-2.5 text-[11px] font-semibold text-[#828d9d]">적자 상위</div>
          {deficit.map((b) => <div key={b.code} className="flex justify-between border-b border-[#e6ebf2] py-[7px] text-[12.5px] last:border-0"><span className="font-semibold text-[#1a2433]">對{b.name}</span><span className="lsg-mono text-[#dc2626]">{moneyUsd(b.balanceUsd)}</span></div>)}
        </div>

        <div className={`p-[16px_18px] ${CARD}`}>
          <div className="mb-0.5 text-[14px] font-bold text-[#1a2433]">잠정 데이터 안내</div>
          <p className="text-[12px] leading-[1.6] text-[#54606f]">{formatPeriod(model.snapshot.period)} 데이터는 <b className="text-[#1a2433]">잠정{model.snapshot.priodDt ? ` (${model.snapshot.priodDt} 집계)` : ""}</b>으로 부분집계입니다. 확정치는 익월 갱신됩니다. <b className="text-[#1a2433]">수출액 − 수입액 = 무역수지</b>가 화면에서 일치합니다. 운임 연동·추세 값은 참고용 추정이며 관세청 확정 통계가 아닙니다.</p>
          <DataMeta className="mt-2.5 border-t border-[#e6ebf2] pt-2.5" source={DATASET_SOURCE.trade} cadence="잠정 · 월 1회" method="익월 확정 갱신" />
        </div>
      </div>
    </div>
  );
}

/* ============================ PAGE ============================ */
function TradeSections({ model, indexStats, region, setRegion, metricKo, setMetricKo }: {
  model: TradeModel;
  indexStats: IndexStats[];
  region: RegionKey;
  setRegion: (r: RegionKey) => void;
  metricKo: MetricKo;
  setMetricKo: (m: MetricKo) => void;
}) {
  return (
    <>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[12px] border border-[#d8dfe9] bg-[#f4f7fb] px-3.5 py-3 text-[12.5px]">
        <div className="flex items-center gap-1.5"><span className="text-[11.5px] text-[#828d9d]">목적 권역</span><Seg items={REGIONS} value={region} onChange={setRegion} /></div>
        <div className="flex items-center gap-1.5"><span className="text-[11.5px] text-[#828d9d]">지표</span><Seg items={METRIC_KO} value={metricKo} onChange={setMetricKo} /></div>
        <span className="ml-auto text-[11.5px] text-[#828d9d]">확정 {formatPeriod(model.latestCountryPeriod)} · 잠정 {formatPeriod(model.snapshot.period)}</span>
      </div>

      <BriefBand model={model} indexStats={indexStats} />
      <Signals model={model} indexStats={indexStats} />
      <Bridge model={model} indexStats={indexStats} />
      <FlowCharts model={model} metricKo={metricKo} />
      <Treemap model={model} metricKo={metricKo} />
      <TopAndSide model={model} />
    </>
  );
}

/* 로딩/에러/빈 상태 — 셸(헤더·히어로·푸터)은 그대로 두고 이 본문만 교체된다. */
function TradeLoading() {
  return (
    <>
      <div className="mt-3.5 rounded-[12px] border border-[#d4e6f2] bg-[#eef6fb] px-4 py-[15px] text-[13px] leading-[1.7] text-[#54606f]">
        <b className="text-[#1a2433]">관세청 수출입무역통계를 불러오고 있습니다.</b>
        <br />HS 챕터별 수출입액, 무역수지, 주요 국가별 흐름을 집계 중입니다.
        <br />데이터량이 많아 최대 10~15초 소요될 수 있습니다.
      </div>

      {/* HS 챕터 / 국가 선택 필터 */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[12px] border border-[#d8dfe9] bg-[#f4f7fb] px-3.5 py-3">
        <span className="sk h-7 w-[150px]" />
        <span className="sk h-7 w-[210px]" />
        <span className="sk ml-auto h-4 w-40" />
      </div>

      {/* 기준월/업데이트 + 총수출·총수입·무역수지 요약 카드 3개 */}
      <div className="mt-3.5 rounded-[16px] border border-[#d8dfe9] p-[18px_20px]" style={{ background: "linear-gradient(180deg,#fbfcfe,#f4f7fb)" }}>
        <span className="sk h-4 w-44" />
        <div className="mt-3.5 grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[12px] border border-[#d8dfe9] bg-white px-3.5 py-[13px]">
              <span className="sk h-3.5 w-20" />
              <span className="sk mt-2 h-7 w-32" />
              <span className="sk mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* 수출입 추이 차트 */}
      <div className="mt-3.5 rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] p-[16px_18px]">
        <span className="sk h-4 w-40" />
        <span className="sk mt-3 h-[220px] w-full" />
      </div>

      {/* 주요 교역국 테이블 + HS 챕터별 테이블 */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 min-[980px]:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] p-[16px_18px]">
            <span className="sk h-4 w-32" />
            {[0, 1, 2, 3, 4, 5].map((j) => <span key={j} className="sk mt-2.5 h-5 w-full" />)}
          </div>
        ))}
      </div>
    </>
  );
}

function TradeError() {
  return (
    <div className="mt-3.5 rounded-[14px] border border-[#f1c7c7] bg-[#fef4f4] px-5 py-12 text-center">
      <div className="text-[15px] font-bold text-[#b42318]">무역 데이터를 불러오지 못했습니다.</div>
      <p className="mt-2 text-[13px] leading-[1.7] text-[#9a6a6a]">
        일시적인 네트워크 또는 데이터 API 문제일 수 있습니다.
        <br />잠시 후 다시 시도해주세요.
      </p>
    </div>
  );
}

function TradeEmpty() {
  return (
    <div className="mt-3.5 rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] px-5 py-12 text-center">
      <div className="text-[14px] font-semibold text-[#1a2433]">해당 조건에 맞는 무역 데이터가 없습니다.</div>
      <p className="mt-2 text-[13px] leading-[1.6] text-[#828d9d]">기간, 국가, HS 챕터 조건을 변경해 다시 조회해주세요.</p>
    </div>
  );
}

export function LogisightTrade() {
  // 클라이언트 useQuery — 셸(헤더·히어로·푸터)과 스켈레톤을 즉시 렌더(SSR 포함)하고, 데이터가
  // 도착하면 본문만 loading → loaded 로 교체한다(셸 재마운트·스크롤 리셋 없음). 번들이 작아 전환이 빠르다.
  const { data: bundle, isError } = useQuery(tradeStatisticsBundleQueryOptions());
  const { data: indexStats } = useQuery(indexStatsQueryOptions());
  const [region, setRegion] = useState<RegionKey>("전체");
  const [metricKo, setMetricKo] = useState<MetricKo>("교역액");
  const metric = METRIC_BY_KO[metricKo];
  const model = useTradeModel(bundle, region, metric);
  const loading = !isError && (!bundle || !indexStats || !model);
  const empty = !!model && model.countries.length === 0 && model.items.length === 0;

  return (
    <div className="lsgt-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />
      <Hero
        snapshot={model?.snapshot ?? null}
        balanceUsd={model?.snapshot.balanceUsd ?? null}
        latestCountryPeriod={model?.latestCountryPeriod ?? null}
      />

      <div className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1] pb-2.5" style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}>
        <div className={WRAP}>
          <div className="pt-[26px] text-[12.5px] text-[#828d9d]">
            <Link to="/" className="hover:text-[#0d9488]">홈</Link> <b className="font-medium text-[#54606f]">›</b> 인사이트 <b className="font-medium text-[#54606f]">›</b> 무역
          </div>

          {isError ? (
            <TradeError />
          ) : loading ? (
            <TradeLoading />
          ) : empty ? (
            <TradeEmpty />
          ) : (
            <TradeSections
              model={model!}
              indexStats={indexStats!}
              region={region}
              setRegion={setRegion}
              metricKo={metricKo}
              setMetricKo={setMetricKo}
            />
          )}
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}
