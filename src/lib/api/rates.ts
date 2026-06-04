import { queryOptions } from "@tanstack/react-query";

import {
  getFreightIndicesHistory,
  getRateFilterOptions,
  getFreightRates,
  getBunkerPrices,
  getKitaAirRates,
  getKitaSeaRates,
} from "./rates.functions";

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

// ⚠️ kita_air_rates: kg100/300/500 unit is USD/kg (KITA publishes USD directly)
export type KitaAirRateRow = {
  origin: string;
  dest: string;
  region: string | null;
  year_mon: string;
  kg100: number | null;
  kg300: number | null;
  kg500: number | null;
  chg100: number | null; // MoM % change for kg100
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
  teu_chg: number | null; // MoM % change
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
export function computeMoM(
  series: { year_mon: string; value: number | null }[],
): number | null {
  const sorted = [...series]
    .filter((p) => p.value !== null)
    .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (latest.value === null || prev.value === null || prev.value === 0) return null;
  return ((latest.value - prev.value) / prev.value) * 100;
}

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