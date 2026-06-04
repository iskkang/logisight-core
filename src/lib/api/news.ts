import { queryOptions } from "@tanstack/react-query";

import { getLatestNews } from "./news.functions";

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

export const latestNewsQueryOptions = (input: {
  lang?: string;
  limit?: number;
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
