import { createFileRoute } from "@tanstack/react-router";

import { LogisightForecast } from "@/components/forecast-page/LogisightForecast";
import {
  publishedForecastsQueryOptions,
  forecastSeriesQueryOptions,
} from "@/lib/api/forecasts";
import { eurasiaRailBriefQueryOptions } from "@/lib/api/eurasia-rail-brief";
import { seoHead } from "@/lib/seo";

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];

type Search = {
  cadence?: "weekly" | "monthly";
  dir: string[];
  series: string[];
  sel?: string;
  mod?: string;
};

export const Route = createFileRoute("/forecasts")({
  head: () =>
    seoHead({
      title: "물류 시장 전망 — Logisight",
      description:
        "한국발 해상 운임 지수·노선의 향후 2~4주 방향을 정량 모델로 채점하고 에디터가 검수해 발행하는 AI 전망. 판정일 실측으로 사후 적중을 매깁니다.",
      path: "/forecasts",
    }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    cadence: s.cadence === "weekly" || s.cadence === "monthly" ? s.cadence : undefined,
    dir: arr(s.dir),
    series: arr(s.series),
    sel: typeof s.sel === "string" ? s.sel : undefined,
    mod: typeof s.mod === "string" ? s.mod : undefined,
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
      context.queryClient.ensureQueryData(forecastSeriesQueryOptions()),
      context.queryClient.ensureQueryData(eurasiaRailBriefQueryOptions()),
    ]);
  },
  component: LogisightForecast,
});
