import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FreightIndexRow = {
  index_code: string;
  value: number | null;
  change_pct: number | null;
  week_date: string;
  source: string | null;
};

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

export const freightIndicesQueryOptions = () =>
  queryOptions({
    queryKey: ["freight_indices", "latest"],
    queryFn: () => getLatestFreightIndices(),
    staleTime: 5 * 60 * 1000,
  });

export function formatIndexValue(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export function formatWeekLabel(iso: string | undefined): string {
  if (!iso) return "업데이트: 수집 예정 (주 1회)";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "업데이트: 수집 예정 (주 1회)";
  return `업데이트: ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} 기준`;
}