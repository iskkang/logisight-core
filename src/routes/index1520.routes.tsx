import { createFileRoute } from "@tanstack/react-router";

import { index1520RoutesQueryOptions } from "@/lib/api/index1520-routes";
import { Index1520RoutesMap } from "@/components/index1520/Index1520RoutesMap";

// Index1520 라우트 통계 지도 — transit-service O-D 구간을 maplibre로 렌더(좌표=index1520_locations).
export const Route = createFileRoute("/index1520/routes")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(index1520RoutesQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Index1520 라우트 지도 — 유라시아 철도 물동량 — Logisight" },
      {
        name: "description",
        content: "중국–유럽 철도 O-D 구간 물동량(TEU)·운송기간·YoY를 지도와 표로. 출처: index1520.com.",
      },
    ],
  }),
  component: Index1520RoutesMap,
});
