import { createFileRoute } from "@tanstack/react-router";

import { operationalCurrentDelayQueryOptions } from "@/lib/api/operational-delay";
import { RailEurasiaContent } from "@/components/rail-page/RailEurasiaContent";

// 유라시아 — TCR 노선 운영 상태·ETA 지연(기존 /eurasia 콘텐츠 재사용).
export const Route = createFileRoute("/rail/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(operationalCurrentDelayQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "유라시아 코리도어 — Logisight" },
      {
        name: "description",
        content:
          "TCR(중국횡단철도) 노선의 운영 상태·ETA 지연을 한눈에. 지연은 최초 관측 ETA(baseline) 대비로 산출합니다.",
      },
    ],
  }),
  component: RailEurasiaContent,
});
