import { queryOptions } from "@tanstack/react-query";

import { getLatestNews } from "./news.functions";

export type NewsItem = {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string | null;
  image_url: string | null;
  published_at: string | null;
  lang: string;
  tags: string[] | null;
  is_hero: boolean | null;
};

export const latestNewsQueryOptions = (input: {
  lang?: string;
  limit?: number;
  category?: string;
}) =>
  queryOptions({
    queryKey: ["maritime_news", "latest", input],
    queryFn: () =>
      getLatestNews({
        data: {
          lang: input.lang ?? "ko",
          limit: input.limit ?? 20,
          category: input.category,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });

export function formatPublishedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}