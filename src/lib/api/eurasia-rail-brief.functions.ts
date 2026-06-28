import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

// 유라시아 철도 AI 브리프 — collectors/eurasia-risk-brief.ts 가 eurasia_charts(key='rail_brief')에 적재.
// 종합(control tower)의 Action Queue 철도 액션 + 유라시아 리스크 카드에 사용.
export type RailBriefSeverity = "high" | "medium" | "low";
export type RailBriefAction = { title: string; sub: string; severity: RailBriefSeverity };
export type RailBriefRisk = { title: string; severity: RailBriefSeverity };
export type RailBrief = {
  action: RailBriefAction | null;
  risks: RailBriefRisk[];
  generatedAt: string | null;
};

type Payload = { action?: RailBriefAction; risks?: RailBriefRisk[]; generatedAt?: string };

export const getEurasiaRailBrief = createServerFn({ method: "GET" }).handler(async (): Promise<RailBrief> => {
  setResponseHeader("cache-control", "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400");
  const sb = supabasePublicServer as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { payload: Payload } | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await sb.from("eurasia_charts").select("payload").eq("key", "rail_brief").maybeSingle();
  if (error) throw new Error(error.message);
  const p = data?.payload ?? null;
  return {
    action: p?.action ?? null,
    risks: Array.isArray(p?.risks) ? p!.risks : [],
    generatedAt: p?.generatedAt ?? null,
  };
});
