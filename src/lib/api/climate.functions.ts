import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type {
  AssetRow,
  RiskRow,
  RouteRow,
  EventRow,
  ClimateForecastRow,
  ClimateRiskData,
} from "./climate";

// globe 테이블(assets/asset_risk/routes/events)은 생성된 Database 타입에 아직 없음
// → 레포 관례대로 클라이언트를 캐스팅해 사용 (industries/operational-delay.functions.ts와 동일).
const sb = supabasePublicServer as unknown as SupabaseClient;

// assets 43 · asset_risk 172(4 horizon) · routes 5 · events ~30 — anon read(RLS).
export const getClimateRisk = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClimateRiskData> => {
    const [assetsRes, riskRes, routesRes, eventsRes, fcRes] = await Promise.all([
      sb.from("assets").select("id,name,type,lon,lat,freeze_prone").limit(500),
      sb
        .from("asset_risk")
        .select(
          "asset_id,horizon_days,score,level,driver,wind_gust,wave_height,precip,snowfall,temp_min,is_freeze",
        )
        .limit(2000),
      sb.from("routes").select("id,name,waypoints,chokes").limit(100),
      sb
        .from("events")
        .select("id,source,kind,title,severity,lon,lat,area,url")
        .limit(500),
      // 발행된 기후 영향 AI 분석(파이프라인 자동발행) — read만. anon RLS는 published/resolved만 허용.
      sb
        .from("forecasts")
        .select(
          "id,metric_ref,statement,impact_note,basis,confidence,confidence_reason,data_quality_flags,published_at",
        )
        .eq("module", "climate")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(100),
    ]);

    for (const r of [assetsRes, riskRes, routesRes, eventsRes, fcRes]) {
      if (r.error) throw new Error(r.error.message);
    }

    return {
      assets: (assetsRes.data ?? []) as unknown as AssetRow[],
      risk: (riskRes.data ?? []) as unknown as RiskRow[],
      routes: (routesRes.data ?? []) as unknown as RouteRow[],
      events: (eventsRes.data ?? []) as unknown as EventRow[],
      forecasts: (fcRes.data ?? []) as unknown as ClimateForecastRow[],
    };
  },
);
