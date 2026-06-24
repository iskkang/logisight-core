import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { Report, ReportsBundle } from "./reports";

// 마켓 리포트 카탈로그(reports 테이블, 046)를 프론트가 직접 read. 백엔드 logisight가 채운다.
const SELECT =
  "id,type,period_start,period_end,period_label,title,summary,pdf_url,web_url,cover_url,published_at";

export const getReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReportsBundle> => {
    const latest = async (type: "weekly" | "monthly"): Promise<Report | null> => {
      const { data, error } = await supabasePublicServer
        .from("reports")
        .select(SELECT)
        .eq("type", type)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as Report | null;
    };

    const [weekly, monthly] = await Promise.all([latest("weekly"), latest("monthly")]);

    const { data: archive, error } = await supabasePublicServer
      .from("reports")
      .select(SELECT)
      .order("period_start", { ascending: false })
      .limit(24);
    if (error) throw new Error(error.message);

    return { weekly, monthly, archive: (archive ?? []) as unknown as Report[] };
  },
);
