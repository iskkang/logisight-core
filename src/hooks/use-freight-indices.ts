import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FreightIndexRow = {
  index_code: string;
  value: number | null;
  change_pct: number | null;
  week_date: string;
  source: string | null;
};

const CODES = ["SCFI", "WCI", "FBX", "KCCI", "CCFI"] as const;

export function useLatestFreightIndices() {
  return useQuery({
    queryKey: ["freight_indices", "latest"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_indices")
        .select("index_code,value,change_pct,week_date,source")
        .in("index_code", CODES as unknown as string[])
        .order("week_date", { ascending: false })
        .limit(200);
      if (error) throw error;

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
  });
}

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