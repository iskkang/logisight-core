import { createFileRoute } from "@tanstack/react-router";

import { policiesQueryOptions } from "@/lib/api/policies";
import { riskSnapshotQueryOptions } from "@/lib/api/risk";
import { LogisightPort } from "@/components/port/LogisightPort";

export const Route = createFileRoute("/policy")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policiesQueryOptions());
    context.queryClient.ensureQueryData(riskSnapshotQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "포트 리스크 인텔리전스 — Logisight" },
      {
        name: "description",
        content: "항만 혼잡, 해상 병목, 초크포인트와 규제 이벤트 리스크 모니터.",
      },
    ],
  }),
  component: LogisightPort,
});
