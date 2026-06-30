import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { LogisightTrade } from "@/components/trade-page/LogisightTrade";
import { tradeStatisticsBundleQueryOptions } from "@/lib/api/trade";
import { indexStatsQueryOptions } from "@/lib/api/rates";

export const Route = createFileRoute("/trade")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tradeStatisticsBundleQueryOptions()),
      context.queryClient.ensureQueryData(indexStatsQueryOptions()),
    ])
      .then(() => undefined)
      .catch(() => undefined),
  head: () =>
    seoHead({
      title: "무역 동향 인사이트 - Logisight",
      description:
        "관세청 수출입무역통계 기반 교역액·국가·품목 랭킹과 월별 추이를 교역 ↔ 운임 신호와 함께 분석합니다.",
      path: "/trade",
    }),
  component: LogisightTrade,
});
