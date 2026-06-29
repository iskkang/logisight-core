import { createFileRoute } from "@tanstack/react-router";

import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import {
  iataJetFuelQueryOptions,
  indexStatsQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
} from "@/lib/api/rates";
import { seoHead } from "@/lib/seo";
import { eurasiaDisruptionsActiveQueryOptions } from "@/lib/api/eurasia-disruptions";
import { eurasiaRailBriefQueryOptions } from "@/lib/api/eurasia-rail-brief";
import { eurasiaDelaysQueryOptions } from "@/lib/api/eurasia";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import {
  dataUpdatesQueryOptions,
  forecastSeriesQueryOptions,
  publishedForecastsQueryOptions,
} from "@/lib/api/forecasts";
import {
  LogisightControlTower,
  JUDGMENT_TAB_CODES,
  type JudgmentTabCode,
} from "@/components/control-tower/LogisightControlTower";

type DashboardSearch = { judgment?: JudgmentTabCode };

function parseJudgmentMetric(value: unknown): JudgmentTabCode | undefined {
  return JUDGMENT_TAB_CODES.includes(value as JudgmentTabCode) ? (value as JudgmentTabCode) : undefined;
}

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    judgment: parseJudgmentMetric(s.judgment),
  }),
  loader: ({ context }) => {
    const qc = context.queryClient;
    qc.ensureQueryData(alertCandidatesQueryOptions());
    qc.ensureQueryData(indexStatsQueryOptions());
    qc.ensureQueryData(kitaSeaRatesQueryOptions());
    qc.ensureQueryData(kitaAirRatesQueryOptions());
    qc.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    qc.ensureQueryData(eurasiaRailBriefQueryOptions());
    qc.ensureQueryData(eurasiaDelaysQueryOptions());
    qc.ensureQueryData(latestExchangeRateQueryOptions());
    qc.ensureQueryData(iataJetFuelQueryOptions());
    qc.ensureQueryData(publishedForecastsQueryOptions());
    qc.ensureQueryData(forecastSeriesQueryOptions());
    qc.ensureQueryData(dataUpdatesQueryOptions());
  },
  head: () =>
    seoHead({
      title: "종합 Control Tower — Logisight",
      description: "오늘의 핵심 변화, 주요 노선 현황, 운임 상승 현황, 정책·장애 요약.",
      path: "/dashboard",
    }),
  component: LogisightControlTower,
});
