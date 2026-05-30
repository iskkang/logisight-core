import { queryOptions } from "@tanstack/react-query";

import { getTradeProvisional } from "./trade.functions";

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

export const tradeProvisionalQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "provisional"],
    queryFn: () => getTradeProvisional(),
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
  if (!p || p.length < 6) return p ?? "—";
  return `${p.slice(0, 4)}.${p.slice(4, 6)}`;
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

export function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}