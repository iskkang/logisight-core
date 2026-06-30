import { queryOptions } from "@tanstack/react-query";

import {
  getTradeProvisional,
  getTradeByCountry,
  getTradeByItem,
  getTradeStatisticsBundle,
} from "./trade.functions";

export type TradeStatType =
  | "country"
  | "provisional_exp"
  | "provisional_imp"
  | "continent"
  | "item"
  | "item_country"
  | "newnature";

export type TradeStatRow = {
  id?: string;
  period: string;
  priod_dt: string | null;
  direction: string | null;
  stat_type: TradeStatType | string;
  hs_code: string | null;
  hs_name: string | null;
  country_code: string | null;
  country_name: string | null;
  export_usd: number | null;
  export_weight: number | null;
  import_usd: number | null;
  import_weight: number | null;
  trade_balance: number | null;
  data_source: string | null;
  fetched_at?: string | null;
};

export type TradeStatisticsBundle = {
  country: TradeStatRow[];
  provisional: TradeStatRow[];
  continent: TradeStatRow[];
  item: TradeStatRow[];
};

export type TradeProvisionalRow = {
  period: string; // YYYYMM
  priod_dt: string | null; // YYYYMMDD or YYYY-MM-DD
  stat_type: string; // 'provisional_exp' | 'provisional_imp'
  country_code: string | null;
  country_name: string | null;
  export_usd: number | null;
  import_usd: number | null;
  trade_balance: number | null;
};

export type TradeCountryRow = {
  period: string; // YYYY-MM
  country_code: string | null;
  country_name: string | null;
  export_usd: number | null;
  import_usd: number | null;
  trade_balance: number | null;
};

export const tradeProvisionalQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "provisional"],
    queryFn: () => getTradeProvisional(),
    staleTime: 10 * 60 * 1000,
  });

export const tradeByCountryQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "country"],
    queryFn: () => getTradeByCountry(),
    staleTime: 10 * 60 * 1000,
  });

export function formatUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatPeriod(p: string | null | undefined): string {
  // "202606"·"2026-06" 혼재 — 숫자만 추출해 통일.
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length < 6) return p ?? "—";
  return `${d.slice(0, 4)}.${d.slice(4, 6)}`;
}

export function prevPeriod(p: string): string {
  if (!p || p.length < 6) return p;
  const y = Number(p.slice(0, 4));
  const m = Number(p.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 2, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

export type TradeItemRow = {
  period: string;
  hs_code: string | null;
  hs_name: string | null;
  export_usd: number | null;
  export_weight: number | null;
  import_usd: number | null;
  import_weight: number | null;
  country_code: string | null;
  country_name: string | null;
};

export const tradeByItemQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "item"],
    queryFn: () => getTradeByItem(),
    staleTime: 60 * 60 * 1000,
  });

export const tradeStatisticsBundleQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "bundle"],
    queryFn: () => getTradeStatisticsBundle(),
    staleTime: 30 * 60 * 1000,
  });

export function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
