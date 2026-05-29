import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { TradeStatRow } from "./industries";

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