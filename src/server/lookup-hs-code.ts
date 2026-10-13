import type { SupabaseClient } from "@supabase/supabase-js";

import type { HsClassificationInput, HsClassificationResult } from "@/server/hs-classification";
import { supabasePublicServer } from "@/integrations/supabase/public.server";

// customs_nomenclature 는 생성된 Database 타입에 없다(customs-nomenclature.ts ·
// eu-customs-measures.ts 와 같은 상황). types.ts 를 다시 생성하면 들어온다.
// 그 사이 이 파일에 타입 에러를 남기지 않도록 느슨한 클라이언트로 좁혀서 쓴다.
const sb = supabasePublicServer as unknown as SupabaseClient;
import { findEuClassificationEvidence } from "@/server/classification-evidence";
import { buildEuCustomsBlock } from "@/server/eu-customs-block";

/**
 * HS 코드를 아는 사람을 위한 조회 경로. LLM 을 부르지 않는다 ★
 *
 * 분류 경로는 제품 설명을 LLM 두 번에 태워 9.6~11.6초가 걸린다(실측). 그런데
 * 포워더는 코드를 이미 아는 경우가 많다 —— 인보이스·수출신고필증에 적혀 있다.
 * 코드를 아는 사람에게 설명을 다시 쓰게 하고 12초를 기다리게 할 이유가 없다.
 * 이 경로는 DB 조회만 하므로 1초대에 끝나고 LLM 비용이 0이다.
 *
 * 분류를 대신하지 않는다는 점이 중요하다. 코드가 그 물건에 맞는지는 이용자가
 * 단언한 것이고 우리는 "그 코드가 공식 CN 2026 에 있는지"만 확인한다. 결과의
 * warnings 에 그 구분을 반드시 남긴다.
 */
export async function lookupEuHsCode(
  digits: string,
  data: HsClassificationInput,
): Promise<HsClassificationResult> {
  const { data: rows, error } = await sb
    .from("customs_nomenclature")
    .select("code,description,description_ko,source_url,source_version")
    .eq("market", "EU")
    .eq("nomenclature", "CN")
    .eq("is_active", true)
    .eq("level", 8)
    .like("code", `${digits}%`)
    .order("code", { ascending: true })
    .limit(40);
  if (error) throw new Error(`Official nomenclature lookup failed: ${error.message}`);

  const matches = rows ?? [];

  if (matches.length === 0) {
    return {
      status: "needs_information",
      normalizedProduct: { name: digits, material: null, composition: null, intendedUse: null, form: null },
      candidates: [],
      missingInformation: ["cn_code_not_found"],
      followUpQuestions: [
        `${digits} 로 시작하는 CN 코드를 CN 2026 공식 데이터에서 찾지 못했습니다. 코드를 다시 확인하시거나, 제품 설명으로 분류해 보세요.`,
      ],
      warnings: ["공식 CN 데이터에 없는 코드는 만들어 내지 않습니다."],
      methodology: "HS code direct lookup; official CN verification",
    };
  }

  // 8자리를 정확히 입력했고 그 코드가 실제로 있는 경우에만 바로 답한다.
  // 그 밖에는 —— 4·6자리를 넣었거나 8자리가 상위 코드로만 걸린 경우 ——
  // 고르라고 돌려준다. 보류 화면(undecidedCandidates)을 그대로 재사용한다.
  const exact = digits.length === 8 ? matches.find((row) => row.code === digits) : undefined;
  if (!exact) {
    return {
      status: "needs_information",
      normalizedProduct: { name: digits, material: null, composition: null, intendedUse: null, form: null },
      candidates: [],
      undecidedCandidates: matches
        .slice(0, 12)
        .map((row) => ({ code: row.code, description: row.description_ko ?? row.description })),
      missingInformation: ["cn8_not_specified"],
      followUpQuestions: [
        digits.length === 8
          ? `${digits} 자체는 CN 2026 품목코드가 아닙니다. 아래 하위 코드 중에서 골라 주세요.`
          : `${digits} 아래의 8자리 품목코드를 골라 주세요. 관세율은 8자리 단위로 정해집니다.`,
      ],
      warnings: ["관세율은 8자리 CN 코드 단위로 달라집니다. 상위 코드로는 세율을 특정하지 않습니다."],
      methodology: "HS code direct lookup; official CN verification; awaiting CN8 selection",
    };
  }

  const label = exact.description_ko ?? exact.description;
  // 규제 조회는 제품 설명의 키워드를 본다(예: "bluetooth" → RED). 코드만 입력한
  // 경우에는 그 텍스트가 없으므로 공식 품명으로 대신한다 —— 아래 warnings 에
  // 그래서 규제 항목이 덜 잡힐 수 있다고 적는다.
  const productEvidenceText = [label, data.material, data.composition, data.intendedUse, data.form]
    .filter(Boolean)
    .join(" ");

  const [evidence, customs] = await Promise.all([
    findEuClassificationEvidence(exact.code, productEvidenceText),
    buildEuCustomsBlock(exact.code, { ...data, description: label }, productEvidenceText, exact.code.startsWith("3304")),
  ]);

  return {
    status: "candidate",
    normalizedProduct: { name: label, material: null, composition: null, intendedUse: null, form: null },
    candidates: [
      {
        hs6: exact.code.slice(0, 6),
        heading: `${exact.code} — ${label}`,
        rationale: [
          "이용자가 입력한 HS 코드를 공식 CN 데이터에서 확인했습니다.",
          `공식 ${exact.source_version} 데이터에서 조회`,
          "AI 분류를 거치지 않았습니다. 코드가 해당 물품에 맞는지는 판단하지 않았습니다.",
        ],
        confidence: 0,
        sourceStatus: "officially_verified",
        evidence: [
          {
            type: "CN",
            title: `EU Combined Nomenclature ${exact.source_version}`,
            url: exact.source_url,
            status: "matched",
            note: `${exact.code}가 공식 CN 데이터에 존재함을 확인했습니다.`,
          },
          ...evidence.map((item) => ({
            type: item.sourceType === "EBTI" ? ("EBTI" as const) : ("CLASS" as const),
            title: item.title,
            url: item.sourceUrl,
            status: "matched" as const,
            note: [item.productDescription, item.decisionSummary, item.legalBasis].filter(Boolean).join(" "),
          })),
        ],
      },
    ],
    missingInformation: [],
    followUpQuestions: [],
    customs,
    warnings: [
      "입력하신 코드가 그 물품에 맞는 분류인지는 확인하지 않았습니다. 코드가 공식 CN 2026 에 존재한다는 것과, 그 코드의 세율·규제가 무엇인지만 조회했습니다.",
      "수입 규제는 제품 설명의 키워드로도 찾습니다. 코드만 입력한 경우 일부 규제가 빠질 수 있으니, 규제까지 보려면 제품 설명으로 분류해 보세요.",
      "최종 세관 분류와 세액은 수입통관 시 확정됩니다.",
    ],
    methodology: "HS code direct lookup; official CN verification; customs/FTA/regulation lookup (no AI classification)",
  };
}
