import { createFileRoute } from "@tanstack/react-router";

import { LogisightIndustries } from "@/components/industries-page/LogisightIndustries";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/industries")({
  // 데이터는 클라이언트에서 useQuery 로 로드한다(로딩 오버레이 즉시 표시). SSR 블로킹 loader 를
  // 제거해 첫 바이트(TTFB)를 단축한다. /trade 와 동일 패턴.
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
