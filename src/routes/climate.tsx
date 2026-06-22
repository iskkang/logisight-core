import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { climateRiskQueryOptions } from "@/lib/api/climate";
import { RiskGlobe } from "@/components/climate/RiskGlobe";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";

const DESC =
  "전 세계 항만·초크포인트·내륙 철도 거점의 기상 리스크를 AI 예보 기반으로 지구본에 표시합니다. 활성 재해(NHC·GDACS·NWS)도 함께 감시합니다.";

export const Route = createFileRoute("/climate")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(climateRiskQueryOptions());
  },
  head: () => {
    const url = "https://logisight-core.lovable.app/climate";
    return {
      meta: [
        { title: "기후예측 — 기상 리스크 지구본 · Logisight" },
        { name: "description", content: DESC },
        { property: "og:title", content: "기후예측 — 기상 리스크 지구본 · Logisight" },
        { property: "og:description", content: DESC },
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
    <div className="mx-auto max-w-6xl px-4 py-10 lg:py-14">
      <RouteBreadcrumb className="mb-6" />
      <header className="mb-6">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
        >
          기후예측
        </span>
        <h1
          className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] lg:text-4xl"
          style={{ wordBreak: "keep-all" }}
        >
          기상 리스크 지구본
        </h1>
        <p className="mt-3 text-base text-[var(--color-ink-muted)]" style={{ wordBreak: "keep-all" }}>
          {DESC}
        </p>
      </header>
      <RiskGlobe data={data} />
    </div>
  );
}
