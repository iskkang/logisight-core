import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { reportsQueryOptions } from "@/lib/api/reports";
import LogisightReports from "@/components/reports-page/LogisightReports";
import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";

export const Route = createFileRoute("/reports")({
  loader: ({ context }) => context.queryClient.ensureQueryData(reportsQueryOptions()),
  head: () => ({
    meta: [
      { title: "마켓 리포트 — Logisight" },
      {
        name: "description",
        content:
          "MTL이 매주·매월 발행하는 물류 시장 인텔리전스 리포트 — 운임·해상·항공·철도·무역을 한 편에 정리합니다.",
      },
      { property: "og:title", content: "마켓 리포트 — Logisight" },
      {
        property: "og:description",
        content: "주간·월간 물류 시장 리포트 카탈로그 — 최신호와 아카이브를 PDF로 제공합니다.",
      },
      { property: "og:url", content: "https://logisight-core.lovable.app/reports" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/reports" }],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useSuspenseQuery(reportsQueryOptions());
  return (
    // 다크 래퍼: 반투명 HomeNav 뒤 배경을 홈과 동일하게 어둡게(슬레이트 번짐 방지).
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="reports" />
      <LogisightReports
        showNav={false}
        latestWeekly={data.weekly}
        latestMonthly={data.monthly}
        archive={data.archive}
        regionOrder={[
          "미주",
          "유럽",
          "극동(러시아·CIS)",
          "중국",
          "일본",
          "동남아",
          "중동",
          "아프리카",
        ]}
      />
      <HomeFooter />
    </div>
  );
}
