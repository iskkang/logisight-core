import { createServerFn } from "@tanstack/react-start";

import {
  buildInsufficientInformationResult,
  hsClassificationInputSchema,
  type HsClassificationResult,
} from "@/server/hs-classification";
import { analyzeProductForEuCn, rankOfficialEuCnCandidates } from "@/server/openai-hs";
import { searchOfficialEuNomenclatureByHeadings } from "@/server/customs-nomenclature";
import { findEuClassificationEvidence } from "@/server/classification-evidence";

export const classifyHsProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => hsClassificationInputSchema.parse(input))
  .handler(async ({ data }): Promise<HsClassificationResult> => {
    const analysis = await analyzeProductForEuCn(data);

    const officialCandidates = await searchOfficialEuNomenclatureByHeadings(
      analysis.hs4Candidates,
      40,
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
        methodology: "AI HS4 scope; official CN8 retrieval; CLASS/BTI verification pending",
      };
    }

    const ranking = await rankOfficialEuCnCandidates(data, analysis, officialCandidates);
    const rankedCandidates = ranking.selectedCodes
      .map((code) => officialCandidates.find((candidate) => candidate.code === code))
      .filter((candidate): candidate is (typeof officialCandidates)[number] => Boolean(candidate));

    if (ranking.abstain || rankedCandidates.length === 0) {
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
        missingInformation: analysis.missingInformation,
        followUpQuestions: analysis.followUpQuestions,
        warnings: [...ranking.rationaleKo, "공식 CN 후보 범위 안에서도 현재 정보만으로 방어 가능한 shortlist를 만들지 않았습니다."],
        methodology: "AI HS4 scope; official CN8 retrieval; constrained candidate ranking; abstained",
      };
    }

    const evidenceByCode = new Map(
      await Promise.all(
        rankedCandidates.map(async (candidate) => [
          candidate.code,
          await findEuClassificationEvidence(candidate.code),
        ] as const),
      ),
    );

    return {
      status: "candidate",
      normalizedProduct: {
        name: analysis.normalizedName,
        material: analysis.material,
        composition: analysis.composition,
        intendedUse: analysis.intendedUse,
        form: analysis.form,
      },
      candidates: rankedCandidates.map((candidate) => ({
        hs6: candidate.code.slice(0, 6),
        heading: `${candidate.code} — ${candidate.description}`,
        rationale: [
          ...ranking.rationaleKo,
          `후보 코드는 공식 ${candidate.sourceVersion} 데이터에서 조회되었습니다.`,
          `AI가 제안한 HS4 범위(${analysis.hs4Candidates.join(", ")}) 안에서 공식 CN8을 조회했습니다.`,
          "현재 단계에서는 후보 간 확률을 계산하지 않습니다. CLASS/BTI 검증 전에는 확정 분류가 아닙니다.",
        ],
        confidence: 0,
        sourceStatus: "officially_verified",
        evidence: [
          {
            type: "CN",
            title: `EU Combined Nomenclature ${candidate.sourceVersion}`,
            url: candidate.sourceUrl,
            status: "matched",
            note: `${candidate.code}가 현재 Logisight에 적재된 공식 CN 데이터에 존재함을 확인했습니다.`,
          },
          ...(evidenceByCode.get(candidate.code) ?? []).map((item) => ({
            type: item.sourceType === "EBTI" ? "EBTI" as const : "CLASS" as const,
            title: item.title,
            url: item.sourceUrl,
            status: "matched" as const,
            note: [
              item.decisionDate ? `결정일 ${item.decisionDate}.` : "",
              item.productDescription ?? "",
              item.decisionSummary ?? "",
              item.legalBasis ? `법적 근거: ${item.legalBasis}` : "",
            ].filter(Boolean).join(" "),
          })),
          ...((evidenceByCode.get(candidate.code) ?? []).some((item) => item.sourceType !== "EBTI") ? [] : [{
            type: "CLASS" as const,
            title: "EU Classification Information System (CLASS)",
            url: "https://webgate.ec.europa.eu/class-public-ui-web/",
            status: "manual_lookup_required" as const,
            note: `${candidate.code} 관련 저장된 CLASS 근거가 아직 없습니다. 공식 CLASS에서 추가 확인이 필요합니다.`,
          }]),
          ...((evidenceByCode.get(candidate.code) ?? []).some((item) => item.sourceType === "EBTI") ? [] : [{
            type: "EBTI" as const,
            title: "European Binding Tariff Information (EBTI)",
            url: "https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_home.jsp",
            status: "manual_lookup_required" as const,
            note: `${candidate.code}와 매칭된 저장 BTI 결정례가 아직 없습니다. 사례 부재 자체는 분류 반대 근거가 아닙니다.`,
          }]),
        ],
      })),
      missingInformation: analysis.missingInformation,
      followUpQuestions: analysis.followUpQuestions,
      warnings: [
        ...(analysis.missingInformation.length > 0
          ? ["분류에 영향을 줄 수 있는 정보가 일부 부족합니다. 아래 추가질문에 답하면 후보를 더 좁힐 수 있습니다."]
          : []),
        "officially_verified는 코드가 공식 CN 데이터에 존재한다는 의미이며, 해당 상품의 최종 세관 분류가 확정됐다는 뜻은 아닙니다.",
        "CN 코드 존재 여부는 공식 데이터로 확인했습니다. CLASS/EBTI의 상품별 결정례는 별도 공식 근거 확인이 필요합니다.",
      ],
      methodology: "AI HS4 scope; official CN8 retrieval; constrained candidate ranking; CLASS/BTI verification pending",
    };
  });
