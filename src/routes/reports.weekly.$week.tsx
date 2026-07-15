import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { briefingByWeekQueryOptions } from "@/lib/api/briefing";
import { WeeklyBriefingView } from "@/components/briefing/WeeklyBriefingView";
import { seoHead } from "@/lib/seo";

const BREADCRUMB = (
  <>
    <Link to="/">홈</Link> <b>›</b> <Link to="/reports">리포트</Link> <b>›</b> 주간
  </>
);

export const Route = createFileRoute("/reports/weekly/$week")({
  loader: async ({ context, params }) => {
    const payload = await context.queryClient.ensureQueryData(
      briefingByWeekQueryOptions(params.week),
    );
    if (!payload) throw notFound();
    return { subtitle: payload.briefing.subtitle ?? null };
  },
  head: ({ loaderData, params }) =>
    seoHead({
      title: `주간 시장 브리핑 · ${params.week} — Logisight`,
      description:
        loaderData?.subtitle && loaderData.subtitle.trim().length > 0
          ? loaderData.subtitle
          : "이번 주 해운·항공·철도·무역 시장의 핵심 이슈를 정리한 주간 브리핑.",
      path: `/reports/weekly/${params.week}`,
      type: "article",
    }),
  component: WeeklyReportPage,
});

function WeeklyReportPage() {
  const { week } = Route.useParams();
  const { data } = useSuspenseQuery(briefingByWeekQueryOptions(week));
  return <WeeklyBriefingView payload={data} breadcrumb={BREADCRUMB} />;
}
