import { createServerFn } from "@tanstack/react-start";

import {
  buildInsufficientInformationResult,
  hsClassificationInputSchema,
  type HsClassificationResult,
} from "@/server/hs-classification";
import { analyzeProductForEuCn, rankOfficialEuCnCandidates } from "@/server/openai-hs";
import { searchOfficialEuNomenclatureByHeadings } from "@/server/customs-nomenclature";
import { findEuClassificationEvidence } from "@/server/classification-evidence";
import { findEuCustomsMeasures } from "@/server/eu-customs-measures";

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

    const customsMeasures = await findEuCustomsMeasures(rankedCandidates[0].code, data.originCountry);
    const thirdCountryDuty = customsMeasures.find((item) => item.measureType === "THIRD_COUNTRY_DUTY");
    const preference = customsMeasures.find((item) => item.measureType === "PREFERENCE");
    const storedRegulations = customsMeasures.filter((item) => item.measureType === "REQUIREMENT" || item.measureType === "REGULATION");
    const isCosmetic = analysis.hs4Candidates.includes("3304");
    const regulationItems = [
      ...storedRegulations.map((item) => ({ title: item.title, detail: item.detail ?? item.legalBasis ?? "", url: item.sourceUrl })),
      ...(isCosmetic ? [
        { title: "EU Cosmetics Regulation (EC) No 1223/2009", detail: "EU 시장에 출시되는 완제품 화장품의 기본 규제 프레임워크입니다. Responsible Person, 안전성 평가 등 제품 요건 확인이 필요합니다.", url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/legislation_en" },
        { title: "Cosmetic Products Notification Portal (CPNP)", detail: "EU 시장 출시 전 Responsible Person 등이 Regulation 1223/2009 Article 13에 따라 제품 정보를 CPNP에 통지해야 합니다.", url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-product-notification-portal_en" },
        { title: "CosIng / ingredient restrictions", detail: "전성분(INCI)을 기준으로 금지·제한 성분, 색소·보존제·UV filter 및 기타 성분 요건을 별도로 확인해야 합니다.", url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosing_en" },
      ] : []),
    ];

    const appliedDutyRate = preference?.ratePercent ?? thirdCountryDuty?.ratePercent ?? null;
    const customsValue = data.productValue != null ? data.productValue + (data.freight ?? 0) + (data.insurance ?? 0) : null;
    const dutyAmount = customsValue != null && appliedDutyRate != null ? customsValue * appliedDutyRate / 100 : null;
    const vatAmount = customsValue != null && dutyAmount != null && data.vatRate != null ? (customsValue + dutyAmount) * data.vatRate / 100 : null;
    const estimatedTotal = customsValue != null && dutyAmount != null && vatAmount != null ? customsValue + dutyAmount + vatAmount : null;

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
      customs: {
        duty: {
          status: thirdCountryDuty || preference ? "available" : "pending",
          thirdCountryRate: thirdCountryDuty?.ratePercent ?? null,
          preferentialRate: preference?.ratePercent ?? null,
          notes: thirdCountryDuty || preference
            ? customsMeasures.filter((item) => item.measureType === "THIRD_COUNTRY_DUTY" || item.measureType === "PREFERENCE").map((item) => item.rateText ? `${item.title}: ${item.rateText}` : item.title)
            : ["공식 TARIC/Access2Markets 관세 레코드가 아직 적재되지 않았습니다. 수치를 추정하지 않습니다."],
          sources: customsMeasures.filter((item) => item.measureType === "THIRD_COUNTRY_DUTY" || item.measureType === "PREFERENCE").map((item) => item.sourceUrl),
        },
        regulation: { status: regulationItems.length > 0 ? "guidance" : "pending", items: regulationItems },
        landedCost: {
          status: estimatedTotal != null ? "ready" : "needs_values",
          formula: "관세평가액(상품가+운임+보험료) + 관세 + 수입 VAT",
          missingInputs: [
            ...(data.productValue == null ? ["상품가격"] : []),
            ...(data.destinationCountry == null ? ["EU 도착국"] : []),
            ...(data.vatRate == null ? ["도착국 VAT율"] : []),
            ...(appliedDutyRate == null ? ["적용 관세율/FTA 세율"] : []),
          ],
          customsValue,
          dutyAmount,
          vatAmount,
          estimatedTotal,
        },
      },
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
