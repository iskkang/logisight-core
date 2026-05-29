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
    }),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    let q = supabasePublicServer
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