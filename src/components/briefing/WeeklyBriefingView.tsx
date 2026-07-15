// 주간 브리핑을 기사형(LogisightArticle)으로 렌더 — /reports/weekly/{week} 영구 페이지에서 사용.
// (기존 briefing.tsx의 매핑 로직을 추출. /briefing 은 최신 주간으로 리다이렉트한다.)
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

import { normalizeArticleContent } from "@/lib/article-content";
import LogisightArticle from "@/components/article-page/LogisightArticle";
import { formatBriefingDate } from "@/lib/api/briefing";
import type { WeeklyBriefingPayload } from "@/lib/api/briefing";

// 주간 브리핑 포인트 슬롯 — agent_type/category 키 → 표시 라벨.
const SLOTS = [
  { key: "shipping", label: "시황" },
  { key: "corp", label: "기업" },
  { key: "brief", label: "글로벌" },
] as const;

export function WeeklyBriefingView({
  payload,
  breadcrumb,
}: {
  payload: WeeklyBriefingPayload | null;
  breadcrumb?: ReactNode;
}) {
  const briefing = payload?.briefing ?? null;
  const points = payload?.points ?? [];

  // 발행 전/본문 없음 — 기사 레이아웃 그대로 안내만 표시.
  if (!briefing) {
    return (
      <LogisightArticle
        breadcrumb={breadcrumb}
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

  // 기사 본문과 동일한 정규화(중복 제목·요약·라벨형 소제목 제거) 후 마크다운 렌더.
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
      breadcrumb={breadcrumb}
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
