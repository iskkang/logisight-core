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

// 본문이 비어 있는 외부 기사 제외 — 봇 차단으로 본문을 못 만든 항목이다.
// 목록과 총 건수가 같은 조건을 봐야 페이지 번호가 어긋나지 않는다(실측 821 → 766건).
const NON_EMPTY_EXTERNAL = "agent_type.neq.external,and(content.not.is.null,content.neq.)";

export const getLatestNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lang: z.string().min(2).max(5).default("ko"),
      limit: z.number().int().min(1).max(50).default(20),
      // 목록 페이지네이션용. 기본 0 이라 기존 호출부(홈·인덱스)의 동작은 그대로다.
      offset: z.number().int().min(0).max(5000).default(0),
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
      // 본문 없는 외부 기사 제외 —— 아래 .filter() 와 같은 조건을 쿼리로 내린 것이다.
      // 가져온 뒤에만 걸러내면 페이지마다 실제 건수가 달라지고 총 건수와도 어긋나,
      // 페이지네이션 번호가 맞지 않는다(실측 821건 → 766건).
      .or(NON_EMPTY_EXTERNAL)
      .like("url", "http%")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);

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

/**
 * 목록 총 건수. 페이지네이션 번호를 그리는 데만 쓴다.
 *
 * getLatestNews 와 「같은 필터」를 봐야 한다 —— 조건이 어긋나면 마지막 페이지가
 * 비거나 없는 페이지 번호가 생긴다. head:true 라 행은 가져오지 않고 개수만 센다.
 */
export const getNewsCount = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lang: z.string().min(2).max(5).default("ko"),
      category: z.string().min(1).max(40).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<number> => {
    setResponseHeader("cache-control", PUBLIC_SWR_CACHE);
    let q = supabasePublicServer
      .from("maritime_news")
      .select("id", { count: "exact", head: true })
      .eq("lang", data.lang)
      .or("agent_type.is.null,agent_type.neq.daily_card")
      .or(NON_EMPTY_EXTERNAL)
      .like("url", "http%");

    if (data.category) q = q.eq("category", data.category);
    if (data.dateFrom) q = q.gte("published_at", data.dateFrom);
    if (data.dateTo) q = q.lte("published_at", data.dateTo);

    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  });
