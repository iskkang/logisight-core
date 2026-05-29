import { queryOptions } from "@tanstack/react-query";

import { getNyfiData } from "./nyfi.functions";

export type NyfiHistoryPoint = { date: string; value: number };

export type NyfiLane = {
  code: string;          // "NYFI:ASIA-USWC"
  slug: string;          // "ASIA-USWC"
  nameKo: string;
  value: number;
  wow: number;           // % week-over-week
  absoluteWow: number;
  containerType: string | null;
  weekDate: string;      // ISO yyyy-mm-dd (latest history point)
  history: NyfiHistoryPoint[];
};

// Preferred display order — KR-relevant lanes first
export const NYFI_ORDER = [
  "NYFI:ASIA-USWC",
  "NYFI:ASIA-USEC",
  "NYFI:ASIA-NEUR",
  "NYFI:TRANS-ATLANTIC_WESTBOUND",
  "NYFI:TRANS-ATLANTIC_EASTBOUND",
] as const;

export const nyfiQueryOptions = () =>
  queryOptions({
    queryKey: ["nyfi", "live"],
    queryFn: () => getNyfiData(),
    staleTime: 60 * 60 * 1000, // 1h
  });

export function sortNyfiLanes(lanes: NyfiLane[]): NyfiLane[] {
  const order = new Map<string, number>(
    NYFI_ORDER.map((c, i) => [c as string, i]),
  );
  return [...lanes].sort(
    (a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99),
  );
}

export function formatNyfiValue(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}