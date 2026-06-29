import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { tradeStatisticsBundleQueryOptions } from "@/lib/api/trade";
import { LogisightTrade } from "@/components/trade-page/LogisightTrade";

export const Route = createFileRoute("/trade")({
  // SSR GEO 준수용 loader: 이 라우트는 본문 데이터를 클라이언트 useQuery 로 로드하지만,
  // GEO 답변 블록(capsule·FAQ·JSON-LD)은 SSR HTML 에 포함돼야 한다. 따라서 번들을 미리
  // 쿼리 캐시에 적재해, 컴포넌트의 useSuspenseQuery 가 SSR 시점에 즉시 렌더되게 한다.
  // 나머지 useQuery 호출은 동일 캐시에서 하이드레이트된다.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tradeStatisticsBundleQueryOptions());
  },
  head: () =>
    seoHead({
      title: "무역 동향 인사이트 - Logisight",
      description:
        "관세청 수출입무역통계 기반 교역액·국가·품목 랭킹과 월별 추이를 교역 ↔ 운임 신호와 함께 분석합니다.",
      path: "/trade",
    }),
  component: LogisightTrade,
});
