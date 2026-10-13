import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { HsClassificationInput, HsClassificationResult } from "@/server/hs-classification";

// hs_classification_queries 는 생성된 Database 타입에 없다 —— customs_nomenclature ·
// eu_customs_measures 와 같은 상황이다(types.ts 를 다시 생성하면 들어온다).
// 그 사이 이 파일에 타입 에러를 남기지 않도록 느슨한 클라이언트로 좁혀서 쓴다.
const sb = supabaseAdmin as unknown as SupabaseClient;

/**
 * /customs 조회를 한 줄 남긴다.
 *
 * 기록 실패가 조회 실패가 되면 안 된다 ★ 로그는 부가 기능이고, 이용자가 받을 답은
 * 이미 만들어져 있다. 그래서 어떤 오류도 삼키고 콘솔에만 남긴다.
 *
 * 서비스롤로 쓴다 —— 이 표에는 공개 읽기 정책이 없다. description 은 이용자가
 * 입력한 제품 설명이라 영업상 민감할 수 있어 밖으로 내보내지 않는다.
 */
export async function logHsQuery(
  // "제품 설명으로 AI 분류" 인지 "HS 코드 직접 조회" 인지. 어느 경로를 실제로
  // 쓰는지 알아야 다음 작업 우선순위를 정할 수 있다.
  mode: "describe" | "code",
  // description 에는 이용자가 입력한 것을 그대로 담는다 —— 설명 경로면 설명,
  // 코드 경로면 코드.
  input: Pick<HsClassificationInput, "originCountry" | "destinationMarket" | "destinationCountry"> & {
    description: string;
  },
  result: HsClassificationResult | null,
  durationMs: number,
  error: unknown,
): Promise<void> {
  try {
    const top = result?.candidates[0]?.heading.match(/^(\d{8})/)?.[1] ?? null;
    await sb.from("hs_classification_queries").insert({
      mode,
      description: input.description,
      origin_country: input.originCountry ?? null,
      destination_market: input.destinationMarket ?? null,
      destination_country: input.destinationCountry ?? null,
      status: result?.status ?? null,
      top_cn8: top,
      candidate_count: result?.candidates.length ?? null,
      duty_status: result?.customs?.duty.status ?? null,
      landed_cost_status: result?.customs?.landedCost.status ?? null,
      origin_status: result?.customs?.originAssessment?.status ?? null,
      duration_ms: durationMs,
      error_message: error == null ? null : error instanceof Error ? error.message : String(error),
    });
  } catch (e) {
    console.error("[hs-query-log] 기록 실패:", e instanceof Error ? e.message : e);
  }
}
