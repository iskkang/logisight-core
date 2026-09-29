import type { HsClassificationInput, HsClassificationResult } from "@/server/hs-classification";
import { analyzeProductForEuCn, rankOfficialEuCnCandidates } from "@/server/openai-hs";
import { searchOfficialEuNomenclatureByHeadings } from "@/server/customs-nomenclature";
import { findEuClassificationEvidence } from "@/server/classification-evidence";
import { findEuCustomsMeasures } from "@/server/eu-customs-measures";
import { getEuStandardVat } from "@/server/eu-vat";
import { findEuProductRegulations } from "@/server/eu-product-regulations";
import { assessKrEuOrigin } from "@/server/eu-origin-assessment";

export async function classifyHsProductCore(data: HsClassificationInput): Promise<HsClassificationResult> {
  const analysis = await analyzeProductForEuCn(data);
  const officialCandidates = await searchOfficialEuNomenclatureByHeadings(analysis.hs4Candidates,40);
  if(!officialCandidates.length) return {status:"needs_information",normalizedProduct:{name:analysis.normalizedName,material:analysis.material,composition:analysis.composition,intendedUse:analysis.intendedUse,form:analysis.form},candidates:[],missingInformation:["official_cn_candidate_not_found"],followUpQuestions:["제품의 주요 기능, 성분/재질, 형태를 더 구체적으로 입력해 주세요."],warnings:["공식 CN 데이터에서 확인되지 않은 코드는 생성하지 않았습니다."],methodology:"AI HS4 scope; official CN8 retrieval"};
  const ranking=await rankOfficialEuCnCandidates(data,analysis,officialCandidates);
  const ranked=ranking.selectedCodes.map(code=>officialCandidates.find(c=>c.code===code)).filter((x):x is NonNullable<typeof x>=>Boolean(x));
  if(ranking.abstain||!ranked.length) return {status:"needs_information",normalizedProduct:{name:analysis.normalizedName,material:analysis.material,composition:analysis.composition,intendedUse:analysis.intendedUse,form:analysis.form},candidates:[],missingInformation:analysis.missingInformation,followUpQuestions:analysis.followUpQuestions,warnings:[...ranking.rationaleKo,"공식 CN 후보 범위 안에서도 현재 정보만으로 shortlist를 만들지 않았습니다."],methodology:"AI HS4 scope; constrained ranking; abstained"};
  const productEvidenceText=[data.description,analysis.normalizedName,analysis.material,analysis.composition,analysis.intendedUse,analysis.form].filter(Boolean).join(" ");
  const evidence=new Map(await Promise.all(ranked.map(async c=>[c.code,await findEuClassificationEvidence(c.code,productEvidenceText)] as const)));
  const measures=await findEuCustomsMeasures(ranked[0].code,data.originCountry);
  const third=measures.find(x=>x.measureType==="THIRD_COUNTRY_DUTY"), pref=measures.find(x=>x.measureType==="PREFERENCE");
  const tariffRegs=measures.filter(x=>x.measureType==="REQUIREMENT"||x.measureType==="REGULATION").map(x=>({title:x.title,detail:x.detail??x.legalBasis??"",url:x.sourceUrl}));
  const productRegs=await findEuProductRegulations(ranked[0].code,[data.description,analysis.normalizedName,analysis.material,analysis.composition,analysis.intendedUse,analysis.form].filter(Boolean).join(" "));
  const regs=[...tariffRegs,...productRegs.map(x=>({title:x.title,detail:x.detail,url:x.url}))].filter((x,i,a)=>a.findIndex(y=>y.title===x.title)===i);
  const originAssessment=await assessKrEuOrigin(ranked[0].code,data);
  const canApplyPreference=data.preferentialOriginEligible===true&&originAssessment.status==="qualified";
  const rate=canApplyPreference&&pref?.ratePercent!=null?pref.ratePercent:third?.ratePercent??null, vat=data.vatRate??getEuStandardVat(data.destinationCountry);
  const cv=data.productValue!=null?data.productValue+(data.freight??0)+(data.insurance??0):null;
  const duty=cv!=null&&rate!=null?cv*rate/100:null;
  // Simplified EU import-VAT estimate: customs value + duty + user-supplied incidental/import costs.
  // Exact VAT base can vary by Member State and transaction facts.
  const importCosts=data.importCosts??0;
  const va=cv!=null&&duty!=null&&vat!=null?(cv+duty+importCosts)*vat/100:null;
  const total=cv!=null&&duty!=null&&va!=null?cv+duty+importCosts+va:null;
  return {status:"candidate",normalizedProduct:{name:analysis.normalizedName,material:analysis.material,composition:analysis.composition,intendedUse:analysis.intendedUse,form:analysis.form},
    candidates:ranked.map(c=>({hs6:c.code.slice(0,6),heading:`${c.code} — ${c.descriptionKo ?? "공식 CN 품목"}`,rationale:[...ranking.rationaleKo,`공식 ${c.sourceVersion} 데이터에서 조회`],confidence:0,sourceStatus:"officially_verified",evidence:[{type:"CN",title:`EU Combined Nomenclature ${c.sourceVersion}`,url:c.sourceUrl,status:"matched",note:`${c.code} 공식 CN 존재 확인`},...(evidence.get(c.code)??[]).map(x=>({type:x.sourceType==="EBTI"?"EBTI" as const:"CLASS" as const,title:x.title,url:x.sourceUrl,status:"matched" as const,note:[x.productDescription,x.decisionSummary,x.legalBasis].filter(Boolean).join(" ")}))]})),
    missingInformation:analysis.missingInformation,followUpQuestions:analysis.followUpQuestions,
    customs:{duty:{status:third||pref?"available":"pending",thirdCountryRate:third?.ratePercent??null,preferentialRate:pref?.ratePercent??null,notes:[],sources:measures.filter(x=>x.measureType==="THIRD_COUNTRY_DUTY"||x.measureType==="PREFERENCE").map(x=>x.sourceUrl)},regulation:{status:regs.length?"guidance":"pending",items:regs},originAssessment,landedCost:{status:total!=null?"ready":"needs_values",formula:"상품가 + 운임 + 보험료 + 관세 + 수입부대비용 + 수입 VAT",missingInputs:[...(data.productValue==null?["상품가격"]:[]),...(data.destinationCountry==null?["EU 도착국"]:[]),...(vat==null?["도착국 VAT율"]:[]),...(rate==null?["적용 관세율/FTA 세율"]:[])],customsValue:cv,dutyAmount:duty,vatAmount:va,importCosts,estimatedTotal:total}},
    warnings:["officially_verified는 CN 코드 존재 확인이며 최종 세관 분류 확정이 아닙니다."],methodology:"AI HS4; official CN8; constrained ranking; customs/evidence lookup"};
}
