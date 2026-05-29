import { queryOptions } from "@tanstack/react-query";

import { getLatestFreightIndices } from "./freight-indices.functions";

export type FreightIndexRow = {
  index_code: string;
  value: number | null;
  change_pct: number | null;
  week_date: string;
  source: string | null;
};

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
  return `업데이트: ${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")} 기준`;
}