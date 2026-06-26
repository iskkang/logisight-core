import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { Report, ReportsBundle } from "./reports";

// 마켓 리포트 카탈로그(reports 테이블, 046)를 프론트가 직접 read. 백엔드 logisight가 채운다.
// '*' 사용 이유: 분류 컬럼 report_class/region/iso_week(마이그레이션 048)이 아직 미적용이어도
// 쿼리가 깨지지 않도록(명시 컬럼이면 "column does not exist" 400). 적용 전엔 해당 필드만 없을 뿐,
// 컴포넌트가 type/region으로 폴백한다. 적용+권역 발행 후 자동으로 매트릭스가 채워진다.
const SELECT = "*";

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
      // 권역 리포트가 주차당 ~3행 추가되므로 매트릭스에 충분한 주차가 보이도록 상향.
      .limit(60);
    if (error) throw new Error(error.message);

    return { weekly, monthly, archive: (archive ?? []) as unknown as Report[] };
  },
);
