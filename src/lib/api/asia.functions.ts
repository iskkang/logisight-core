import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import {
  buildAsiaTable,
  recentPeriods,
  trimEmptyLeading,
  type AsiaRow,
  type ThroughputRow,
} from "@/lib/asia-table";

// port_throughput 은 생성된 Database 형에 아직 없다(파이프라인 저장소에서 만든 테이블).
// 형을 다시 뽑으면 이 캐스팅은 사라진다.
const sb = supabasePublicServer as unknown as SupabaseClient;

const MAX_MONTHS = 36;

/**
 * 동아시아 컨테이너 물동량 표.
 *
 * 국가 대표 계열만 골라 쓰는 판정은 lib/asia-table.ts 가 한다 —— 여기서는 넉넉히 읽어
 * 넘기기만 한다. 항만별 행이 섞여 있어(JP 14개 항만) 필요한 것보다 많이 읽힌다.
 */
export const getAsiaThroughput = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ months: z.number().int().min(1).max(MAX_MONTHS) }).parse(d))
  .handler(async ({ data }): Promise<AsiaRow[]> => {
    const periods = recentPeriods(new Date(), data.months);
    // 전년비를 계산하려면 표에 보이는 구간보다 12개월 더 읽어야 한다.
    const withLookback = recentPeriods(new Date(), data.months + 12);
    const oldest = withLookback[withLookback.length - 1];

    // 연 경계를 넘는 (year, month) 범위라 or 로 나눠 건다.
    const { data: rows, error } = await sb
      .from("port_throughput")
      .select("country,port_code,year,month,teu,is_preliminary,yoy_pct")
      .or(`year.gt.${oldest.year},and(year.eq.${oldest.year},month.gte.${oldest.month})`)
      .limit(8000);
    if (error) throw new Error(error.message);

    return trimEmptyLeading(buildAsiaTable((rows ?? []) as ThroughputRow[], periods));
  });
