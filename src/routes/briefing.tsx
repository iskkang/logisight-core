import { createFileRoute, redirect } from "@tanstack/react-router";

import { briefingWeeksQueryOptions } from "@/lib/api/briefing";

// 가변 단일 페이지 은퇴 — /briefing 은 최신 주간 발행물 영구링크로 리다이렉트한다.
// 기존 유입 링크·기사 하단 CTA는 항상 최신 주간 레포트로 연결된다.
export const Route = createFileRoute("/briefing")({
  beforeLoad: async ({ context }) => {
    const weeks = await context.queryClient.ensureQueryData(briefingWeeksQueryOptions());
    const latest = weeks[0]?.week_of;
    if (latest) {
      throw redirect({ to: "/reports/weekly/$week", params: { week: latest } });
    }
    throw redirect({ to: "/reports" });
  },
});
