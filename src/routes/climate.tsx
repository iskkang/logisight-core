import { createFileRoute } from "@tanstack/react-router";

import { climateRiskQueryOptions } from "@/lib/api/climate";
import { LogisightClimate } from "@/components/climate-page/LogisightClimate";

const SUBTITLE =
  "전 세계 항만·주요 해협·내륙 철도 거점의 기상 리스크를 AI 예보 기반, 영향을 받는 노선과 리스크를 감지합니다.";

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
  component: LogisightClimate,
});
