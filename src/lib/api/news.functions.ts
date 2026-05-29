import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

const SELECT =
  "id,title,summary,url,source,category,image_url,published_at,lang,tags,is_hero";

export const getLatestNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lang: z.string().min(2).max(5).default("ko"),
      limit: z.number().int().min(1).max(50).default(20),
      category: z.string().min(1).max(40).optional(),
    }),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    let q = supabaseAdmin
      .from("maritime_news")
      .select(SELECT)
      .eq("lang", data.lang)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as NewsItem[];
  });

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