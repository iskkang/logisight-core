import type { SupabaseClient } from "@supabase/supabase-js";

import type { HsClassificationInput, HsClassificationResult } from "@/server/hs-classification";
import { supabasePublicServer } from "@/integrations/supabase/public.server";

// customs_nomenclature · customs_duty_measures 는 생성된 Database 타입에 없다.
// types.ts 를 다시 생성하면 들어온다. 그 사이 타입 에러를 남기지 않도록 좁혀 쓴다.
const sb = supabasePublicServer as unknown as SupabaseClient;

const SOURCE_URL = "https://hts.usitc.gov/";

/**
 * 232조·301조 등 추가관세는 들어 있지 않다 ★
 *
 * 그것들은 HTS 99류에 "The duty provided in the applicable subheading + 25%"
 * 같은 조항으로 있지만, 적용 범위가 "Except for products described in headings
 * 9903.01.30–9903.01.33, ..." 식의 예외 사슬이라 어느 품목·원산지에 걸리는지는
 * U.S. Notes 를 해석해야 나온다. 지금 적재한 건 기본세율과 한-미 FTA 세율뿐이다.
 *
 * 한국산도 남의 일이 아니다 —— 99류에 한국을 지목한 조항이 17개 있다. 그래서
 * 이 문구는 결과에 항상 붙인다. 빼면 이용자가 3.4% 를 보고 돌아가는데 실제
 * 부담은 3.4% + 추가관세일 수 있다.
 */
const ADDITIONAL_DUTY_WARNING =
  "미국의 232조·301조 등 추가관세는 이 결과에 포함되어 있지 않습니다. 품목·원산지에 따라 기본세율 위에 더 붙을 수 있으므로 반드시 별도로 확인하세요.";

type DutyRow = {
  code: string;
  measure_type: "THIRD_COUNTRY_DUTY" | "PREFERENCE";
  rate_percent: number | null;
  rate_text: string | null;
  title: string;
  source_url: string;
};

/**
 * 미국 HTS 코드 조회. EU 경로와 달리 VAT·원산지 판정·수입 규제 데이터가 없다.
 * 없는 것을 있는 척하지 않고 그만큼만 돌려준다.
 */
