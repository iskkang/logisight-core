import { z } from "zod";

export const hsClassificationInputSchema = z.object({
  description: z.string().trim().min(2).max(5000),
  originCountry: z.string().length(2).default("KR"),
  destinationMarket: z.enum(["EU", "US"]).default("EU"),
  material: z.string().trim().max(1000).optional(),
  composition: z.string().trim().max(2000).optional(),
  intendedUse: z.string().trim().max(1000).optional(),
  form: z.string().trim().max(1000).optional(),
  destinationCountry: z.string().length(2).optional(),
  productValue: z.number().nonnegative().optional(),
  freight: z.number().nonnegative().optional(),
  insurance: z.number().nonnegative().optional(),
  importCosts: z.number().nonnegative().optional(),
  quantity: z.number().positive().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  preferentialOriginEligible: z.boolean().optional(),
  originManufacturedInKr: z.boolean().optional(),
  originFabricOriginating: z.boolean().optional(),
  originSufficientProcessing: z.boolean().optional(),
  originKnittingInKr: z.boolean().optional(),
  originSpinningOrExtrusionInKr: z.boolean().optional(),
  originMakingUpInKr: z.boolean().optional(),
  originExWorksPrice: z.number().nonnegative().optional(),
  originNonOriginatingMaterialValue: z.number().nonnegative().optional(),
  originNonOriginatingMaterialHs4: z.array(z.string().regex(/^\d{4}$/)).optional(),
  originNonOriginatingMaterialHs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
  originWhollyObtained: z.boolean().optional(),
});

export type HsClassificationInput = z.infer<typeof hsClassificationInputSchema>;

/**
 * HS 코드를 직접 넣는 조회용 입력. description 대신 cnCode 를 받고 나머지(원산지
 * 판정·원가 입력)는 분류 경로와 동일하다.
 *
 * 코드는 점·공백을 넣어 적는 경우가 많아(8507.60.00) 숫자만 남겨 받는다.
 * 4·6자리도 허용한다 —— 그 경우 하위 8자리 후보를 돌려주고 고르게 한다.
 */
export const hsCodeLookupInputSchema = hsClassificationInputSchema
  .omit({ description: true })
  .extend({
    cnCode: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((value) => value.replace(/[^0-9]/g, ""))
      // 미국 HTS 는 10자리다(인보이스에 적히는 것도 10자리). EU CN8 은 8자리.
      // 둘 다 받아야 하므로 4·6·8·10 을 허용한다.
      .refine((digits) => [4, 6, 8, 10].includes(digits.length), {
        message: "HS/HTS 코드는 4·6·8·10자리로 입력해 주세요.",
      }),
  });

export type HsCodeLookupInput = z.infer<typeof hsCodeLookupInputSchema>;

export const hsCandidateSchema = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  heading: z.string(),
  rationale: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  sourceStatus: z.enum(["ai_candidate", "officially_verified"]),
  evidence: z.array(z.object({
    type: z.enum(["CLASS", "EBTI", "CN", "LEGAL"]),
    title: z.string(),
    url: z.string().url(),
    status: z.enum(["official_source", "matched", "not_found", "manual_lookup_required"]),
    note: z.string(),
  })).default([]),
});

