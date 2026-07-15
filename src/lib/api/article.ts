import { queryOptions } from "@tanstack/react-query";

import { getArticleBySlug, getRelatedArticles } from "./article.functions";
import type { NewsItem } from "./news";

export type Article = NewsItem & { content: string | null; fetched_at?: string | null };

export const articleQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["maritime_news", "article", slug],
    queryFn: () => getArticleBySlug({ data: { slug } }),
    staleTime: 5 * 60 * 1000,
  });

/** Pick best URL param for an article: prefer slug, fall back to numeric id. */
export function articleParam(item: { slug: string | null; id: number }): string {
  return item.slug && item.slug.length > 0 ? item.slug : String(item.id);
}

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