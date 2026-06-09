import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FileText, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import "leaflet/dist/leaflet.css";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardTicker } from "@/components/dashboard/DashboardTicker";
import { publishedForecastsQueryOptions } from "@/lib/api/forecasts";
import {
  bunkerPricesQueryOptions,
  computeMoM,
  freightIndicesHistoryQueryOptions,
  indexStatsQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  latestByRoute,
  type FreightIndexHistoryRow,
  type IndexStats,
  type KitaAirRateRow,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";

export const Route = createFileRoute("/rates")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions()),
      context.queryClient.ensureQueryData(indexStatsQueryOptions()),
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

type MapPoint = [number, number];
type LeafletModule = typeof import("leaflet");
type MapRegionKey =
  | "americas"
  | "europe"
  | "asia"
  | "middleEast"
  | "africa"
  | "oceania"
  | "cis"
  | "other";

const PERIOD_LABEL: Record<PeriodKey, string> = {
  "3m": "최근 3개월",
  "6m": "최근 6개월",
  "12m": "최근 12개월",
  all: "전체 기간",
};

const MODE_LABEL: Record<ModeKey, string> = {
  all: "전체",
  sea: "해상",
  air: "항공",
};

const INDEX_COLORS: Record<string, string> = {
  KCCI: "#079455",
  SCFI: "#2563eb",
  BDI: "#f97316",
  WCI: "#8b5cf6",
  CCFI: "#0891b2",
};

const INDEX_TICKER_ORDER = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"];

const INDEX_LABELS: Record<string, string> = {
  KCCI: "종합 운임지수",
  SCFI: "종합 운임지수",
  BDI: "벌크 운임지수",
  WCI: "글로벌 운임지수",
  CCFI: "종합 운임지수",
};

