import { queryOptions } from "@tanstack/react-query";

import {
  getPublishedForecasts,
  getForecastSeriesBatch,
  saveForecastDraft,
  publishForecast,
  resolveForecast,
  annotateForecast,
} from "./forecasts.functions";
import type { ForecastSeries } from "./forecasts.functions";

export type ForecastModule = "rates" | "eurasia" | "trade" | "policy";
export type ForecastStatus = "draft" | "published" | "resolved";
export type ForecastOutcome = "hit" | "partial" | "miss";
export type ForecastDirection = "up" | "flat" | "down";

export type FactorScore = {
  factor: string;
  score: number | null;
  weight?: number;
  missing?: boolean;
};

export type WatchPoint = { label: string; source: string; due: string };

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
  // Scoring layer (present only after the scoring migration; all optional/resilient).
  cadence?: "weekly" | "monthly" | null;
  direction?: ForecastDirection | null;
  strength?: string | null;
  expected_range_pct?: string | null;
  range_low_pct?: number | null;
  range_high_pct?: number | null;
  composite_score?: number | null;
  confidence_reason?: string | null;
  factor_scores?: FactorScore[] | null;
  data_quality_flags?: string[] | null;
  model_version?: string | null;
  metric_value_at_publish?: number | null;
  realized_pct?: number | null;
  watch_points?: WatchPoint[] | null;
};

export type { ForecastSeries };
export { saveForecastDraft, publishForecast, resolveForecast, annotateForecast };

export const MODULE_LABEL: Record<ForecastModule, string> = {
  rates: "운임",
  eurasia: "유라시아",
  trade: "무역",
  policy: "정책",
};

/** A resolved miss/partial without an editor retrospective yet → "복기 작성 중". */
export function needsRetrospective(f: Forecast): boolean {
  return (
    f.status === "resolved" &&
    (f.outcome === "miss" || f.outcome === "partial") &&
    !f.outcome_note?.trim()
  );
}

// Public display — published/resolved only.
export const publishedForecastsQueryOptions = () =>
  queryOptions({
    queryKey: ["forecasts", "published"],
    queryFn: () => getPublishedForecasts(),
    staleTime: 5 * 60 * 1000,
  });

// 카드별 스파크라인 시계열 — 전 방문자 동일이라 단일 배치(id→series), loader prefetch + SSR 캐시.
export const forecastSeriesQueryOptions = () =>
  queryOptions({
    queryKey: ["forecasts", "series"],
    queryFn: () => getForecastSeriesBatch(),
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
