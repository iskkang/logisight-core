import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { NewsItem } from "./news";

const SELECT =
  "id,slug,title,summary,url,source,category,image_url,published_at,lang,tags,is_hero";

export const getLatestNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lang: z.string().min(2).max(5).default("ko"),
      limit: z.number().int().min(1).max(50).default(20),
      category: z.string().min(1).max(40).optional(),
      dateFrom: z.string().optional(), // e.g. "2026-05-31T00:00:00+09:00"
      dateTo: z.string().optional(),   // e.g. "2026-05-31T23:59:59+09:00"
    }),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    let q = supabasePublicServer
      .from("maritime_news")
      .select(SELECT)
      .eq("lang", data.lang)
      .not("agent_type", "in", "(daily_card,external)") // exclude card/feed-only types; NULL agent_type rows pass through
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.category) q = q.eq("category", data.category);
    if (data.dateFrom) q = q.gte("published_at", data.dateFrom);
    if (data.dateTo)   q = q.lte("published_at", data.dateTo);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as NewsItem[];
  });