import { queryOptions } from "@tanstack/react-query";

import {
  getFreightIndicesHistory,
  getRateFilterOptions,
  getFreightRates,
  getBunkerPrices,
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