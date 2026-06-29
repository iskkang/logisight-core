import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { LogisightTrade } from "@/components/trade-page/LogisightTrade";

export const Route = createFileRoute("/trade")({
  // 데이터는 클라이언트에서 useQuery 로 로드한다(스켈레톤 즉시 표시). SSR 을 막던 블로킹
  // loader 를 제거해 첫 바이트(TTFB)가 수초 → 즉시로 단축된다. 데이터 캐싱은 서버 함수의
  // Cache-Control(s-maxage·stale-while-revalidate)로 CDN 레벨에서 처리한다.
  head: () =>
    seoHead({
      title: "무역 동향 인사이트 - Logisight",
      description:
        "관세청 수출입무역통계 기반 교역액·국가·품목 랭킹과 월별 추이를 교역 ↔ 운임 신호와 함께 분석합니다.",
      path: "/trade",
    }),
  component: LogisightTrade,
});