const CITY_POINTS: Record<string, MapPoint> = {
  부산: [129.0756, 35.1796],
  BUSAN: [129.0756, 35.1796],
  PUS: [129.0756, 35.1796],
  인천: [126.7052, 37.4563],
  INCHEON: [126.7052, 37.4563],
  ICN: [126.7052, 37.4563],
  SHANGHAI: [121.4737, 31.2304],
  상하이: [121.4737, 31.2304],
  XINGANG: [117.75, 38.99],
  신강: [117.75, 38.99],
  톈진: [117.2, 39.13],
  QINGDAO: [120.3826, 36.0671],
  칭다오: [120.3826, 36.0671],
  NINGBO: [121.5503, 29.8746],
  닝보: [121.5503, 29.8746],
  DALIAN: [121.6147, 38.914],
  다롄: [121.6147, 38.914],
  HONGKONG: [114.1694, 22.3193],
  홍콩: [114.1694, 22.3193],
  KAOHSIUNG: [120.3014, 22.6273],
  가오슝: [120.3014, 22.6273],
  TOKYO: [139.6917, 35.6895],
  도쿄: [139.6917, 35.6895],
  "LOS ANGELES": [-118.2437, 34.0522],
  로스앤젤레스: [-118.2437, 34.0522],
  로스엔젤레스: [-118.2437, 34.0522],
  "LONG BEACH": [-118.1937, 33.7701],
  롱비치: [-118.1937, 33.7701],
  "NEW YORK": [-74.006, 40.7128],
  뉴욕: [-74.006, 40.7128],
  CHICAGO: [-87.6298, 41.8781],
  시카고: [-87.6298, 41.8781],
  DALLAS: [-96.797, 32.7767],
  댈러스: [-96.797, 32.7767],
  TORONTO: [-79.3832, 43.6532],
  토론토: [-79.3832, 43.6532],
  MONTREAL: [-73.5673, 45.5017],
  몬트리올: [-73.5673, 45.5017],
  SEATTLE: [-122.3321, 47.6062],
  시애틀: [-122.3321, 47.6062],
  AUCKLAND: [174.7633, -36.8485],
  "오클랜드(뉴질랜드)": [174.7633, -36.8485],
  OAKLAND: [-122.2711, 37.8044],
  오클랜드: [-122.2711, 37.8044],
  "오클랜드(미국)": [-122.2711, 37.8044],
  VANCOUVER: [-123.1207, 49.2827],
  밴쿠버: [-123.1207, 49.2827],
  TACOMA: [-122.4443, 47.2529],
  타코마: [-122.4443, 47.2529],
  SAVANNAH: [-81.0912, 32.0809],
  사바나: [-81.0912, 32.0809],
  서배너: [-81.0912, 32.0809],
  NORFOLK: [-76.2859, 36.8508],
  노퍽: [-76.2859, 36.8508],
  HOUSTON: [-95.3698, 29.7604],
  휴스턴: [-95.3698, 29.7604],
  CHARLESTON: [-79.9311, 32.7765],
  찰스턴: [-79.9311, 32.7765],
  ATLANTA: [-84.388, 33.749],
  애틀랜타: [-84.388, 33.749],
  CALLAO: [-77.125, -12.0464],
  카야오: [-77.125, -12.0464],
  MONTEVIDEO: [-56.1645, -34.9011],
  몬테비데오: [-56.1645, -34.9011],
  "BUENOS AIRES": [-58.3816, -34.6037],
  부에노스아이레스: [-58.3816, -34.6037],
  SANTOS: [-46.3336, -23.9608],
  산토스: [-46.3336, -23.9608],
  MANZANILLO: [-104.316, 19.1138],
  만사니요: [-104.316, 19.1138],
  "PUERTO QUETZAL": [-90.7875, 13.9308],
  "푸에르토 케찰": [-90.7875, 13.9308],
  VALPARAISO: [-71.6127, -33.0472],
  발파라이소: [-71.6127, -33.0472],
  CALDERA: [-84.72, 9.91],
  "푸에르토 칼데라": [-84.72, 9.91],
  ROTTERDAM: [4.4777, 51.9244],
  로테르담: [4.4777, 51.9244],
  HAMBURG: [9.9937, 53.5511],
  함부르크: [9.9937, 53.5511],
  GENOA: [8.9463, 44.4056],
  제노아: [8.9463, 44.4056],
  제노바: [8.9463, 44.4056],
  SOUTHAMPTON: [-1.4044, 50.9097],
  사우샘프턴: [-1.4044, 50.9097],
  "LE HAVRE": [0.1079, 49.4944],
  르아브르: [0.1079, 49.4944],
  MARSEILLE: [5.3698, 43.2965],
  "마르세이 항구": [5.3698, 43.2965],
  GOTHENBURG: [11.9746, 57.7089],
  예테보리: [11.9746, 57.7089],
  IZMIR: [27.1428, 38.4237],
  이즈미르: [27.1428, 38.4237],
  HELSINKI: [24.9384, 60.1699],
  헬싱키: [24.9384, 60.1699],
  ANTWERP: [4.4025, 51.2194],
  앤트워프: [4.4025, 51.2194],
  IZMIT: [29.9173, 40.7654],
  이즈미트: [29.9173, 40.7654],
  ISTANBUL: [28.9784, 41.0082],
  이스탄불: [28.9784, 41.0082],
  BARCELONA: [2.1734, 41.3851],
  바르셀로나: [2.1734, 41.3851],
  KOPER: [13.7302, 45.5481],
  코페르: [13.7302, 45.5481],
  SINGAPORE: [103.8198, 1.3521],
  싱가포르: [103.8198, 1.3521],
  DUBAI: [55.2708, 25.2048],
  두바이: [55.2708, 25.2048],
  MUMBAI: [72.8777, 19.076],
  뭄바이: [72.8777, 19.076],
  BANGKOK: [100.5018, 13.7563],
  방콕: [100.5018, 13.7563],
  HOCHIMINH: [106.6297, 10.8231],
  호치민: [106.6297, 10.8231],
  SYDNEY: [151.2093, -33.8688],
  시드니: [151.2093, -33.8688],
  LIANYUNGANG: [119.2216, 34.5967],
  렌윈강: [119.2216, 34.5967],
  롄윈강: [119.2216, 34.5967],
  ALEXANDRIA: [29.9187, 31.2001],
  알렉산드리아: [29.9187, 31.2001],
  TEHRAN: [51.389, 35.6892],
  테헤란: [51.389, 35.6892],
};

const AMERICAS_DEST_TERMS = [
  "LOS ANGELES",
  "로스앤젤레스",
  "로스엔젤레스",
  "LONG BEACH",
  "롱비치",
  "NEW YORK",
  "뉴욕",
  "CHICAGO",
  "시카고",
  "SEATTLE",
  "시애틀",
  "OAKLAND",
  "오클랜드",
  "VANCOUVER",
  "밴쿠버",
  "TACOMA",
  "타코마",
  "SAVANNAH",
  "사바나",
  "HOUSTON",
  "휴스턴",
  "CHARLESTON",
  "찰스턴",
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

function pctTone(value: number | null | undefined) {
  if (value == null) return "text-slate-500";
  return value >= 0 ? "text-emerald-600" : "text-rose-600";
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
        currency: "KRW" as const,
        latestMonth: compactMonth(row.year_mon),
        mom: computeMoM(series),
        ytd: computeYtd(series),
        spark: values.slice(-8),
      };
    })
    .filter((row) => row.rate != null);
}

function findPoint(name: string) {
  const upper = name.toUpperCase();
  const match = Object.entries(CITY_POINTS).find(
    ([key]) => upper.includes(key) || name.includes(key),
  );
  return match?.[1] ?? null;
}

