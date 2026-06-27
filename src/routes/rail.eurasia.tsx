import { createFileRoute } from "@tanstack/react-router";

import { eurasiaChartsQueryOptions } from "@/lib/api/eurasia-charts";
import { RailEurasiaContent } from "@/components/rail-page/RailEurasiaContent";

// 유라시아 — ERAI 차트 포털(index1520 스냅샷). 내부 TCR ETA 제거.
export const Route = createFileRoute("/rail/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(eurasiaChartsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "유라시아 철도 — ERAI 지수·운임 — Logisight" },
      {
        name: "description",
        content:
          "ERAI(Eurasian Rail Alliance Index) 지수·운송기간·지역 물동량과 유라시아 철도 뉴스. 출처: index1520.com.",
      },
    ],
  }),
  component: RailEurasiaContent,
});
