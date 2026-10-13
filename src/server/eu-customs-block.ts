import type { HsClassificationInput, HsClassificationResult } from "@/server/hs-classification";
import { findEuCustomsMeasures } from "@/server/eu-customs-measures";
import { findEuProductRegulations } from "@/server/eu-product-regulations";
import { getEuStandardVat } from "@/server/eu-vat";
import { assessKrEuOrigin } from "@/server/eu-origin-assessment";

type EuCustomsBlock = NonNullable<HsClassificationResult["customs"]>;

/**
 * CN8 코드 하나에 대한 관세·FTA 원산지·수입 규제·관세포함원가를 만든다.
 *
 * 분류 경로(설명 → LLM)와 코드 직접 조회 경로가 같은 계산을 쓰게 하려고 뺐다 ★
 * 이 파이프라인은 한 번 두 벌로 갈라진 적이 있고, 그 탓에 정확도 측정이 이용자가
 * 실제로 받는 코드가 아닌 복제본을 재고 있었다. 같은 일을 반복하지 않는다.
 *
 * isCosmetic 을 인자로 받는 이유: 분류 경로는 AI 가 제안한 HS4 범위에 3304 가
 * 들어 있는지로 판단하고, 코드 경로는 코드 자체가 3304 로 시작하는지로 판단한다.
 * 여기서 코드만 보고 정하면 분류 경로의 동작이 바뀐다.
 */
export async function buildEuCustomsBlock(
  cnCode: string,
  data: HsClassificationInput,
  productEvidenceText: string,
  isCosmetic: boolean,
): Promise<EuCustomsBlock> {
  const customsMeasures = await findEuCustomsMeasures(cnCode, data.originCountry);
  const thirdCountryDuty = customsMeasures.find((item) => item.measureType === "THIRD_COUNTRY_DUTY");
  const preference = customsMeasures.find((item) => item.measureType === "PREFERENCE");
  const storedRegulations = customsMeasures.filter((item) => item.measureType === "REQUIREMENT" || item.measureType === "REGULATION");
  const productRegulations = await findEuProductRegulations(cnCode, productEvidenceText);
  const regulationItems = [
    ...storedRegulations.map((item) => ({ title: item.title, detail: item.detail ?? item.legalBasis ?? "", url: item.sourceUrl })),
    ...productRegulations.map((item) => ({ title: item.title, detail: item.detail, url: item.url })),
    ...(isCosmetic ? [
      { title: "EU Cosmetics Regulation (EC) No 1223/2009", detail: "EU 시장에 출시되는 완제품 화장품의 기본 규제 프레임워크입니다. Responsible Person, 안전성 평가 등 제품 요건 확인이 필요합니다.", url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/legislation_en" },
      { title: "Cosmetic Products Notification Portal (CPNP)", detail: "EU 시장 출시 전 Responsible Person 등이 Regulation 1223/2009 Article 13에 따라 제품 정보를 CPNP에 통지해야 합니다.", url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-product-notification-portal_en" },
      { title: "CosIng / ingredient restrictions", detail: "전성분(INCI)을 기준으로 금지·제한 성분, 색소·보존제·UV filter 및 기타 성분 요건을 별도로 확인해야 합니다.", url: "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosing_en" },
    ] : []),
  ];

  const originAssessment = await assessKrEuOrigin(cnCode, data);
  const canApplyPreference = data.preferentialOriginEligible === true && originAssessment.status === "qualified";
  const appliedDutyRate = canApplyPreference && preference?.ratePercent != null ? preference.ratePercent : thirdCountryDuty?.ratePercent ?? null;
  const destinationVatRate = data.vatRate ?? getEuStandardVat(data.destinationCountry);
  const customsValue = data.productValue != null ? data.productValue + (data.freight ?? 0) + (data.insurance ?? 0) : null;
  const dutyAmount = customsValue != null && appliedDutyRate != null ? customsValue * appliedDutyRate / 100 : null;
  const importCosts = data.importCosts ?? 0;
  const vatAmount = customsValue != null && dutyAmount != null && destinationVatRate != null ? (customsValue + dutyAmount + importCosts) * destinationVatRate / 100 : null;
  const estimatedTotal = customsValue != null && dutyAmount != null && vatAmount != null ? customsValue + dutyAmount + importCosts + vatAmount : null;

  return {

        duty: {
          status: thirdCountryDuty || preference ? "available" : "pending",
          thirdCountryRate: thirdCountryDuty?.ratePercent ?? null,
          // 종량세·복합세율이면 ratePercent 가 null 이다(13% + 5.3 EUR/100kg 를 13% 로
          // 적으면 관세를 적게 계산해 주게 되므로 수집기가 일부러 비워 둔다). 원문은
          // 아래 notes 에도 들어가지만, 머리줄이 "—" 로만 보여 모르는 것처럼 읽혔다.
          // 기본관세 9,670건 중 1,362건(14%)이 여기에 해당한다.
          thirdCountryRateText: thirdCountryDuty?.rateText ?? null,
          preferentialRate: preference?.ratePercent ?? null,
          preferentialRateText: preference?.rateText ?? null,
          notes: thirdCountryDuty || preference
            ? [
                ...customsMeasures.filter((item) => item.measureType === "THIRD_COUNTRY_DUTY" || item.measureType === "PREFERENCE").map((item) => item.rateText ? `${item.title}: ${item.rateText}` : item.title),
                ...(preference ? ["FTA 특혜세율은 한-EU FTA 원산지 규정을 충족하고 유효한 원산지 신고가 있는 경우에만 적용됩니다."] : []),
                ...(!preference && thirdCountryDuty?.ratePercent === 0 ? ["EU 기본관세 자체가 0%이므로 이 품목은 FTA 특혜세율을 적용하지 않아도 관세가 0%입니다."] : []),
              ]
            : ["공식 TARIC 관세 레코드가 아직 적재되지 않았습니다. 수치를 추정하지 않습니다.", "한국산 FTA 세율은 원산지 규정 충족 여부를 확인한 뒤 적용해야 합니다."],
          sources: customsMeasures.filter((item) => item.measureType === "THIRD_COUNTRY_DUTY" || item.measureType === "PREFERENCE").map((item) => item.sourceUrl),
        },
        regulation: { status: regulationItems.length > 0 ? "guidance" : "pending", items: regulationItems },
        originAssessment,
        landedCost: {
          status: estimatedTotal != null ? "ready" : "needs_values",
          formula: "상품가 + 운임 + 보험료 + 관세 + 수입부대비용 + 수입 VAT",
          missingInputs: [
            ...(data.productValue == null ? ["상품가격"] : []),
            ...(data.destinationCountry == null ? ["EU 도착국"] : []),
            ...(destinationVatRate == null ? ["도착국 VAT율"] : []),
            ...(appliedDutyRate == null ? ["적용 관세율/FTA 세율"] : []),
          ],
          customsValue,
          dutyAmount,
          vatAmount,
          importCosts,
          estimatedTotal,
        },
  };
}
