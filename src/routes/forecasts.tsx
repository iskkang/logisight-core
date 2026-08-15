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
  dir?: string[];
  series?: string[];
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
      jaPath: "/forecasts",
    }),
  // 빈 값은 아예 넣지 않는다 ★
  // 예전에는 dir·series 에 항상 [] 를 돌려줬다. URL 에 없는 값을 만들어내니 라우터가
  // 정규화하려고 /forecasts → /forecasts?dir=…&series=… 로 307 리다이렉트했고,
  // sitemap 에 실린 맨 주소가 매번 한 홉을 더 태웠다(/asia 에서 겪은 것과 같은 유형).
  validateSearch: (s: Record<string, unknown>): Search => {
    const dir = arr(s.dir);
    const series = arr(s.series);
    return {
      ...(s.cadence === "weekly" || s.cadence === "monthly" ? { cadence: s.cadence } : {}),
      ...(dir.length > 0 ? { dir } : {}),
      ...(series.length > 0 ? { series } : {}),
      ...(typeof s.sel === "string" ? { sel: s.sel } : {}),
      ...(typeof s.mod === "string" ? { mod: s.mod } : {}),
    };
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
      context.queryClient.ensureQueryData(forecastSeriesQueryOptions()),
      context.queryClient.ensureQueryData(eurasiaRailBriefQueryOptions()),
    ]);
  },
  component: LogisightForecast,
});
