import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { policiesQueryOptions } from "@/lib/api/policies";
import { riskSnapshotQueryOptions } from "@/lib/api/risk";
import { LogisightPort } from "@/components/port/LogisightPort";

export const Route = createFileRoute("/port-risk")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policiesQueryOptions());
    context.queryClient.ensureQueryData(riskSnapshotQueryOptions());
  },
  head: () =>
    seoHead({
      title: "포트 리스크 인텔리전스 — Logisight",
      description: "항만 혼잡, 해상 병목, 초크포인트와 규제 이벤트 리스크 모니터.",
      path: "/port-risk",
    }),
  component: LogisightPort,
});
