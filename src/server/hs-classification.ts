import { z } from "zod";

export const hsClassificationInputSchema = z.object({
  description: z.string().trim().min(10).max(5000),
  originCountry: z.string().length(2).default("KR"),
  destinationMarket: z.enum(["EU"]).default("EU"),
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
});

export type HsClassificationInput = z.infer<typeof hsClassificationInputSchema>;

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
  missingInformation: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  warnings: z.array(z.string()),
  customs: z.object({
    duty: z.object({ status: z.enum(["available","pending"]), thirdCountryRate: z.number().nullable(), preferentialRate: z.number().nullable(), notes: z.array(z.string()), sources: z.array(z.string().url()) }),
    regulation: z.object({ status: z.enum(["available","guidance","pending"]), items: z.array(z.object({ title:z.string(), detail:z.string(), url:z.string().url() })) }),
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