export async function lookupUsHtsCode(
  digits: string,
  data: HsClassificationInput,
): Promise<HsClassificationResult> {
  const { data: rows, error } = await sb
    .from("customs_nomenclature")
    .select("code,description,source_url,source_version")
    .eq("market", "US")
    .eq("nomenclature", "HTS")
    .eq("is_active", true)
    .like("code", `${digits}%`)
    .order("code", { ascending: true })
    .limit(40);
  if (error) throw new Error(`US nomenclature lookup failed: ${error.message}`);

  const matches = (rows ?? []) as { code: string; description: string; source_url: string; source_version: string }[];

  if (matches.length === 0) {
    return {
      status: "needs_information",
      normalizedProduct: { name: digits, material: null, composition: null, intendedUse: null, form: null },
      candidates: [],
      missingInformation: ["hts_code_not_found"],
      followUpQuestions: [
        `${digits} 로 시작하는 HTS 코드를 공식 데이터에서 찾지 못했습니다. 코드를 다시 확인해 주세요.`,
      ],
      warnings: ["공식 HTS 데이터에 없는 코드는 만들어 내지 않습니다."],
      methodology: "US HTS direct lookup",
    };
  }

  // 세율은 8자리(법정 세번) 또는 10자리(통계 세번)에 붙는다. 정확히 일치하는
  // 코드가 없으면 고르게 한다 —— 상위 코드로 세율을 특정하지 않는다.
  const exact = matches.find((row) => row.code === digits);
  if (!exact) {
    return {
      status: "needs_information",
      normalizedProduct: { name: digits, material: null, composition: null, intendedUse: null, form: null },
      candidates: [],
      undecidedCandidates: matches.slice(0, 12).map((row) => ({ code: row.code, description: row.description })),
      missingInformation: ["hts_line_not_specified"],
      followUpQuestions: [`${digits} 아래의 품목코드를 골라 주세요. 세율은 세번 단위로 정해집니다.`],
      warnings: ["상위 코드로는 세율을 특정하지 않습니다.", ADDITIONAL_DUTY_WARNING],
      methodology: "US HTS direct lookup; awaiting line selection",
    };
  }

  // 8자리에만 세율이 붙은 경우가 있어 상위로 거슬러 올라간다(EU 와 같은 방식).
  const prefixes = [exact.code, exact.code.slice(0, 8), exact.code.slice(0, 6), exact.code.slice(0, 4)];
  const { data: dutyRows, error: dutyError } = await sb
    .from("customs_duty_measures")
    .select("code,measure_type,rate_percent,rate_text,title,source_url")
    .eq("market", "US")
    .eq("is_active", true)
    .in("code", prefixes)
    .or("origin_country.is.null,origin_country.eq.KR")
    .limit(50);
  if (dutyError) throw new Error(`US duty lookup failed: ${dutyError.message}`);

  // 긴 코드가 짧은 코드를 이긴다 —— 상위 세번이 하위 세번의 세율을 가리면 안 된다.
  const duties = ((dutyRows ?? []) as DutyRow[]).sort((a, b) => b.code.length - a.code.length);
  const mfn = duties.find((row) => row.measure_type === "THIRD_COUNTRY_DUTY");
  const korus = duties.find((row) => row.measure_type === "PREFERENCE");

  // 한국산 특혜세율을 쓸 수 있다고 이용자가 밝힌 경우에만 그걸로 계산한다.
  const appliedRate =
    data.preferentialOriginEligible === true && korus?.rate_percent != null
      ? korus.rate_percent
      : mfn?.rate_percent ?? null;
  const customsValue = data.productValue != null ? data.productValue + (data.freight ?? 0) + (data.insurance ?? 0) : null;
  const dutyAmount = customsValue != null && appliedRate != null ? (customsValue * appliedRate) / 100 : null;
  const importCosts = data.importCosts ?? 0;
  // 미국에는 수입 VAT 가 없다. 주별 판매세는 수입 단계의 세금이 아니므로
  // 도착원가에 넣지 않는다 —— EU 식과 공식이 다르다.
  const estimatedTotal = customsValue != null && dutyAmount != null ? customsValue + dutyAmount + importCosts : null;

  return {
    status: "candidate",
    normalizedProduct: { name: exact.description, material: null, composition: null, intendedUse: null, form: null },
    candidates: [
      {
        hs6: exact.code.slice(0, 6),
        heading: `${exact.code} — ${exact.description}`,
        rationale: [
          "이용자가 입력한 HTS 코드를 공식 데이터에서 확인했습니다.",
          `공식 ${exact.source_version} 데이터에서 조회`,
          "AI 분류를 거치지 않았습니다. 코드가 해당 물품에 맞는지는 판단하지 않았습니다.",
        ],
        confidence: 0,
        sourceStatus: "officially_verified",
        evidence: [
          {
            type: "CN",
            title: `US Harmonized Tariff Schedule ${exact.source_version}`,
            url: exact.source_url || SOURCE_URL,
            status: "matched",
            note: `${exact.code}가 공식 HTS 데이터에 존재함을 확인했습니다.`,
          },
        ],
      },
    ],
    missingInformation: [],
    followUpQuestions: [],
    customs: {
      duty: {
        status: mfn || korus ? "available" : "pending",
        thirdCountryRate: mfn?.rate_percent ?? null,
        thirdCountryRateText: mfn?.rate_text ?? null,
        preferentialRate: korus?.rate_percent ?? null,
        preferentialRateText: korus?.rate_text ?? null,
        notes: [
          ADDITIONAL_DUTY_WARNING,
          ...(korus
            ? ["한-미 FTA 특혜세율은 원산지 기준을 충족하고 유효한 원산지증명이 있는 경우에만 적용됩니다."]
            : []),
          ...(mfn?.rate_percent === 0 ? ["기본세율이 이미 0%입니다."] : []),
        ],
        sources: [...new Set(duties.map((row) => row.source_url || SOURCE_URL))],
      },
      // 미국은 수입 규제·원산지 기준 데이터를 아직 적재하지 않았다. 빈 상태를
      // 그대로 보여주고 있는 척하지 않는다.
      regulation: { status: "pending", items: [] },
      originAssessment: {
        status: "rule_unavailable",
        ruleCode: null,
        ruleTextKo: null,
        sourceUrl: null,
        checks: [],
        missingInputs: ["한-미 FTA 품목별 원산지기준(PSR) 데이터"],
      },
      landedCost: {
        status: estimatedTotal != null ? "ready" : "needs_values",
        formula: "상품가 + 운임 + 보험료 + 관세 + 수입부대비용 (미국은 수입 VAT 없음)",
        missingInputs: [
          ...(data.productValue == null ? ["상품가격"] : []),
          ...(appliedRate == null ? ["적용 관세율"] : []),
        ],
        customsValue,
        dutyAmount,
        vatAmount: null,
        importCosts,
        estimatedTotal,
      },
    },
    warnings: [
      ADDITIONAL_DUTY_WARNING,
      "입력하신 코드가 그 물품에 맞는 분류인지는 확인하지 않았습니다. 코드가 공식 HTS 에 존재한다는 것과, 그 코드의 세율이 무엇인지만 조회했습니다.",
      "미국 수입 규제와 한-미 FTA 원산지 판정은 아직 데이터가 없습니다. 별도로 확인하세요.",
      "최종 세관 분류와 세액은 수입통관 시 확정됩니다.",
    ],
    methodology: "US HTS direct lookup; MFN + KORUS special rate (additional Section 232/301 duties not included)",
  };
}
