import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { TradeProvisionalRow } from "./trade";

export const getTradeProvisional = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeProvisionalRow[]> => {
    const all: TradeProvisionalRow[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabasePublicServer
        .from("trade_statistics")
        .select(
          "period,priod_dt,stat_type,country_code,country_name,export_usd,import_usd,trade_balance",
        )
        .in("stat_type", ["provisional_exp", "provisional_imp"])
        .order("period", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TradeProvisionalRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 10000) break;
    }
    return all;
  },
);