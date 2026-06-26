import { queryOptions } from "@tanstack/react-query";

import {
  getFreightIndicesHistory,
  getRateFilterOptions,
  getFreightRates,
  getBunkerPrices,
  getBunkerHistory,
  getIataJetFuelHistory,
  getKitaAirRates,
  getKitaSeaRates,
  getIndexStats,
  getKcciRouteStats,
} from "./rates.functions";

export type { IataJetFuelRow } from "./rates.functions";

export type FreightIndexHistoryRow = {
  index_code: string;
  value: number | null;
  change_pct: number | null;
  week_date: string;
  source: string | null;
  source_url: string | null;
};

export type FreightRateRow = {
  id: string;
  carrier: string | null;
  pol_code: string;
  pol_name: string | null;
  pod_code: string;
  pod_name: string | null;
  container_type: string;
  rate_usd: number | null;
  currency: string | null;
  weekly_change_pct: number | null;
  is_partner_rate: boolean | null;
  transit_days: number | null;
  valid_from: string | null;
  valid_until: string | null;
  data_source: string;
  source_updated_at: string | null;
  display_order: number | null;
};

export type BunkerPriceRow = {
  grade: string;
  port: string;
  price_usd: number | null;
  obs_date: string;
  source: string;
  source_url: string | null;
};

export type RateFilterOptions = {
  pols: { code: string; name: string }[];
  pods: { code: string; name: string }[];
  containerTypes: string[];
};

export const freightIndicesHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["freight_indices", "history"],
    queryFn: () => getFreightIndicesHistory(),
    staleTime: 5 * 60 * 1000,
  });

export const rateFilterOptionsQueryOptions = () =>
  queryOptions({
    queryKey: ["freight_rates", "filters"],
    queryFn: () => getRateFilterOptions(),
    staleTime: 30 * 60 * 1000,
  });

export const freightRatesQueryOptions = (args: {
  polCode?: string;
  podCode?: string;
  containerType?: string;
}) =>
  queryOptions({
    queryKey: ["freight_rates", args],
    queryFn: () =>
      getFreightRates({
        data: {
          polCode: args.polCode,
          podCode: args.podCode,
          containerType: args.containerType,
          limit: 80,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });

export const bunkerPricesQueryOptions = () =>
  queryOptions({
    queryKey: ["bunker_prices", "latest"],
    queryFn: () => getBunkerPrices(),
    staleTime: 10 * 60 * 1000,
  });

export const bunkerHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["bunker_prices", "history"],
    queryFn: () => getBunkerHistory(),
    staleTime: 10 * 60 * 1000,
  });

export const iataJetFuelQueryOptions = () =>
  queryOptions({
    queryKey: ["iata_jet_fuel", "history"],
    queryFn: () => getIataJetFuelHistory(),
    staleTime: 60 * 60 * 1000,
  });

// KITA air rates: kg100/300/500 are KRW/kg. chg fields are absolute KRW/kg deltas.
export type KitaAirRateRow = {
  origin: string;
  dest: string;
  region: string | null;
  year_mon: string;
  kg100: number | null;
  kg300: number | null;
  kg500: number | null;
  chg100: number | null;
  chg300: number | null;
  chg500: number | null;
};

export type KitaSeaRateRow = {
  origin: string;
  dest: string;
  region: string | null;
  year_mon: string;
  teu: number | null;
  feu: number | null;
  teu_chg: number | null; // absolute USD delta
  feu_chg: number | null;
};

export type KitaPercentileResult = {
  pct52w: number;
  normalLow: number;
  normalHigh: number;
  asOf: string;
};

// Returns the latest record per origin+dest pair
export function latestByRoute<T extends { origin: string; dest: string; year_mon: string }>(
  rows: T[],
): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const key = `${r.origin}__${r.dest}`;
    const existing = map.get(key);
    if (!existing || r.year_mon > existing.year_mon) map.set(key, r);
  }
  return [...map.values()];
}

// Compute MoM change from a series (uses YYYYMM format)
export function computeMoM(series: { year_mon: string; value: number | null }[]): number | null {
  const sorted = [...series]
    .filter((p) => p.value !== null)
    .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (latest.value === null || prev.value === null || prev.value === 0) return null;
  return ((latest.value - prev.value) / prev.value) * 100;
}

export type IndexStats = {
  index_code: string;
  latest_value: number | null;
  latest_date: string | null;
  change_pct: number | null;
  mom_pct: number | null;
  yoy_pct: number | null;
  pct_52w: number | null;
  normal_range: [number, number] | null;
  source: string | null;
};

// 운임 티커 표기 순서(가공 라벨 금지 — freight_indices 실코드만). 운임/홈 공통.
export const INDEX_TICKER_ORDER = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"];

// 티커 노출용: 값 결측 제외 + 표기 순서 정렬.
export function orderedTickerStats(stats: IndexStats[]): IndexStats[] {
  const rank = new Map(INDEX_TICKER_ORDER.map((code, index) => [code, index]));
  return [...stats]
    .filter((stat) => stat.latest_value != null)
    .sort(
      (a, b) =>
        (rank.get(a.index_code) ?? INDEX_TICKER_ORDER.length) -
        (rank.get(b.index_code) ?? INDEX_TICKER_ORDER.length),
    );
}

export const indexStatsQueryOptions = () =>
  queryOptions({
    queryKey: ["freight_indices", "stats"],
    queryFn: () => getIndexStats(),
    staleTime: 30 * 60 * 1000,
  });

// KCCI 권역별 항로(한국발 $/FEU) — change_pct=KOBC 보고 WoW, mom_pct=4주 전 대비.
export type KcciRouteStat = {
  index_code: string;
  latest_value: number | null;
  latest_date: string | null;
  change_pct: number | null;
  mom_pct: number | null;
};

export const KCCI_ROUTE_LABELS: Record<string, string> = {
  KCCI_USWC: "미주서안", KCCI_USEC: "미주동안", KCCI_NEU: "북유럽", KCCI_MED: "지중해",
  KCCI_ME: "중동", KCCI_SEA: "동남아", KCCI_CN: "중국", KCCI_JP: "일본",
  KCCI_SAE: "남미동안", KCCI_SAW: "남미서안", KCCI_ZAF: "남아프리카", KCCI_WAF: "서아프리카", KCCI_AU: "호주",
};

export const kcciRouteStatsQueryOptions = () =>
  queryOptions({
    queryKey: ["freight_indices", "kcci_routes"],
    queryFn: () => getKcciRouteStats(),
    staleTime: 30 * 60 * 1000,
  });

export const kitaAirRatesQueryOptions = () =>
  queryOptions({
    queryKey: ["kita_air_rates"],
    queryFn: () => getKitaAirRates(),
    staleTime: 60 * 60 * 1000,
  });

export const kitaSeaRatesQueryOptions = () =>
  queryOptions({
    queryKey: ["kita_sea_rates"],
    queryFn: () => getKitaSeaRates(),
    staleTime: 60 * 60 * 1000,
  });

export function formatNumber(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}
