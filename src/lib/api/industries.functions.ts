import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { TradeStatRow, TradeSummaryRow } from "./industries";

// 관세청 통계는 월 단위 갱신 → CDN(s-maxage)에서 1시간 캐시 + 24시간 stale-while-revalidate.
const TRADE_CACHE_CONTROL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export type ChapterPartner = {
  country_name: string;
  export_usd: number | null;
  export_weight: number | null;
  import_usd: number | null;
  import_weight: number | null;
};

// HS 챕터(2자리)별 교역국 집계 — item_country를 서버에서 SUM(RPC). 드릴다운 "상위 수출 대상국".
export const getChapterTradePartners = createServerFn({ method: "GET" })
  .inputValidator(z.object({ chapter: z.string() }))
  .handler(async ({ data }): Promise<ChapterPartner[]> => {
    const ch = data.chapter.slice(0, 2);
    if (!/^\d{2}$/.test(ch)) return [];
    // rpc 함수는 생성 타입에 없으므로 느슨하게 호출(쿼리 캐스팅 선례와 동일).
    const sb = supabasePublicServer as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: rows, error } = await sb.rpc("chapter_trade_partners", { p_chapter: ch });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ChapterPartner[];
  });

// 국가별 총교역(stat_type='country') — item은 국가 차원이 없어 국가 랭킹은 이 데이터를 쓴다.
// 소량(주요 ~49개국 × 월)이라 페이지네이션 불필요.
export const getCountryTotals = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeStatRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("trade_statistics")
      .select(
        "period,stat_type,hs_code,hs_name,country_code,country_name,export_usd,export_weight,import_usd,import_weight,trade_balance",
      )
      .eq("stat_type", "country")
      .order("period", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as TradeStatRow[];
  },
);

// 산업별 사전집계 read — trade_summary의 hs_chapter+total 차원만(소량). item 전수 페이징 대체.
export const getTradeSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeSummaryRow[]> => {
    setResponseHeader("cache-control", TRADE_CACHE_CONTROL);
    const { data, error } = await supabasePublicServer
      .from("trade_summary")
      .select(
        "period,dim_type,dim_key,dim_label,export_usd,import_usd,export_weight,import_weight,trade_balance,row_count",
      )
      .in("dim_type", ["hs_chapter", "total"])
      .order("period", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as TradeSummaryRow[];
  },
);

export const getTradeStatistics = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeStatRow[]> => {
    // Single granularity level: stat_type='item' (HS6 × country × month)
    const all: TradeStatRow[] = [];
    let from = 0;
    const pageSize = 1000;
    // Page through because Supabase default limit is 1000.
    while (true) {
      const { data, error } = await supabasePublicServer
        .from("trade_statistics")
        .select(
          "period,stat_type,hs_code,hs_name,country_code,country_name,export_usd,export_weight,import_usd,import_weight,trade_balance",
        )
        .eq("stat_type", "item")
        .order("period", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TradeStatRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 20000) break; // hard safety cap
    }
    return all;
  },
);