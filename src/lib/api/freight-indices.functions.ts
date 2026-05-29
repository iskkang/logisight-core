import { createServerFn } from "@tanstack/react-start";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { FreightIndexRow } from "./freight-indices";

const CODES = ["SCFI", "WCI", "FBX", "KCCI", "CCFI"] as const;

export const getLatestFreightIndices = createServerFn({ method: "GET" }).handler(
  async (): Promise<FreightIndexRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date,source")
      .in("index_code", CODES as unknown as string[])
      .order("week_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const latest = new Map<string, FreightIndexRow>();
    for (const row of (data ?? []) as FreightIndexRow[]) {
      if (!latest.has(row.index_code)) latest.set(row.index_code, row);
    }
    return CODES.map(
      (code) =>
        latest.get(code) ?? {
          index_code: code,
          value: null,
          change_pct: null,
          week_date: "",
          source: null,
        },
    );
  },
);