import { queryOptions } from "@tanstack/react-query";
import { getLatestRatesBrief } from "./rates-brief.functions";

export type RatesBriefProse = {
  headline: string;
  ocean: string;
  global: string;
  air: string;
  outlook: string;
};
export type RatesBriefRow = {
  week_id: string;
  as_of: string;
  signals_json: { label: string; state: string; basis: string }[];
  prose_json: RatesBriefProse;
  generated_at: string | null;
};

export const latestRatesBriefQueryOptions = () =>
  queryOptions({
    queryKey: ["rates_brief", "latest"],
    queryFn: () => getLatestRatesBrief(),
    staleTime: 30 * 60 * 1000,
  });

// generated_at 이 10일 이내면 신선
export function isFresh(row: RatesBriefRow | null): boolean {
  if (!row?.generated_at) return false;
  return Date.now() - new Date(row.generated_at).getTime() <= 10 * 86400000;
}
