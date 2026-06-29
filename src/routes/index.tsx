import { createFileRoute } from "@tanstack/react-router";

import {
  indexStatsQueryOptions,
  freightIndicesHistoryQueryOptions,
  kitaAirRatesQueryOptions,
} from "@/lib/api/rates";
import { riskSnapshotQueryOptions } from "@/lib/api/risk";
import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import { latestRatesBriefQueryOptions } from "@/lib/api/rates-brief";
import { latestNewsQueryOptions } from "@/lib/api/news";
import { latestBriefingQueryOptions } from "@/lib/api/briefing";
import { LogisightHome } from "@/components/home/LogisightHome";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    const qc = context.queryClient;
    qc.ensureQueryData(indexStatsQueryOptions());
    qc.ensureQueryData(freightIndicesHistoryQueryOptions());
    qc.ensureQueryData(kitaAirRatesQueryOptions());
    qc.ensureQueryData(alertCandidatesQueryOptions());
    qc.ensureQueryData(riskSnapshotQueryOptions());
    qc.ensureQueryData(latestRatesBriefQueryOptions());
    qc.ensureQueryData(latestNewsQueryOptions({ lang: "ko", limit: 12 }));
    qc.ensureQueryData(latestBriefingQueryOptions());
  },
  head: () =>
    seoHead({
      title: "Logisight — 물류를 읽는 새로운 시선",
      description:
        "운임 지수와 물류 뉴스, 정책 변화. 흩어진 정보를 매주 한 편의 분석으로 정리합니다.",
      path: "/",
    }),
  component: LogisightHome,
});
