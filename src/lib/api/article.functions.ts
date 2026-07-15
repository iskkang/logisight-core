import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { Article } from "./article";
import type { NewsItem } from "./news";
import { normalizeNewsImage } from "./news-image";

const SELECT =
  "id,slug,title,summary,content,url,source,category,image_url,image_source,image_credit,published_at,fetched_at,lang,tags,is_hero,agent_type";

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<Article> => {
    // Try slug match first
    const bySlug = await supabasePublicServer
      .from("maritime_news")
      .select(SELECT)
      .eq("slug", data.slug)
      .maybeSingle();
    if (bySlug.error) throw new Error(bySlug.error.message);
    if (bySlug.data) return normalizeNewsImage(bySlug.data as Article);

    // Fallback: numeric id (for legacy rows without slug)
    if (/^\d+$/.test(data.slug)) {
      const id = Number(data.slug);
      const byId = await supabasePublicServer
        .from("maritime_news")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (byId.error) throw new Error(byId.error.message);
      if (byId.data) return normalizeNewsImage(byId.data as Article);
    }

    throw notFound();
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
      .like("url", "http%")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as NewsItem[]).map(normalizeNewsImage);
  });
