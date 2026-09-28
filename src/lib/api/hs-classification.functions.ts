import { createServerFn } from "@tanstack/react-start";

import {
  buildInsufficientInformationResult,
  hsClassificationInputSchema,
  type HsClassificationResult,
} from "@/server/hs-classification";
import { analyzeProductForEuCn } from "@/server/openai-hs";
import { searchOfficialEuNomenclatureByConcepts } from "@/server/customs-nomenclature";

export const classifyHsProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => hsClassificationInputSchema.parse(input))
  .handler(async ({ data }): Promise<HsClassificationResult> => {
    const analysis = await analyzeProductForEuCn(data);

    const officialCandidates = await searchOfficialEuNomenclatureByConcepts(
      analysis.searchConceptsEs,
      5,
    );

    if (officialCandidates.length === 0) {
      return {
        status: "needs_information",
        normalizedProduct: {
          name: analysis.normalizedName,
          material: analysis.material,
          composition: analysis.composition,
          intendedUse: analysis.intendedUse,
          form: analysis.form,
        },
        candidates: [],
        missingInformation: ["official_cn_candidate_not_found"],
        followUpQuestions: [
          "현재 상품 설명으로 공식 EU CN 후보를 충분히 좁히지 못했습니다. 제품의 주요 기능, 성분/재질, 형태를 더 구체적으로 입력해 주세요.",
        ],
        warnings: [
          "공식 CN 데이터에서 확인되지 않은 코드는 생성하지 않았습니다.",
          "현재 결과는 세관의 확정 분류가 아닙니다.",
        ],
        methodology: "AI candidate generation; official nomenclature verification pending",
      };
    }

    return {
      status: "candidate",
      normalizedProduct: {
        name: analysis.normalizedName,
        material: analysis.material,
        composition: analysis.composition,
        intendedUse: analysis.intendedUse,
        form: analysis.form,
      },
      candidates: officialCandidates.map((candidate, index) => ({
        hs6: candidate.code.slice(0, 6),
        heading: `${candidate.code} — ${candidate.description}`,
        rationale: [
          "OpenAI는 제품 특성과 검색 개념만 구조화했습니다.",
          `후보 코드는 공식 ${candidate.sourceVersion} 데이터에서 조회되었습니다.`,
          "후보 순서는 현재 검색 관련도 기반이며 CLASS/BTI 검증 전에는 확정 분류가 아닙니다.",
        ],
        confidence: Math.max(
          0.25,
          (analysis.missingInformation.length > 0 ? 0.52 : 0.65) - index * 0.07,
        ),
        sourceStatus: "officially_verified",
      })),
      missingInformation: analysis.missingInformation,
      followUpQuestions: analysis.followUpQuestions,
      warnings: [
        ...(analysis.missingInformation.length > 0
          ? ["분류에 영향을 줄 수 있는 정보가 일부 부족하므로 후보 신뢰도를 낮게 표시했습니다."]
          : []),
        "officially_verified는 코드가 공식 CN 데이터에 존재한다는 의미이며, 해당 상품의 최종 세관 분류가 확정됐다는 뜻은 아닙니다.",
        "다음 단계에서 CLASS/BTI 및 분류규정 검증을 추가해야 합니다.",
      ],
      methodology: "AI candidate generation; official nomenclature verification pending",
    };
  });
