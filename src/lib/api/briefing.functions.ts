import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { BriefingRow, BriefingListItem, WeeklyBriefingPayload } from "./briefing";

const BRIEFING_COLS = "id,title,subtitle,week_of,content,published_at";

// 브리핑 1행 + 포인트(시황·기업·글로벌) 결합 — latest/by-week 공용.
async function withPoints(briefing: BriefingRow): Promise<WeeklyBriefingPayload> {
  const { data: points, error } = await supabasePublicServer
    .from("weekly_briefing_points")
    .select("id,briefing_id,category,agent_type,headline,display_order")
    .eq("briefing_id", briefing.id)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { briefing, points: points ?? [] };
}

export const getLatestBriefing = createServerFn({ method: "GET" }).handler(
  async (): Promise<WeeklyBriefingPayload | null> => {
    const { data: briefing, error } = await supabasePublicServer
      .from("weekly_briefings")
      .select(BRIEFING_COLS)
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!briefing) return null;
    return withPoints(briefing);
  },
);

export const getBriefingByWeek = createServerFn({ method: "GET" })
  .inputValidator(z.object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }): Promise<WeeklyBriefingPayload | null> => {
    const { data: briefing, error } = await supabasePublicServer
      .from("weekly_briefings")
      .select(BRIEFING_COLS)
      .eq("week_of", data.week)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!briefing) return null;
    return withPoints(briefing);
  });

// /reports 목록 + /briefing 최신 리다이렉트용 — 발행물 week_of 목록(본문 제외).
export const listBriefingWeeks = createServerFn({ method: "GET" }).handler(
  async (): Promise<BriefingListItem[]> => {
    const { data, error } = await supabasePublicServer
      .from("weekly_briefings")
      .select("id,title,subtitle,week_of,published_at")
      .order("week_of", { ascending: false })
      .limit(52);
    if (error) throw new Error(error.message);
    return (data ?? []) as BriefingListItem[];
  },
);