import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { WeeklyBriefingPayload } from "./briefing";

export const getLatestBriefing = createServerFn({ method: "GET" }).handler(
  async (): Promise<WeeklyBriefingPayload | null> => {
    const { data: briefing, error } = await supabasePublicServer
      .from("weekly_briefings")
      .select("id,title,subtitle,week_of,content,published_at")
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!briefing) return null;

    const { data: points, error: pErr } = await supabasePublicServer
      .from("weekly_briefing_points")
      .select("id,briefing_id,category,agent_type,headline,display_order")
      .eq("briefing_id", briefing.id)
      .order("display_order", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    return { briefing, points: points ?? [] };
  },
);