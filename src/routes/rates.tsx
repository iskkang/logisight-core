import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { LogisightRates } from "@/components/rates-page/LogisightRates";
import {
  freightIndicesHistoryQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  indexStatsQueryOptions,
  kcciRouteStatsQueryOptions,
} from "@/lib/api/rates";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import { publishedForecastsQueryOptions } from "@/lib/api/forecasts";
import { publishedPartnerRatesQueryOptions } from "@/lib/api/partner-rates";

export const Route = createFileRoute("/rates")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions()),
      context.queryClient.ensureQueryData(kitaAirRatesQueryOptions()),
      context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions()),
      context.queryClient.ensureQueryData(latestExchangeRateQueryOptions()),
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
      context.queryClient.ensureQueryData(publishedPartnerRatesQueryOptions()),
      context.queryClient.ensureQueryData(indexStatsQueryOptions()),
      context.queryClient.ensureQueryData(kcciRouteStatsQueryOptions()),
    ]);
  },
  head: () =>
    seoHead({
      title: "운임 Control Tower - Logisight",
      description:
        "저장된 KITA 해상·항공 운임과 글로벌 스팟 지수를 결합해 권역별 운임의 수준·추세·이상치를 한눈에 판단합니다.",
      path: "/rates",
    }),
  component: LogisightRates,
});
