import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { FreightIndexRow } from "./freight-indices";

const CODES = ["SCFI", "KCCI", "CCFI"] as const;

export const getLatestFreightIndices = createServerFn({ method: "GET" }).handler(
  async (): Promise<FreightIndexRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date,source")
      .in("index_code", CODES as unknown as string[])
      .order("week_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const latest = new Map<string, FreightIndexRow>();
    const prev = new Map<string, FreightIndexRow>();
    for (const row of (data ?? []) as FreightIndexRow[]) {
      if (!latest.has(row.index_code)) latest.set(row.index_code, row);
      else if (!prev.has(row.index_code)) prev.set(row.index_code, row);
    }
    return CODES.map((code) => {
      const row = latest.get(code);
      if (!row) {
        return { index_code: code, value: null, change_pct: null, week_date: "", source: null };
      }
      // Derive WoW change from the previous week when the source didn't store it.
      if (row.change_pct == null && row.value != null) {
        const p = prev.get(code);
        if (p?.value != null && p.value !== 0) {
          row.change_pct = ((row.value - p.value) / p.value) * 100;
        }
      }
      return row;
    });
  },
);