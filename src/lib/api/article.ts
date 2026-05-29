import { queryOptions } from "@tanstack/react-query";

import { getArticleById, getRelatedArticles } from "./article.functions";
import type { NewsItem } from "./news";

export type Article = NewsItem & { content: string | null };

export const articleQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ["maritime_news", "article", id],
    queryFn: () => getArticleById({ data: { id } }),
    staleTime: 5 * 60 * 1000,
  });

export const relatedArticlesQueryOptions = (input: {
  id: number;
  category: string | null;
}) =>
  queryOptions({
    queryKey: ["maritime_news", "related", input],
    queryFn: () =>
      getRelatedArticles({ data: { id: input.id, category: input.category } }),
    staleTime: 5 * 60 * 1000,
  });

export function estimateReadMinutes(content: string | null): number | null {
  if (!content) return null;
  const chars = content.replace(/\s+/g, "").length;
  if (chars === 0) return null;
  // ~500 Korean chars per minute
  return Math.max(1, Math.round(chars / 500));
}