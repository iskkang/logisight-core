import { queryOptions } from "@tanstack/react-query";

import { getLatestNews, getNewsCount } from "./news.functions";

export type NewsItem = {
  id: number;
  slug: string | null;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string | null;
  image_url: string | null;
  image_source: string | null;
  image_credit: string | null;
  agent_type: string | null;
  published_at: string | null;
  lang: string;
  tags: string[] | null;
  is_hero: boolean | null;
  read_minutes?: number | null;
};

export function isInternalNewsItem(item: Pick<NewsItem, "slug" | "agent_type">): boolean {
  return Boolean(item.slug && item.agent_type !== "external");
}

/** Returns today's date in KST as "YYYY-MM-DD". */
export function todayKST(): string {
  // Swedish locale produces ISO date format "YYYY-MM-DD"
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** Given "YYYY-MM-DD", returns KST start-of-day and end-of-day ISO strings. */
export function dateToKSTRange(date: string): {
  dateFrom: string;
  dateTo: string;
} {
  return {
    dateFrom: `${date}T00:00:00+09:00`,
    dateTo: `${date}T23:59:59.999+09:00`,
  };
}

/**
 * 실제로 존재하는 뉴스 카테고리. DB 실측값이다(해상 233·물류 214·무역 124·철도 101·항공 94).
 *
 * 라우트(head 의 canonical·제목)와 사이트맵이 같은 목록을 봐야 한다. 이 목록에 없는
 * cat 값은 결과가 0건이라 색인 대상으로 취급하지 않는다.
 */
export const NEWS_CATEGORIES = ["해상", "항공", "철도", "물류", "무역"] as const;

/** 카테고리 페이지 meta description. 5개 페이지가 같은 설명을 쓰면 중복으로 묶인다. */
export const NEWS_CATEGORY_DESCRIPTION: Record<string, string> = {
  해상: "컨테이너 운임(SCFI·KCCI)·선복·항만 혼잡·블랭크 세일링 등 해상 물류 뉴스를 한국어로 정리합니다.",
  항공: "항공화물 운임(USD/kg)·수요·벨리 캐파·주요 공항 처리량 등 항공 물류 뉴스를 한국어로 정리합니다.",
  철도: "유라시아 철도(TCR·TSR)·ERAI 운임·미주 철도 코리도어 등 철도 물류 뉴스를 한국어로 정리합니다.",
  물류: "포워딩·창고·라스트마일·공급망 재편 등 물류 산업 전반의 뉴스를 한국어로 정리합니다.",
  무역: "수출입 통계·관세·규제·교역 흐름 등 무역 뉴스를 물류 영향 관점에서 한국어로 정리합니다.",
};

/**
 * /news 목록 한 페이지의 기사 수.
 *
 * 라우트(news.tsx)와 사이트맵(sitemap[.]xml.ts)이 같은 값을 봐야 한다 —— 어긋나면
 * 사이트맵이 존재하지 않는 페이지 번호를 내보낸다. 컴포넌트가 없는 이 모듈에 둔 건
 * 서버 핸들러가 라우트 모듈 전체를 끌어오지 않게 하기 위해서다.
 */
export const PER_PAGE = 40;

export const latestNewsQueryOptions = (input: {
  lang?: string;
  limit?: number;
  offset?: number;
  category?: string;
  date?: string; // "YYYY-MM-DD" — undefined means no date filter
}) => {
  const range = input.date ? dateToKSTRange(input.date) : undefined;
  return queryOptions({
    queryKey: ["maritime_news", "latest", input],
    queryFn: () =>
      getLatestNews({
        data: {
          lang: input.lang ?? "ko",
          limit: input.limit ?? 20,
          offset: input.offset ?? 0,
          category: input.category,
          dateFrom: range?.dateFrom,
          dateTo: range?.dateTo,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });
};

/** 목록 총 건수 — 페이지네이션 번호 계산용. 필터는 latestNewsQueryOptions 와 같다. */
export const newsCountQueryOptions = (input: {
  lang?: string;
  category?: string;
  date?: string;
}) => {
  const range = input.date ? dateToKSTRange(input.date) : undefined;
  return queryOptions({
    queryKey: ["maritime_news", "count", input],
    queryFn: () =>
      getNewsCount({
        data: {
          lang: input.lang ?? "ko",
          category: input.category,
          dateFrom: range?.dateFrom,
          dateTo: range?.dateTo,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });
};

export function formatPublishedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
