import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { Article } from "./article";
import type { NewsItem } from "./news";

const SELECT =
  "id,title,summary,content,url,source,category,image_url,published_at,lang,tags,is_hero";

export const getArticleById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }): Promise<Article> => {
    const { data: row, error } = await supabasePublicServer
      .from("maritime_news")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw notFound();
    return row as Article;
  });

export const getRelatedArticles = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      category: z.string().min(1).max(40).nullable(),
    }),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    if (!data.category) return [];
    const { data: rows, error } = await supabasePublicServer
      .from("maritime_news")
      .select(SELECT)
      .eq("category", data.category)
      .neq("id", data.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3);
    if (error) throw new Error(error.message);
    return (rows ?? []) as NewsItem[];
  });