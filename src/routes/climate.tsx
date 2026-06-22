import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { climateRiskQueryOptions } from "@/lib/api/climate";
import { RiskGlobe } from "@/components/climate/RiskGlobe";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";
import { PageHero } from "@/components/site/PageHero";

const SUBTITLE =
  "전 세계 항만·초크포인트·내륙 철도 거점의 기상 리스크를 AI 예보 기반으로 지구본에 표시합니다.";

export const Route = createFileRoute("/climate")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(climateRiskQueryOptions());
  },
  head: () => {
    const url = "https://logisight-core.lovable.app/climate";
    return {
      meta: [
        { title: "세계 기후 예측 — Logisight" },
        { name: "description", content: SUBTITLE },
        { property: "og:title", content: "세계 기후 예측 — Logisight" },
        { property: "og:description", content: SUBTITLE },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ClimatePage,
});

function ClimatePage() {
  const { data } = useSuspenseQuery(climateRiskQueryOptions());
  return (
    <>
      <PageHero
        eyebrow="Global Climate Forecast"
        titleMain="세계 기후 예측"
        subtitle={SUBTITLE}
        chips={[
          { label: "감시 자산", value: `${data.assets.length}개`, color: "var(--color-cyan)" },
          { label: "활성 이벤트", value: `${data.events.length}건`, color: "var(--color-status-normal)" },
        ]}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-[1540px] flex-col gap-4 px-4 py-[26px] lg:px-12">
        <RouteBreadcrumb />
        <RiskGlobe data={data} />
      </div>
    </>
  );
}