function includesAny(value: string, terms: string[]) {
  const upper = value.toUpperCase();
  return terms.some((term) => upper.includes(term.toUpperCase()) || value.includes(term));
}

function isBusanOrigin(origin: string) {
  const upper = origin.toUpperCase();
  return origin.includes("부산") || upper.includes("BUSAN") || upper.includes("PUS");
}

function isAmericasDestination(row: RouteMetric) {
  const region = row.region ?? "";
  if (region.includes("북미") || region.includes("중남미")) return true;
  if (region.includes("오세아니아")) return false;
  return includesAny(row.dest, AMERICAS_DEST_TERMS);
}

function routeRegionKey(row: RouteMetric): MapRegionKey {
  const region = row.region ?? "";
  if (region.includes("북미") || region.includes("중남미")) return "americas";
  if (region.includes("유럽")) return "europe";
  if (region.includes("중동")) return "middleEast";
  if (region.includes("아프리카")) return "africa";
  if (region.includes("오세아니아")) return "oceania";
  if (region.includes("러시아") || region.includes("CIS")) return "cis";
  if (region.includes("아시아") || region.includes("중국") || region.includes("일본")) {
    return "asia";
  }
  if (includesAny(row.dest, AMERICAS_DEST_TERMS)) return "americas";
  return "other";
}

function routeRank(
  a: { row: RouteMetric; from: MapPoint; to: MapPoint },
  b: { row: RouteMetric; from: MapPoint; to: MapPoint },
) {
  return (
    Number(isBusanOrigin(b.row.origin)) - Number(isBusanOrigin(a.row.origin)) ||
    Math.abs(b.row.mom ?? 0) - Math.abs(a.row.mom ?? 0)
  );
}

function buildMapRoutes(rows: RouteMetric[]) {
  const candidates = rows
    .map((row) => ({ row, from: findPoint(row.origin), to: findPoint(row.dest) }))
    .filter((item): item is { row: RouteMetric; from: MapPoint; to: MapPoint } =>
      Boolean(item.from && item.to),
    )
    .sort(routeRank);

  const selected: typeof candidates = [];
  const selectedIds = new Set<string>();
  const quotas: [MapRegionKey, number][] = [
    ["americas", 5],
    ["europe", 5],
    ["asia", 4],
    ["middleEast", 2],
    ["africa", 2],
    ["oceania", 1],
    ["cis", 1],
  ];

  const pushCandidate = (candidate: (typeof candidates)[number]) => {
    if (selectedIds.has(candidate.row.id)) return;
    selected.push(candidate);
    selectedIds.add(candidate.row.id);
  };

  for (const [region, limit] of quotas) {
    candidates
      .filter((candidate) => routeRegionKey(candidate.row) === region)
      .slice(0, limit)
      .forEach(pushCandidate);
  }

  for (const candidate of candidates) {
    if (selected.length >= 20) break;
    pushCandidate(candidate);
  }

  return selected.slice(0, 20);
}

function indexSeries(history: FreightIndexHistoryRow[], code: string) {
  return history
    .filter((row) => row.index_code === code && row.value != null)
    .sort((a, b) => a.week_date.localeCompare(b.week_date));
}

function statFor(stats: IndexStats[], code: string, history: FreightIndexHistoryRow[]) {
  const found = stats.find((stat) => stat.index_code === code);
  if (found) return found;
  const latest = indexSeries(history, code).at(-1);
  return {
    index_code: code,
    latest_value: latest?.value ?? null,
    latest_date: latest?.week_date ?? null,
    change_pct: latest?.change_pct ?? null,
    mom_pct: null,
    yoy_pct: null,
    pct_52w: null,
    normal_range: null,
    source: latest?.source ?? null,
  } satisfies IndexStats;
}

function orderedTickerStats(stats: IndexStats[]) {
  const rank = new Map(INDEX_TICKER_ORDER.map((code, index) => [code, index]));
  return [...stats]
    .filter((stat) => stat.latest_value != null)
    .sort(
      (a, b) =>
        (rank.get(a.index_code) ?? INDEX_TICKER_ORDER.length) -
        (rank.get(b.index_code) ?? INDEX_TICKER_ORDER.length),
    );
}

function formatRate(row: RouteMetric) {
  const value = fmtNumber(row.rate, row.currency === "USD" ? 0 : 0);
  return row.currency === "USD" ? `$${value}/${row.unit}` : `₩${value}/${row.unit}`;
}

function shortReportTitle(statement: string, date: string) {
  const firstSentence = statement.split(/[.!?。]/)[0]?.trim() || statement.trim();
  const code = ["KCCI", "SCFI", "WCI", "CCFI", "BDI"].find((item) => statement.includes(item));
  const routeMatch = statement.match(/([가-힣A-Za-z]+발\s*[가-힣A-Za-z]+향)/);
  const label = code
    ? `${code} 운임 전망`
    : routeMatch?.[1]
      ? `${routeMatch[1]} 운임 동향`
      : firstSentence;
  const clipped = label.length > 28 ? `${label.slice(0, 28)}...` : label;
  return `[저장 전망] ${clipped} (${date.slice(0, 10)})`;
}

