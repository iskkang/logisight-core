import { queryOptions } from "@tanstack/react-query";

import {
  getPublishedForecasts,
  saveForecastDraft,
  publishForecast,
  resolveForecast,
} from "./forecasts.functions";

export type ForecastModule = "rates" | "eurasia" | "trade" | "policy";
export type ForecastStatus = "draft" | "published" | "resolved";
export type ForecastOutcome = "hit" | "partial" | "miss";

export type Forecast = {
  id: string;
  module: ForecastModule;
  statement: string;
  basis: string[] | null;
  impact_note: string | null;
  horizon_date: string | null;
  confidence: "high" | "medium" | "low" | null;
  invalidation_condition: string | null;
  status: ForecastStatus;
  outcome: ForecastOutcome | null;
  outcome_note: string | null;
  metric_ref: string | null;
  created_at: string;
  published_at: string | null;
  resolved_at: string | null;
};

export { saveForecastDraft, publishForecast, resolveForecast };

export const MODULE_LABEL: Record<ForecastModule, string> = {
  rates: "운임",
  eurasia: "유라시아",
  trade: "무역",
  policy: "정책",
};

// Public display — published/resolved only.
export const publishedForecastsQueryOptions = () =>
  queryOptions({
    queryKey: ["forecasts", "published"],
    queryFn: () => getPublishedForecasts(),
    staleTime: 5 * 60 * 1000,
  });

/** Hit-rate over ALL published forecasts (resolved count as denominator). */
export function hitRate(forecasts: Forecast[]): {
  resolved: number;
  hit: number;
  partial: number;
  miss: number;
  rate: number | null;
} {
  const resolved = forecasts.filter((f) => f.status === "resolved");
  const hit = resolved.filter((f) => f.outcome === "hit").length;
  const partial = resolved.filter((f) => f.outcome === "partial").length;
  const miss = resolved.filter((f) => f.outcome === "miss").length;
  const rate =
    resolved.length === 0 ? null : Math.round(((hit + partial * 0.5) / resolved.length) * 100);
  return { resolved: resolved.length, hit, partial, miss, rate };
}
