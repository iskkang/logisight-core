import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { PUBLIC_SWR_CACHE } from "@/lib/cache-control";
import { isInternalNewsItem, type NewsItem } from "./news";
import { estimateReadMinutes } from "./article";
import { normalizeNewsImage } from "./news-image";

const SELECT =
  "id,slug,title,summary,url,source,category,image_url,image_source,image_credit,published_at,lang,tags,is_hero,agent_type,content";

export const getLatestNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lang: z.string().min(2).max(5).default("ko"),
      limit: z.number().int().min(1).max(50).default(20),
      category: z.string().min(1).max(40).optional(),
      dateFrom: z.string().optional(), // e.g. "2026-05-31T00:00:00+09:00"
      dateTo: z.string().optional(), // e.g. "2026-05-31T23:59:59+09:00"
    }),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    setResponseHeader("cache-control", PUBLIC_SWR_CACHE);
    let q = supabasePublicServer
      .from("maritime_news")
      .select(SELECT)
      .eq("lang", data.lang)
      .or("agent_type.is.null,agent_type.neq.daily_card")
      .like("url", "http%")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.category) q = q.eq("category", data.category);
    if (data.dateFrom) q = q.gte("published_at", data.dateFrom);
    if (data.dateTo) q = q.lte("published_at", data.dateTo);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Hide bot-blocked sources: external items whose body couldn't be
    // generated (content empty) — keep internal articles and externals
    // that do have a body. Strip content from the payload afterwards.
    return ((rows ?? []) as (NewsItem & { content?: string | null })[])
      .filter(
        (r) =>
          r.agent_type !== "external" ||
          (r.content != null && String(r.content).trim().length > 0),
      )
      .map((r) => {
        // 읽는 시간: 내부 기사(우리 본문을 독자가 실제로 읽음)에만 표기. 외부 링크 기사는
        // 원문 분량과 달라 오해를 주므로 null. content 삭제 전에 계산한다.
        const readMin = isInternalNewsItem(r) ? estimateReadMinutes(r.content ?? null) : null;
        delete (r as { content?: unknown }).content;
        (r as NewsItem).read_minutes = readMin;
        return normalizeNewsImage(r as NewsItem);
      });
  });
