import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type {
  LaneRow,
  DelayWeeklyRow,
  DisruptionRow,
} from "./eurasia";

export const getEurasiaLanes = createServerFn({ method: "GET" }).handler(
  async (): Promise<LaneRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("lanes")
      .select(
        "id,name_ko,name_en,transit_min,transit_max,border_points,is_featured,display_order",
      )
      .order("is_featured", { ascending: false })
      .order("display_order", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as LaneRow[];
  },
);

export const getEurasiaDelays = createServerFn({ method: "GET" }).handler(
  async (): Promise<DelayWeeklyRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("delay_index_weekly")
      .select(
        "lane_id,week_iso,on_time_rate,otp_pct,sample_count,median_delay_d,p90_delay_d,milestone",
      )
      .order("week_iso", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as DelayWeeklyRow[];
  },
);

export const getEurasiaDisruptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<DisruptionRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("disruption_events")
      .select(
        "id,lane_id,title_ko,title_en,category,severity,started_at,resolved_at,event_date,impact_days,source_url",
      )
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as DisruptionRow[];
  },
);