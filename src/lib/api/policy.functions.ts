import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { PolicyAlertRow, PolicyNewsItem } from "./policy";

export const getActivePolicyAlerts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PolicyAlertRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("policy_alerts")
      .select("id,code,title,meta,is_active,display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as PolicyAlertRow[];
  },
);

export const getPolicyRelatedNews = createServerFn({ method: "GET" }).handler(
  async (): Promise<PolicyNewsItem[]> => {
    // Fetch a generous window; filtering by tag happens client-side per code
    // since codes vary and we render per-code sections.
    const { data, error } = await supabasePublicServer
      .from("maritime_news")
      .select("id,title,summary,url,source,published_at,tags")
      .not("tags", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as PolicyNewsItem[];
  },
);