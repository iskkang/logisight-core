// 유라시아 ERAI 차트 포털 — 공개 index1520(ERAI) 스냅샷 기반. 내부 TCR ETA는 제거(외부 노출 금지).
// 구성: ERAI 지수차트 · 운송기간 · 마켓맵 · 지역 물동량(geo) · ERAI 카드 · index1520 뉴스피드.
import { useSuspenseQuery } from "@tanstack/react-query";

import { eurasiaChartsQueryOptions } from "@/lib/api/eurasia-charts";
import { latestNewsQueryOptions } from "@/lib/api/news";
import { EraiWidget, RailNewsFeed } from "./RailWidgets";
import {
  EurasiaIndexChart,
  EurasiaTransitChart,
  EurasiaMarketMap,
  EurasiaGeoRanking,
} from "./EurasiaCharts";

export function RailEurasiaContent() {
  const { data: charts } = useSuspenseQuery(eurasiaChartsQueryOptions());
  const { data: news } = useSuspenseQuery(
    latestNewsQueryOptions({ category: "철도", lang: "en", limit: 20 }),
  );

  return (
    <>
      <EurasiaIndexChart quotes={charts.indexQuotes} />
      <EurasiaTransitChart quotes={charts.indexQuotes} />
      <EurasiaMarketMap quotes={charts.indexQuotes} />
      <EurasiaGeoRanking geo={charts.geo} />
      <EraiWidget />
      <RailNewsFeed
        title="유라시아 철도 뉴스"
        chip="index1520 메타피드"
        items={news}
        emptyText="수집된 유라시아 철도 뉴스가 없습니다."
      />
    </>
  );
}
