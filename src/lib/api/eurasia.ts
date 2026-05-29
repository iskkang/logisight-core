import { queryOptions } from "@tanstack/react-query";

import {
  getEurasiaLanes,
  getEurasiaDelays,
  getEurasiaDisruptions,
} from "./eurasia.functions";

export type LaneRow = {
  id: string;
  name_ko: string | null;
  name_en: string | null;
  transit_min: number | null;
  transit_max: number | null;
  border_points: string[] | null;
  is_featured: boolean | null;
  display_order: number | null;
};

export type DelayWeeklyRow = {
  lane_id: string;
  week_iso: string;
  on_time_rate: number | null;
  otp_pct: number | null;
  sample_count: number | null;
  median_delay_d: number | null;
  p90_delay_d: number | null;
  milestone: string | null;
};

export type DisruptionRow = {
  id: string;
  lane_id: string | null;
  title_ko: string | null;
  title_en: string | null;
  category: string | null;
  severity: string | null;
  started_at: string | null;
  resolved_at: string | null;
  event_date: string | null;
  impact_days: number | null;
  source_url: string | null;
};

export const eurasiaLanesQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia", "lanes"],
    queryFn: () => getEurasiaLanes(),
    staleTime: 10 * 60 * 1000,
  });

export const eurasiaDelaysQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia", "delays"],
    queryFn: () => getEurasiaDelays(),
    staleTime: 5 * 60 * 1000,
  });

export const eurasiaDisruptionsQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia", "disruptions"],
    queryFn: () => getEurasiaDisruptions(),
    staleTime: 5 * 60 * 1000,
  });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function laneOrigin(laneId: string): string {
  const prefix = laneId.split("-")[0]?.toUpperCase() ?? "";
  switch (prefix) {
    case "CN":
      return "중국";
    case "KR":
      return "한국";
    case "RU":
      return "러시아";
    case "KZ":
      return "카자흐스탄";
    case "DE":
      return "독일";
    case "PL":
      return "폴란드";
    case "BY":
      return "벨라루스";
    case "MN":
      return "몽골";
    default:
      return prefix || "—";
  }
}