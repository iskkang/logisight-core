import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { reportsQueryOptions } from "@/lib/api/reports";
import { briefingWeeksQueryOptions, formatBriefingDate } from "@/lib/api/briefing";
import type { BriefingListItem } from "@/lib/api/briefing";
import LogisightReports from "@/components/reports-page/LogisightReports";
import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/reports/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(reportsQueryOptions()),
      context.queryClient.ensureQueryData(briefingWeeksQueryOptions()),
    ]),
  head: () =>
    seoHead({
      title: "마켓 리포트 — Logisight",
      description:
        "MTL이 매주·매월 발행하는 물류 시장 인텔리전스 리포트 — 운임·해상·항공·철도·무역을 한 편에 정리합니다.",
      path: "/reports",
    }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useSuspenseQuery(reportsQueryOptions());
  const { data: weeks } = useSuspenseQuery(briefingWeeksQueryOptions());
  return (
    // 다크 래퍼: 반투명 HomeNav 뒤 배경을 홈과 동일하게 어둡게(슬레이트 번짐 방지).
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="reports" />
      <LogisightReports
        showNav={false}
        latestWeekly={data.weekly}
        latestMonthly={data.monthly}
        archive={data.archive}
        regionOrder={[
          "미주",
          "유럽",
          "극동(러시아·CIS)",
          "중국",
          "일본",
          "동남아",
          "중동",
          "아프리카",
        ]}
      />
      <WeeklyArchive weeks={weeks} />
      <HomeFooter />
    </div>
  );
}

// 주간 브리핑 발행물 아카이브 — 발행물별 영구링크(/reports/weekly/{week})로 웹에서 읽기.
function WeeklyArchive({ weeks }: { weeks: BriefingListItem[] }) {
  if (!weeks || weeks.length === 0) return null;
  return (
    <section className="bg-[#eef1f6]">
      <div className="mx-auto max-w-[1100px] px-4 py-14 lg:px-6">
        <h2 className="text-[21px] font-bold tracking-[-0.02em] text-[#1a2433]">
          주간 브리핑 아카이브
        </h2>
        <p className="mt-1.5 text-[14px] text-[#54606f]">
          매주 발행하는 주간 시장 브리핑을 웹에서 읽어보세요.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
          {weeks.map((w) => (
            <li key={w.id}>
              <Link
                to="/reports/weekly/$week"
                params={{ week: w.week_of }}
                className="group flex flex-col gap-1 rounded-[12px] border border-[#d4dce7] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#0d9488] hover:shadow-[0_14px_30px_-20px_rgba(13,148,136,0.3)]"
              >
                <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-[#0d9488]">
                  {formatBriefingDate(w.week_of)} 주간
                </span>
                <span className="text-[15px] font-bold leading-snug text-[#1a2433]">{w.title}</span>
                {w.subtitle && (
                  <span className="line-clamp-2 text-[13px] leading-relaxed text-[#54606f]">
                    {w.subtitle}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
