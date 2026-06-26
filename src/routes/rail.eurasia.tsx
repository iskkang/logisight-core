import { createFileRoute } from "@tanstack/react-router";

import { operationalCurrentDelayQueryOptions } from "@/lib/api/operational-delay";
import { eraiStatsQueryOptions } from "@/lib/api/rates";
import { latestNewsQueryOptions } from "@/lib/api/news";
import { RailEurasiaContent } from "@/components/rail-page/RailEurasiaContent";

// 유라시아 — TCR ETA(기존) + ERAI 매크로 위젯 + index1520 뉴스피드.
export const Route = createFileRoute("/rail/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(operationalCurrentDelayQueryOptions());
    context.queryClient.ensureQueryData(eraiStatsQueryOptions());
    context.queryClient.ensureQueryData(latestNewsQueryOptions({ category: "철도", lang: "en", limit: 20 }));
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