function RatesPage() {
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: bunker } = useSuspenseQuery(bunkerPricesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: exchangeRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());

  const [mode, setMode] = useState<ModeKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [origin, setOrigin] = useState("all");
  const [dest, setDest] = useState("all");

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
        .sort((a, b) => (b.mom ?? -999) - (a.mom ?? -999)),
    [allMetrics, dest, origin],
  );

  const cards = useMemo(
    () => ["KCCI", "SCFI", "BDI", "WCI"].map((code) => statFor(stats, code, history)),
    [history, stats],
  );

  const trendData = useMemo(() => {
    const codes = ["SCFI", "KCCI", "BDI", "WCI"];
    const byDate = new Map<string, Record<string, number | string>>();
    for (const row of history.filter(
      (item) => codes.includes(item.index_code) && item.value != null,
    )) {
      const key = row.week_date.slice(5, 10);
      const point = byDate.get(key) ?? { label: key };
      point[row.index_code] = row.value ?? 0;
      byDate.set(key, point);
    }
    return [...byDate.values()].slice(-8);
  }, [history]);

  const seaOnlyMetrics = useMemo(
    () => visibleMetrics.filter((row) => row.mode === "해상"),
    [visibleMetrics],
  );
  const mapRoutes = useMemo(() => buildMapRoutes(seaOnlyMetrics), [seaOnlyMetrics]);

  const risingCount = visibleMetrics.filter((row) => (row.mom ?? 0) > 0).length;
  const fallingCount = visibleMetrics.filter((row) => (row.mom ?? 0) < 0).length;
  const unchangedCount = visibleMetrics.length - risingCount - fallingCount;
  const ratesForecasts = forecasts.filter((forecast) => forecast.module === "rates").slice(0, 4);
  const latestBunker = bunker.at(0);
  const tickerItems = useMemo(
    () =>
      orderedTickerStats(stats).map((stat) => ({
        code: stat.index_code,
        value: stat.latest_value!.toLocaleString("en-US", { maximumFractionDigits: 2 }),
        changePct: stat.change_pct,
      })),
    [stats],
  );

  return (
    <main className="min-h-screen bg-[#eaf2fb] text-slate-900">
      <DashboardTicker items={tickerItems} />
      <Hero latestMonth={latestMonth} routeCount={visibleMetrics.length} />

      <div className="relative z-10 mx-auto mt-3 flex w-full max-w-[1540px] flex-col gap-3 px-4 pb-4 lg:px-12">
        <FilterBar
          mode={mode}
          setMode={setMode}
          period={period}
          setPeriod={setPeriod}
          origin={origin}
          setOrigin={setOrigin}
          dest={dest}
          setDest={setDest}
          origins={origins}
          dests={dests}
          onReset={() => {
            setMode("all");
            setPeriod("6m");
            setOrigin("all");
            setDest("all");
          }}
        />

        <section className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1.05fr]">
          {cards.map((card) => (
            <IndexCard key={card.index_code} stat={card} history={history} />
          ))}
          <MarketSummary
            total={visibleMetrics.length}
            rising={risingCount}
            falling={fallingCount}
            unchanged={unchangedCount}
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(620px,1.15fr)_minmax(640px,1fr)]">
          <Panel className="min-h-[620px]" title="글로벌 운임 지도" action="종합 운임 지수">
            <FreightMap routes={mapRoutes} />
          </Panel>
          <Panel
            className="min-h-[620px]"
            title={`전체 운임 목록 (${visibleMetrics.length})`}
            action="열 설정"
          >
            <RatesTable rows={visibleMetrics} />
          </Panel>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.16fr_1.5fr]">
          <Panel title="운임 추이 비교" action={PERIOD_LABEL[period]}>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e7edf5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={42} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #dbe5f1" }} />
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
          </Panel>
          <Panel title="최근 리포트" action="저장 데이터">
            <ReportList forecasts={ratesForecasts} bunkerLabel={latestBunker?.grade ?? null} />
            <div className="mt-3 rounded-lg border border-[#dbe6f4] bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              환율 기준 USD/KRW {fmtNumber(exchangeRate?.usd_krw, 2)} ·{" "}
              {exchangeRate?.rate_date?.slice(0, 10) ?? "-"}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Hero({ latestMonth, routeCount }: { latestMonth: string | null; routeCount: number }) {
  return (
    <section className="relative min-h-[220px] overflow-hidden bg-[#071b31] px-4 py-6 text-white lg:px-12 lg:py-7">
      <div
        className="absolute inset-0 bg-cover bg-[position:78%_34%]"
        style={{ backgroundImage: "url(/dashboard-hero.png)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(5,18,34,0.98) 0%, rgba(7,24,43,0.92) 42%, rgba(9,32,57,0.45) 72%, rgba(7,22,40,0.24) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-20"
        style={{ background: "linear-gradient(180deg, transparent, rgba(234,242,251,0.98))" }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-[1540px]">
        <h1 className="text-[34px] font-black leading-tight tracking-normal sm:text-[42px] lg:text-[48px]">
          <span>운임 </span>
          <span className="text-[#36a9ff]">Control Tower</span>
        </h1>
        <p className="mt-2 max-w-[620px] text-sm font-medium leading-6 text-white/82 lg:text-[15px]">
          저장된 KITA 운임과 글로벌 지수를 기준으로 해상·항공 운임 동향을 한눈에 확인합니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur bg-white/10">
            <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden />
            <span className="text-white/68">기준월</span>
            <span className="text-white">{fmtMonth(latestMonth)}</span>
          </span>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur bg-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
            <span className="text-white/68">조회 노선</span>
            <span className="text-white">{routeCount}개</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  mode,
  setMode,
  period,
  setPeriod,
  origin,
  setOrigin,
  dest,
  setDest,
  origins,
  dests,
  onReset,
}: {
  mode: ModeKey;
  setMode: (value: ModeKey) => void;
  period: PeriodKey;
  setPeriod: (value: PeriodKey) => void;
  origin: string;
  setOrigin: (value: string) => void;
  dest: string;
  setDest: (value: string) => void;
  origins: string[];
  dests: string[];
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#d8e3ef] bg-white p-4 shadow-[0_10px_28px_rgba(15,35,65,0.06)]">
      <div className="grid gap-3 xl:grid-cols-[0.8fr_1fr_1fr_0.8fr_auto_auto]">
        <SelectBlock label="운송 방식" value={mode} onChange={(value) => setMode(value as ModeKey)}>
          {Object.entries(MODE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectBlock>
        <SelectBlock label="출발지" value={origin} onChange={setOrigin}>
          <option value="all">전체</option>
          {origins.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectBlock>
        <SelectBlock label="도착지" value={dest} onChange={setDest}>
          <option value="all">전체</option>
          {dests.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectBlock>
        <SelectBlock
          label="기간"
          value={period}
          onChange={(value) => setPeriod(value as PeriodKey)}
        >
          {Object.entries(PERIOD_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectBlock>
        <button
          className="h-[54px] rounded-md border border-[#d8e3ef] px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={onReset}
        >
          초기화
        </button>
        <button
          className="inline-flex h-[54px] items-center justify-center gap-2 rounded-md bg-[#06182d] px-6 text-sm font-black text-white shadow-lg shadow-slate-900/15"
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          적용하기
        </button>
      </div>
    </section>
  );
}

function SelectBlock({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-600">{label}</span>
      <span className="relative block">
        <select
          className="h-10 w-full appearance-none rounded-md border border-[#d8e3ef] bg-white px-3 pr-9 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </span>
    </label>
  );
}

function IndexCard({ stat, history }: { stat: IndexStats; history: FreightIndexHistoryRow[] }) {
  const series = indexSeries(history, stat.index_code)
    .slice(-12)
    .map((row) => ({
      label: row.week_date.slice(5, 10),
      value: row.value,
    }));
  const color = INDEX_COLORS[stat.index_code] ?? "#2563eb";

  return (
    <article className="rounded-lg border border-[#d8e3ef] bg-white p-4 shadow-[0_10px_28px_rgba(15,35,65,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-800">
            {stat.index_code}{" "}
            <span className="text-xs font-bold text-slate-500">
              ({INDEX_LABELS[stat.index_code] ?? "운임지수"})
            </span>
          </p>
          <p className="mt-2 text-2xl font-black tracking-normal text-slate-950">
            {fmtNumber(stat.latest_value, 2)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${pctTone(stat.change_pct)} bg-slate-50`}
        >
          {stat.change_pct != null && stat.change_pct >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {fmtPct(stat.change_pct)}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-slate-500">WoW</p>
      <div className="mt-1 h-[56px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-between text-xs font-bold text-slate-500">
        <span>{stat.source ?? "저장 지수"}</span>
        <span>{stat.latest_date?.slice(0, 10) ?? "-"}</span>
      </div>
    </article>
  );
}

function MarketSummary({
  total,
  rising,
  falling,
  unchanged,
}: {
  total: number;
  rising: number;
  falling: number;
  unchanged: number;
}) {
  const rows = [
    {
      label: "상승 노선",
      value: rising,
      pct: total ? (rising / total) * 100 : 0,
      color: "text-rose-600",
    },
    {
      label: "하락 노선",
      value: falling,
      pct: total ? (falling / total) * 100 : 0,
      color: "text-blue-600",
    },
    {
      label: "보합 노선",
      value: unchanged,
      pct: total ? (unchanged / total) * 100 : 0,
      color: "text-slate-600",
    },
  ];
  return (
    <article className="rounded-lg border border-[#d8e3ef] bg-white p-4 shadow-[0_10px_28px_rgba(15,35,65,0.06)]">
      <p className="text-sm font-black text-slate-800">시장 요약</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 text-sm font-bold"
          >
            <span className="text-slate-600">{row.label}</span>
            <span className={row.color}>
              {row.value} <span className="text-xs text-slate-400">({fmtNumber(row.pct, 0)}%)</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-[#e6edf5] pt-3 text-xs font-bold text-slate-500">
        조회된 실데이터 노선 {total}개 기준
      </p>
    </article>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-[#d8e3ef] bg-white p-4 shadow-[0_10px_28px_rgba(15,35,65,0.06)] ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-base font-black tracking-normal text-slate-950">{title}</h2>
        {action ? (
          <button
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[#d8e3ef] bg-white px-3 text-xs font-black text-slate-600"
            type="button"
          >
            {action}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapTargetLongitude(from: MapPoint, to: MapPoint): MapPoint {
  let lng = to[0];
  const delta = lng - from[0];
  if (delta < -180) lng += 360;
  if (delta > 180) lng -= 360;
  return [lng, to[1]];
}

function toLeafletLatLng([lng, lat]: MapPoint): [number, number] {
  return [lat, lng];
}

function routeArc(from: MapPoint, to: MapPoint): [number, number][] {
  const wrappedTo = wrapTargetLongitude(from, to);
  const lngDelta = wrappedTo[0] - from[0];
  const latDelta = wrappedTo[1] - from[1];
  const arcLift = Math.min(28, Math.max(9, Math.abs(lngDelta) * 0.14));

  return Array.from({ length: 34 }, (_, index) => {
    const t = index / 33;
    const lng = from[0] + lngDelta * t;
    const lat = from[1] + latDelta * t + Math.sin(Math.PI * t) * arcLift;
    return [lat, lng];
  });
}

function routeTooltip(row: RouteMetric) {
  return `
    <div style="font-size:12px;font-weight:800;color:#10233f;line-height:1.45">
      <div>${escapeHtml(row.origin)} → ${escapeHtml(row.dest)}</div>
      <div style="margin-top:3px;color:#536983">${escapeHtml(formatRate(row))} · ${escapeHtml(fmtPct(row.mom))}</div>
    </div>
  `;
}

function createRouteIcon(leaflet: LeafletModule, color: string, label?: string) {
  return leaflet.divIcon({
    className: "",
    html: `<span style="
      display:inline-flex;
      min-width:${label ? "34px" : "12px"};
      height:${label ? "22px" : "12px"};
      align-items:center;
      justify-content:center;
      border-radius:999px;
      border:2px solid #fff;
      background:${color};
      box-shadow:0 6px 18px rgba(15,35,65,.22);
      color:#fff;
      font-size:10px;
      font-weight:900;
      line-height:1;
      transform:translate(-50%,-50%);
    ">${label ? escapeHtml(label) : ""}</span>`,
    iconAnchor: [0, 0],
  });
}

function drawFreightRoutes(
  leaflet: LeafletModule,
  routes: { row: RouteMetric; from: MapPoint; to: MapPoint }[],
) {
  const group = leaflet.layerGroup();
  const colors = ["#ef4565", "#0ea5e9", "#10b981", "#f97316", "#8b5cf6", "#06b6d4"];
  const originIcon = createRouteIcon(leaflet, "#0284c7", "부산");

  for (const [index, { row, from, to }] of routes.entries()) {
    const color = colors[index % colors.length];
    const wrappedTo = wrapTargetLongitude(from, to);
    const arc = routeArc(from, to);

    leaflet
      .polyline(arc, {
        color,
        weight: 2.4,
        opacity: 0.78,
        lineCap: "round",
        lineJoin: "round",
      })
      .bindTooltip(routeTooltip(row), {
        direction: "top",
        opacity: 0.96,
        sticky: true,
        className: "logisight-map-tooltip",
      })
      .addTo(group);

    const arrowPoint = arc[Math.max(0, arc.length - 4)];
    const endPoint = arc.at(-1) ?? toLeafletLatLng(wrappedTo);
    const angle =
      (Math.atan2(endPoint[0] - arrowPoint[0], endPoint[1] - arrowPoint[1]) * 180) / Math.PI;

    leaflet
      .marker(endPoint, {
        interactive: false,
        icon: leaflet.divIcon({
          className: "",
          html: `<span style="
            display:block;
            width:0;
            height:0;
            border-top:5px solid transparent;
            border-bottom:5px solid transparent;
            border-left:10px solid ${color};
            filter:drop-shadow(0 2px 3px rgba(15,35,65,.22));
            transform:translate(-50%,-50%) rotate(${angle}deg);
          "></span>`,
          iconAnchor: [0, 0],
        }),
      })
      .addTo(group);

    leaflet
      .marker(toLeafletLatLng(wrappedTo), {
        icon: createRouteIcon(leaflet, color),
      })
      .bindTooltip(routeTooltip(row), {
        direction: "top",
        opacity: 0.96,
        sticky: true,
        className: "logisight-map-tooltip",
      })
      .addTo(group);
  }

  if (routes[0]) {
    leaflet
      .marker(toLeafletLatLng(routes[0].from), {
        icon: originIcon,
        zIndexOffset: 1000,
      })
      .addTo(group);
  }

  return group;
}

function FreightMap({ routes }: { routes: { row: RouteMetric; from: MapPoint; to: MapPoint }[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<import("leaflet").Map | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncMap() {
      if (!mapRef.current) return;
      const leaflet = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      let map = leafletMapRef.current;
      if (!map) {
        map = leaflet.map(mapRef.current, {
          attributionControl: false,
          center: [12, 155],
          maxBoundsViscosity: 0,
          minZoom: 1,
          preferCanvas: true,
          scrollWheelZoom: false,
          worldCopyJump: false,
          zoom: 1.45,
          zoomControl: false,
          zoomSnap: 0.25,
        });

        leaflet
          .tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            detectRetina: true,
            maxZoom: 7,
            minZoom: 1,
            noWrap: false,
            subdomains: "abcd",
          })
          .addTo(map);

        leaflet.control.zoom({ position: "bottomright" }).addTo(map);
        leafletMapRef.current = map;
      }

      routeLayerRef.current?.remove();
      routeLayerRef.current = drawFreightRoutes(leaflet, routes).addTo(map);
      map.setView([12, 155], 1.45, { animate: false });
      window.setTimeout(() => map.invalidateSize(), 80);
    }

    syncMap();

    return () => {
      cancelled = true;
    };
  }, [routes]);

  useEffect(
    () => () => {
      routeLayerRef.current?.remove();
      routeLayerRef.current = null;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    },
    [],
  );

  return (
    <div className="relative h-[540px] overflow-hidden rounded-lg border border-[#e1eaf4] bg-[#eef4fa]">
      <div ref={mapRef} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute left-4 top-4 z-[420] rounded-md border border-white/80 bg-white/90 px-3 py-2 shadow-[0_8px_20px_rgba(15,35,65,.12)]">
        <p className="text-xs font-black text-slate-800">부산발 실데이터 노선</p>
        <p className="mt-0.5 text-[11px] font-bold text-slate-500">태평양 중심 · KITA 해상 운임</p>
      </div>
      <div className="absolute bottom-6 left-8 right-8">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 via-emerald-500 to-red-500" />
        <div className="mt-1 flex justify-between text-xs font-bold text-slate-500">
          <span>-30%</span>
          <span>0%</span>
          <span>+30%</span>
        </div>
      </div>
      {routes.length === 0 ? (
        <div className="absolute inset-0 z-[430] flex items-center justify-center bg-white/70 text-sm font-bold text-slate-500">
          좌표 매칭 가능한 저장 노선이 없습니다.
        </div>
      ) : null}
    </div>
  );
}

function RatesTable({ rows }: { rows: RouteMetric[] }) {
  const pageSize = 8;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [tableMode, setTableMode] = useState<ModeKey>("all");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const modeMatches =
          tableMode === "all" ||
          (tableMode === "sea" && row.mode === "해상") ||
          (tableMode === "air" && row.mode === "항공");
        if (!modeMatches) return false;
        if (!normalizedQuery) return true;
        return [row.origin, row.dest, row.region ?? "", row.unit, row.currency, formatRate(row)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, rows, tableMode],
  );

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, rows.length, tableMode]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const maxVisiblePages = Math.min(totalPages, 4);
  const startPage = Math.min(
    Math.max(1, safePage - Math.floor(maxVisiblePages / 2)),
    Math.max(1, totalPages - maxVisiblePages + 1),
  );
  const visiblePages = Array.from({ length: maxVisiblePages }, (_, index) => startPage + index);

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(240px,1fr)_132px_118px]">
        <label className="flex h-9 items-center gap-2 rounded-md border border-[#d8e3ef] px-3 text-sm font-bold text-slate-500 focus-within:border-blue-400">
          <Search className="h-4 w-4" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="노선, 항로, 항만 검색"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="relative block">
          <select
            className="h-9 w-full appearance-none rounded-md border border-[#d8e3ef] bg-white px-3 pr-8 text-sm font-black text-slate-600 outline-none focus:border-blue-400"
            value={tableMode}
            onChange={(event) => setTableMode(event.target.value as ModeKey)}
          >
            <option value="all">전체</option>
            <option value="sea">해상</option>
            <option value="air">항공</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[#d8e3ef] bg-white px-3 text-sm font-black text-slate-600"
          type="button"
        >
          <span className="h-4 w-8 rounded-full bg-slate-200 p-0.5">
            <span className="block h-3 w-3 rounded-full bg-white shadow" />
          </span>
          변동률(%)
        </button>
      </div>
      {filteredRows.length === 0 ? (
        <EmptyState>선택한 조건에 해당하는 운임 데이터가 없습니다.</EmptyState>
      ) : (
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="text-xs font-black text-slate-500">
            <tr className="border-b border-[#e3ebf5]">
              <th className="py-2 pr-3">노선</th>
              <th className="whitespace-nowrap py-2 pr-3">운임</th>
              <th className="whitespace-nowrap py-2 pr-3">전월 대비</th>
              <th className="whitespace-nowrap py-2 pr-3">YTD</th>
              <th className="whitespace-nowrap py-2 pr-3">최근 추이</th>
              <th className="whitespace-nowrap py-2 pr-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#edf2f7] font-bold text-slate-700 last:border-0"
              >
                <td className="py-2.5 pr-3 text-slate-900">
                  <div className="max-w-[220px] truncate">
                    {row.origin} → {row.dest}
                  </div>
                  <div className="text-xs text-slate-400">{fmtMonth(row.latestMonth)}</div>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3">{formatRate(row)}</td>
                <td className={`whitespace-nowrap py-2.5 pr-3 ${pctTone(row.mom)}`}>
                  {fmtPct(row.mom)}
                </td>
                <td className={`whitespace-nowrap py-2.5 pr-3 ${pctTone(row.ytd)}`}>
                  {fmtPct(row.ytd)}
                </td>
                <td className="py-2.5 pr-3">
                  <TinySparkline values={row.spark} positive={(row.mom ?? 0) >= 0} />
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-black ${row.mom != null && Math.abs(row.mom) >= 10 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {valueTone(row.mom)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-600">
        <div className="flex items-center gap-2">
          <button
            className="h-8 w-8 rounded-md text-slate-400 disabled:opacity-35"
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            ‹
          </button>
          {startPage > 1 ? <span>...</span> : null}
          {visiblePages.map((pageNumber) => (
            <button
              key={pageNumber}
              className={`h-8 w-8 rounded-md ${
                pageNumber === safePage
                  ? "border border-blue-300 bg-blue-50 text-blue-600"
                  : "text-slate-600"
              }`}
              type="button"
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          {visiblePages.at(-1) !== totalPages ? <span>...</span> : null}
          <button
            className="h-8 w-8 rounded-md text-slate-600 disabled:opacity-35"
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            ›
          </button>
        </div>
        <button
          className="h-9 rounded-md border border-[#d8e3ef] bg-white px-3 text-xs font-black text-slate-600"
          type="button"
        >
          {filteredRows.length}개 · {pageSize} / 페이지
        </button>
      </div>
    </div>
  );
}

function TinySparkline({
  values,
  positive,
  compact = false,
}: {
  values: number[];
  positive: boolean;
  compact?: boolean;
}) {
  const data = values.map((value, index) => ({ index, value }));
  if (data.length < 2) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className={compact ? "h-6 w-full min-w-14" : "h-8 w-24"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 0, bottom: 3, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={positive ? "#2563eb" : "#0f9f6e"}
            strokeWidth={1.8}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReportList({
  forecasts,
  bunkerLabel,
}: {
  forecasts: { id: string; statement: string; published_at: string | null; created_at: string }[];
  bunkerLabel: string | null;
}) {
  if (forecasts.length === 0) {
    return (
      <div>
        <EmptyState>저장된 운임 리포트가 없습니다.</EmptyState>
        {bunkerLabel ? (
          <div className="mt-3 rounded-lg border border-[#dbe6f4] px-3 py-2 text-xs font-bold text-slate-500">
            최신 유가 데이터: {bunkerLabel}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="divide-y divide-[#e6edf5]">
      {forecasts.map((forecast) => (
        <div key={forecast.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-4 w-4 flex-none text-slate-500" />
            <p className="truncate text-sm font-bold text-slate-800">
              {shortReportTitle(forecast.statement, forecast.published_at ?? forecast.created_at)}
            </p>
          </div>
          <span className="flex-none text-xs font-bold text-slate-500">
            {(forecast.published_at ?? forecast.created_at).slice(0, 10)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-[#d8e3ef] bg-slate-50 px-4 text-center text-sm font-bold text-slate-500">
      {children}
    </div>
  );
}
