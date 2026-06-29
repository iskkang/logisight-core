import { createFileRoute } from "@tanstack/react-router";

import { LogisightIndustries } from "@/components/industries-page/LogisightIndustries";
import { tradeStatisticsQueryOptions } from "@/lib/api/industries";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/industries")({
  // SSR GEO 준수를 위해 loader 추가 — GEO capsule·FAQ·JSON-LD 가 useSuspenseQuery 로
  // SSR 렌더되려면 교역통계 쿼리를 사전 프리페치해야 한다. 본문 카드는 기존대로 useQuery
  // 로딩 오버레이를 사용한다(loader 가 캐시를 데워 깜빡임 없음).
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tradeStatisticsQueryOptions());
  },
  head: () =>
    seoHead({
      title: "산업별 교역 동향 — Logisight",
      description:
        "관세청 수출입무역통계 기준 HS 챕터별 교역액·무역수지를 운송수단·장비·레인 수요와 연결해 분석합니다.",
      path: "/industries",
    }),
  component: LogisightIndustries,
  errorComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
    </div>
  ),
});
