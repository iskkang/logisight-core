import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import { latestBriefingQueryOptions, formatBriefingDate } from "@/lib/api/briefing";
import { normalizeArticleContent } from "@/lib/article-content";
import LogisightArticle from "@/components/article-page/LogisightArticle";
import { seoHead } from "@/lib/seo";

// 주간 브리핑 포인트 슬롯 — agent_type/category 키 → 표시 라벨.
const SLOTS = [
  { key: "shipping", label: "시황" },
  { key: "corp", label: "기업" },
  { key: "brief", label: "글로벌" },
] as const;

const DEFAULT_DESC = "이번 주 해운·항공·철도·무역 시장의 핵심 이슈를 한눈에 정리한 주간 브리핑.";

const BREADCRUMB = (
  <>
    <Link to="/">홈</Link> <b>›</b> 주간 브리핑
  </>
);

export const Route = createFileRoute("/briefing")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(latestBriefingQueryOptions());
    return { subtitle: data?.briefing?.subtitle ?? null };
  },
  head: ({ loaderData }) => {
    const subtitle = loaderData?.subtitle;
    const desc = subtitle && subtitle.trim().length > 0 ? subtitle : DEFAULT_DESC;
    return seoHead({
      title: "주간 시장 브리핑 — Logisight",
      description: desc,
      path: "/briefing",
      type: "article",
    });
  },
  component: BriefingPage,
});

function BriefingPage() {
  const { data } = useSuspenseQuery(latestBriefingQueryOptions());
  const briefing = data?.briefing ?? null;
  const points = data?.points ?? [];

  // 발행 전 — 기사 레이아웃 그대로 안내만 표시.
  if (!briefing) {
    return (
      <LogisightArticle
        breadcrumb={BREADCRUMB}
        article={{
          category: "주간 브리핑",
          title: "주간 시장 브리핑",
          deck: "이번 주 브리핑을 준비 중입니다. 매주 월요일 발행.",
          source: "Logisight",
          contentNode: <p>이번 주 분석은 준비 중입니다.</p>,
        }}
        related={[]}
      />
    );
  }

  // 3대 포인트(시황·기업·글로벌)를 기사 페이지의 '핵심 요약' 박스로 매핑.
  const summaryPoints = SLOTS.map(({ key, label }) => {
    const point =
      points.find((p) => p.agent_type === key) ?? points.find((p) => p.category === key);
    return point ? `${label} — ${point.headline}` : null;
  }).filter((v): v is string => Boolean(v));

  // 문단 정리: 기사 본문과 동일한 정규화(중복 제목·요약·라벨형 소제목 제거, 빈 줄 정돈) 후
  // ReactMarkdown 으로 렌더 → .article 타이포(17px/1.78, 문단 간격)로 가독성 확보.
  const normalized = normalizeArticleContent({
    content: briefing.content,
    title: briefing.title,
    summary: briefing.subtitle,
    imageUrl: null,
    imageCredit: null,
  });

  const metaDate = [
    briefing.week_of ? `${formatBriefingDate(briefing.week_of)} 주간` : null,
    briefing.published_at ? `${formatBriefingDate(briefing.published_at)} 발행` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <LogisightArticle
      breadcrumb={BREADCRUMB}
      article={{
        category: "주간 브리핑",
        title: briefing.title,
        deck: briefing.subtitle,
        source: "Logisight",
        published_at: metaDate || null,
        summary_points: summaryPoints.length > 0 ? summaryPoints : null,
        contentNode: normalized ? (
          <ReactMarkdown>{normalized}</ReactMarkdown>
        ) : (
          <p>이번 주 분석은 준비 중입니다.</p>
        ),
      }}
      related={[]}
    />
  );
}
