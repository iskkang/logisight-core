import { queryOptions } from "@tanstack/react-query";

import { getLatestBriefing, getBriefingByWeek, listBriefingWeeks } from "./briefing.functions";

export type BriefingRow = {
  id: string;
  title: string;
  subtitle: string | null;
  week_of: string;
  content: string | null;
  published_at: string | null;
};

// 발행물 목록 항목(본문 제외) — /reports 목록·최신 리다이렉트용.
export type BriefingListItem = {
  id: string;
  title: string;
  subtitle: string | null;
  week_of: string;
  published_at: string | null;
};

export type BriefingPoint = {
  id: string;
  briefing_id: string;
  category: string;
  agent_type: string;
  headline: string;
  display_order: number;
};

export type WeeklyBriefingPayload = {
  briefing: BriefingRow;
  points: BriefingPoint[];
};

export const latestBriefingQueryOptions = () =>
  queryOptions({
    queryKey: ["weekly_briefings", "latest"],
    queryFn: () => getLatestBriefing(),
    staleTime: 10 * 60 * 1000,
  });

export const briefingByWeekQueryOptions = (week: string) =>
  queryOptions({
    queryKey: ["weekly_briefings", "week", week],
    queryFn: () => getBriefingByWeek({ data: { week } }),
    staleTime: 10 * 60 * 1000,
  });

export const briefingWeeksQueryOptions = () =>
  queryOptions({
    queryKey: ["weekly_briefings", "list"],
    queryFn: () => listBriefingWeeks(),
    staleTime: 10 * 60 * 1000,
  });

export function formatBriefingDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}