import { queryOptions } from "@tanstack/react-query";
import { getLatestExchangeRate, getExchangeRateHistory } from "./exchange-rates.functions";

export type ExchangeRateRow = {
  rate_date: string;
  usd_krw: number;
  source: string;
  fetched_at: string;
};

// Convert USD amount to KRW using a rate row
export function usdToKrw(usd: number, rate: ExchangeRateRow): number {
  return usd * rate.usd_krw;
}

// Format air freight display: "2.45 USD/kg (₩3,185 · @1,300 · 2025.06.01)"
export function formatAirFrightDisplay(
  usdPerKg: number,
  rate: ExchangeRateRow | null,
): string {
  const usdStr = `${usdPerKg.toFixed(2)} USD/kg`;
  if (!rate) return usdStr;
  const krw = Math.round(usdPerKg * rate.usd_krw);
  const rateStr = Math.round(rate.usd_krw).toLocaleString("ko-KR");
  const dateStr = rate.rate_date.slice(0, 10);
  return `${usdStr} (₩${krw.toLocaleString("ko-KR")} · @${rateStr} · ${dateStr})`;
}

export const latestExchangeRateQueryOptions = () =>
  queryOptions({
    queryKey: ["exchange_rates", "latest"],
    queryFn: () => getLatestExchangeRate(),
    staleTime: 60 * 60 * 1000,
  });

export const exchangeRateHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["exchange_rates", "history"],
    queryFn: () => getExchangeRateHistory(),
    staleTime: 60 * 60 * 1000,
  });
