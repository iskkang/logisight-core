import { createFileRoute } from "@tanstack/react-router";

import { index1520RoutesQueryOptions } from "@/lib/api/index1520-routes";
import { EurasiaStatisticsPanel } from "@/components/index1520/EurasiaStatisticsPanel";
import { seoHead } from "@/lib/seo";

// Index1520 라우트 통계(독립 페이지) — /rail/eurasia 의 Statistics 탭과 동일 패널 재사용.
export const Route = createFileRoute("/index1520/routes")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(index1520RoutesQueryOptions());
  },
  // head 를 직접 만들어 쓰고 있어서 canonical·og·twitter 태그가 전부 없었다.
  // 사이트맵에는 실려 있는 페이지라 구글이 표준 URL 을 스스로 고르게 된다.
  // 다른 페이지와 같이 seoHead 로 통일한다(일본판 대응 페이지가 없어 jaPath 는 생략).
  head: () =>
    seoHead({
      title: "Index1520 라우트 통계 — 유라시아 철도 물동량 — Logisight",
      description:
        "중국–유럽 철도 국가 O-D 물동량(TEU)·운송기간·YoY를 choropleth 지도와 표로. 출처: index1520.com.",
      path: "/index1520/routes",
    }),
  component: Index1520RoutesPage,
});

function Index1520RoutesPage() {
  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#1a2433]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 min-[900px]:px-6">
        <header className="mb-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">Index1520 · Eurasia Rail</div>
          <h1 className="mt-1 text-[24px] font-bold leading-tight text-[#101828]">라우트 통계 지도</h1>
          <p className="mt-1.5 text-[13px] text-[#54606f]">
            중국–유럽 철도 국가 O-D 물동량(TEU)·운송기간·YoY. 출처:{" "}
            <a href="https://index1520.com/en/statistics/" target="_blank" rel="noopener noreferrer" className="underline">
              index1520.com
            </a>
          </p>
        </header>
        <EurasiaStatisticsPanel />
      </div>
    </main>
  );
}