export const hsClassificationResultSchema = z.object({
  status: z.enum(["candidate", "needs_information", "verified"]),
  normalizedProduct: z.object({
    name: z.string(),
    material: z.string().nullable(),
    composition: z.string().nullable(),
    intendedUse: z.string().nullable(),
    form: z.string().nullable(),
  }),
  candidates: z.array(hsCandidateSchema).max(5),
  // 보류했을 때 "범위 안에 있었지만 고르지 못한" 공식 CN 후보 ★
  // candidates 에 넣지 않는 것이 중요하다 —— 그쪽은 우리가 책임지는 shortlist 이고
  // 화면·측정기 모두 candidates.length 로 "답이 있는가"를 판단한다. 안 고른 것을
  // 거기 섞으면 이 도구의 안전장치가 무너진다. 보여주되 자리를 구분한다.
  undecidedCandidates: z
    .array(z.object({ code: z.string(), description: z.string() }))
    .optional(),

  /**
   * 적용될 수 있는 추가관세 조항(미국 전용). 세율을 더하지 않는다 ★
   * 적용 범위가 U.S. Notes(PDF 법령 본문)에 있어 코드로 판정할 수 없다.
   * "대상일 수 있으니 확인하라"는 표시이지 계산 결과가 아니다.
   */
  additionalDutyNotices: z
    .array(
      z.object({
        provision: z.string(),
        ratePercent: z.number().nullable(),
        categoryKo: z.string().nullable(),
        description: z.string(),
        // 조항 원문의 "column 1 세율이 N% 미만/이상" 조건을 실제 기본세율과
        // 대조한 결과. 조건 자체는 숫자 비교라 판정할 수 있다 —— 다만 예외
        // 사슬은 여전히 남아 있으므로 "해당 가능성"까지만 말한다.
        conditionKo: z.string().nullable(),
        conditionMet: z.boolean().nullable(),
        url: z.string().url(),
      }),
    )
    .optional(),
  missingInformation: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  warnings: z.array(z.string()),
  customs: z.object({
    // rateText 는 종량세·복합세율의 원문이다 ★
    // 순수 종가세가 아니면 수집기가 rate_percent 를 null 로 둔다(13% + 5.3 EUR/100kg 를
    // 13% 로 적으면 관세를 적게 계산해 주게 되므로 옳은 처리다). 그런데 화면까지 null 만
    // 전달돼, 알고 있는 "13.000 % + 5.300 EUR DTN" 을 두고 "—" 를 보여주고 있었다.
    // 기본관세 9,670건 중 1,362건(14%)이 여기에 해당한다.
    duty: z.object({ status: z.enum(["available","pending"]), thirdCountryRate: z.number().nullable(), thirdCountryRateText: z.string().nullable(), preferentialRate: z.number().nullable(), preferentialRateText: z.string().nullable(), notes: z.array(z.string()), sources: z.array(z.string().url()) }),
    regulation: z.object({ status: z.enum(["available","guidance","pending"]), items: z.array(z.object({ title:z.string(), detail:z.string(), url:z.string().url() })) }),
    originAssessment: z.object({
      status: z.enum(["qualified","not_qualified","needs_information","rule_unavailable"]),
      ruleCode: z.string().nullable(),
      ruleTextKo: z.string().nullable(),
      sourceUrl: z.string().url().nullable(),
      checks: z.array(z.string()),
      missingInputs: z.array(z.string()),
    }).optional(),
    landedCost: z.object({ status: z.enum(["ready","needs_values","pending"]), formula: z.string(), missingInputs: z.array(z.string()), customsValue: z.number().nullable().optional(), dutyAmount: z.number().nullable().optional(), vatAmount: z.number().nullable().optional(), importCosts: z.number().nullable().optional(), estimatedTotal: z.number().nullable().optional() }),
  }).optional(),
  methodology: z.string(),
});

export type HsClassificationResult = z.infer<typeof hsClassificationResultSchema>;

export function buildInsufficientInformationResult(
  input: HsClassificationInput,
): HsClassificationResult {
  const missingInformation: string[] = [];
  const followUpQuestions: string[] = [];

  if (!input.material && !input.composition) {
    missingInformation.push("material_or_composition");
    followUpQuestions.push("제품의 주요 재질 또는 성분과 함량을 알려주세요.");
  }
  if (!input.intendedUse) {
    missingInformation.push("intended_use");
    followUpQuestions.push("제품의 주된 기능과 실제 사용 용도를 알려주세요.");
  }
  if (!input.form) {
    missingInformation.push("form");
    followUpQuestions.push("제품의 형태, 포장 상태 또는 작동 방식을 알려주세요.");
  }

  return {
    status: "needs_information",
    normalizedProduct: {
      name: input.description.slice(0, 160),
      material: input.material ?? null,
      composition: input.composition ?? null,
      intendedUse: input.intendedUse ?? null,
      form: input.form ?? null,
    },
    candidates: [],
    missingInformation,
    followUpQuestions,
    warnings: [
      "현재 결과는 HS 확정 판정이 아닙니다.",
      "공식 HS nomenclature 및 분류 결정례 검증 전에는 관세 신고에 사용하지 마세요.",
    ],
    methodology: "AI candidate generation; official nomenclature verification pending",
  };
}
