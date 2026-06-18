import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { TradeStatRow } from "./industries";

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