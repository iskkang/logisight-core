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

export const NYFI_LANE_LABELS: Record<string, string> = {
  "NYFI:ASIA-USWC": "아시아→미서안",
  "NYFI:ASIA-USEC": "아시아→미동안",
  "NYFI:ASIA-NEUR": "아시아→북유럽",
  "NYFI:TRANS-ATLANTIC_WESTBOUND": "대서양(서행)",
  "NYFI:TRANS-ATLANTIC_EASTBOUND": "대서양(동행)",
};

export function isNyfiCode(code: string): boolean {
  return code.startsWith("NYFI:");
}

export function indexDisplayLabel(code: string): string {
  if (isNyfiCode(code)) return `NYFI ${NYFI_LANE_LABELS[code] ?? code.slice(5)}`;
  return code;
}

export function formatIndexDisplayValue(code: string, v: number | null): string {
  if (v == null) return "—";
  const formatted = v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return isNyfiCode(code) ? `$${formatted}` : formatted;
}