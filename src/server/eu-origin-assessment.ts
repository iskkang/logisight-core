import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { HsClassificationInput } from "@/server/hs-classification";

export type OriginAssessmentStatus = "qualified" | "not_qualified" | "needs_information" | "rule_unavailable";

export type OriginAssessment = {
  status: OriginAssessmentStatus;
  ruleCode: string | null;
  ruleTextKo: string | null;
  sourceUrl: string | null;
  checks: string[];
  missingInputs: string[];
};

type RuleRow = {
  hs_prefix: string;
  rule_code: string;
  rule_text_ko: string;
  rule_json: any;
  source_url: string;
  metadata?: any;
};

async function findRule(cnCode: string): Promise<RuleRow | null> {
  const { data: cross, error: crossError } = await supabasePublicServer
    .from("eu_hs_crosswalk")
    .select("hs2007_code,mapping_type,source_url")
    .eq("cn2026_code",cnCode)
    .eq("is_active",true);
  if (crossError) throw new Error("HS crosswalk lookup failed: " + crossError.message);

  const mappedHs6=[...new Set((cross ?? []).map((x:any)=>x.hs2007_code).filter(Boolean))] as string[];
  const mappedPrefixes=[...new Set(mappedHs6.flatMap(x=>[x,x.slice(0,4),x.slice(0,2)]))];
  const currentPrefixes=[cnCode.slice(0,8),cnCode.slice(0,6),cnCode.slice(0,4),cnCode.slice(0,2)];
  const prefixes=[...new Set([...mappedPrefixes,...currentPrefixes])];
  if (!prefixes.length) return null;

  const { data, error } = await supabasePublicServer
    .from("eu_origin_rules")
    .select("hs_prefix,rule_code,rule_text_ko,rule_json,source_url,metadata")
    .eq("agreement","KR-EU FTA")
    .eq("is_active",true)
    .in("hs_prefix",prefixes);
  if (error) throw new Error("Origin-rule lookup failed: " + error.message);
  const rows=(data ?? []) as RuleRow[];

  const generated=rows.filter(r=>r.metadata?.source==="KCS FTA Portal HS2007 PSR" && mappedHs6.includes(r.hs_prefix));
  if (generated.length) {
    const signatures=[...new Set(generated.map(r=>JSON.stringify(r.rule_json)))];
    if (signatures.length===1) {
      return generated[0];
    }
    return {
      hs_prefix: mappedHs6.join(","),
      rule_code: "PSR_VARIANTS",
      rule_text_ko: "현재 HS2022 코드가 복수의 HS2007 코드 또는 복수의 세부 품목규칙과 연결됩니다. 제품 세부 사양을 기준으로 적용 규칙을 추가 확인해야 합니다.",
      rule_json: {type:"TEXT_RULE"},
      source_url: generated[0].source_url,
      metadata: {source:"KCS FTA Portal HS2007 PSR", variants:generated.map(r=>({hs:r.hs_prefix,item:r.metadata?.item_ko,rule:r.rule_text_ko}))},
    };
  }

  const manual=rows.filter(r=>r.metadata?.source!=="KCS FTA Portal HS2007 PSR");
  return manual.sort((a,b)=>b.hs_prefix.length-a.hs_prefix.length)[0] ?? null;
}
function evalNode(node:any, input:HsClassificationInput, finalHs6:string): {pass:boolean|null; checks:string[]; missing:string[]} {
  if (!node || typeof node!=="object") return {pass:null,checks:[],missing:["원산지 판정 규칙"]};
  if (node.type==="FABRIC_FORWARD") {
    const missing:string[]=[];
    if (input.originManufacturedInKr == null) missing.push("한국 최종생산 여부");
    if (input.originFabricOriginating == null) missing.push("투입 원단의 한-EU FTA 원산지 지위");
    if (input.originSufficientProcessing == null) missing.push("한국 내 충분가공 여부");
    if (missing.length) return {pass:null,checks:[],missing};
    const checks=[
      "한국 최종생산: " + (input.originManufacturedInKr ? "예" : "아니오"),
      "FTA 원산지 원단: " + (input.originFabricOriginating ? "예" : "아니오"),
      "충분가공: " + (input.originSufficientProcessing ? "예" : "아니오"),
    ];
    return {pass:Boolean(input.originManufacturedInKr && input.originFabricOriginating && input.originSufficientProcessing),checks,missing:[]};
  }
  if (node.type==="TEXTILE_CH61") {
    const missing:string[]=[];
    if (input.originKnittingInKr == null) missing.push("한국 내 편직 여부");
    if (input.originSpinningOrExtrusionInKr == null) missing.push("한국 내 방적 또는 인조필라멘트사 압출 여부");
    if (input.originMakingUpInKr == null) missing.push("한국 내 재단·봉제·조립(making-up) 여부");
    if (missing.length) return {pass:null,checks:[],missing};
    const routeA=Boolean(input.originSpinningOrExtrusionInKr && input.originKnittingInKr);
    const routeB=Boolean(input.originKnittingInKr && input.originMakingUpInKr);
    return {pass:routeA||routeB,checks:[
      "경로 A(방적/압출 + 편직): " + (routeA ? "충족" : "불충족"),
      "경로 B(편직 + 재단·봉제·조립): " + (routeB ? "충족" : "불충족"),
    ],missing:[]};
  }
  if (node.type==="TEXT_RULE") {
    return {pass:null,checks:[],missing:["이 품목의 공식 PSR은 복합 규칙이므로 세부 공정·재료 조건 확인"]};
  }
  if (node.type==="WO") {
    if (input.originWhollyObtained == null) return {pass:null,checks:[],missing:["완전생산 여부"]};
    return {pass:input.originWhollyObtained,checks:["완전생산: " + (input.originWhollyObtained ? "예" : "아니오")],missing:[]};
  }
  if (node.type==="CC") {
    const hs=input.originNonOriginatingMaterialHs4;
    if (!hs?.length) return {pass:null,checks:[],missing:["비원산지 원재료 HS4 목록"]};
    const finalChapter=finalHs6.slice(0,2);
    const bad=hs.filter(x=>x.slice(0,2)===finalChapter);
    return {pass:bad.length===0,checks:[bad.length ? "완제품과 같은 류(HS2)의 비원산지재료 존재: " + bad.join(", ") : "모든 비원산지재료가 완제품과 다른 류"],missing:[]};
  }
  if (node.type==="CTSH") {
    const hs=input.originNonOriginatingMaterialHs6;
    if (!hs?.length) return {pass:null,checks:[],missing:["비원산지 원재료 HS6 목록"]};
    const bad=hs.filter(x=>x===finalHs6);
    return {pass:bad.length===0,checks:[bad.length ? "완제품과 같은 HS6 비원산지재료 존재: " + bad.join(", ") : "모든 비원산지재료가 완제품과 다른 HS6"],missing:[]};
  }
  if (node.type==="CTH") {
    const hs=input.originNonOriginatingMaterialHs4;
    if (!hs?.length) return {pass:null,checks:[],missing:["비원산지 원재료 HS4 목록"]};
    const bad=hs.filter(x=>x===finalHs6.slice(0,4));
    return {pass:bad.length===0,checks:[bad.length ? "완제품과 같은 HS4 비원산지재료 존재: " + bad.join(", ") : "모든 비원산지재료가 완제품과 다른 HS4"],missing:[]};
  }
  if (node.type==="MC") {
    if (input.originExWorksPrice == null || input.originNonOriginatingMaterialValue == null)
      return {pass:null,checks:[],missing:["공장도가격","비원산지재료 가격"]};
    if (input.originExWorksPrice<=0) return {pass:null,checks:[],missing:["유효한 공장도가격"]};
    const pct=input.originNonOriginatingMaterialValue/input.originExWorksPrice*100;
    return {pass:pct<=Number(node.maxPercent),checks:["비원산지재료 비율 " + pct.toFixed(2) + "% ≤ " + node.maxPercent + "%"],missing:[]};
  }
  if (node.type==="RVC") {
    // 역내부가가치. 한-미 FTA 에만 있다(한-EU 는 MC = 비원산지 재료 최대 비율로
    // 계산 방향이 반대다). 공제법은 우리가 받는 입력으로 계산되지만, 집적법은
    // 원산지재료 가격이 필요해 지금 입력 항목에 없다 —— 없는 걸 있는 척하지 않는다.
    const down=node.buildDownPercent==null?null:Number(node.buildDownPercent);
    if (down==null) return {pass:null,checks:[],missing:["집적법 기준 원산지재료 가격(현재 입력 항목 없음)"]};
    if (input.originExWorksPrice == null || input.originNonOriginatingMaterialValue == null)
      return {pass:null,checks:[],missing:["조정가격(공장도가격)","비원산지재료 가격"]};
    if (input.originExWorksPrice<=0) return {pass:null,checks:[],missing:["유효한 조정가격"]};
    const rvc=(input.originExWorksPrice-input.originNonOriginatingMaterialValue)/input.originExWorksPrice*100;
    return {pass:rvc>=down,checks:["역내부가가치(공제법) " + rvc.toFixed(2) + "% ≥ " + down + "%"],missing:[]};
  }
  if (node.type==="AND" && Array.isArray(node.rules)) {
    const results=node.rules.map((r:any)=>evalNode(r,input,finalHs6));
    if (results.some(x=>x.pass===false)) return {pass:false,checks:results.flatMap(x=>x.checks),missing:[]};
    if (results.every(x=>x.pass===true)) return {pass:true,checks:results.flatMap(x=>x.checks),missing:[]};
    return {pass:null,checks:results.flatMap(x=>x.checks),missing:[...new Set(results.flatMap(x=>x.missing))]};
  }
  if (node.type==="OR" && Array.isArray(node.rules)) {
    const results=node.rules.map((r:any)=>evalNode(r,input,finalHs6));
    if (results.some(x=>x.pass===true)) return {pass:true,checks:results.flatMap(x=>x.checks),missing:[]};
    if (results.every(x=>x.pass===false)) return {pass:false,checks:results.flatMap(x=>x.checks),missing:[]};
    return {pass:null,checks:results.flatMap(x=>x.checks),missing:[...new Set(results.flatMap(x=>x.missing))]};
  }
  return {pass:null,checks:[],missing:["지원되지 않는 원산지 규칙 유형"]};
}

/**
 * 한-미 FTA 원산지 판정.
 *
 * 한-EU 와 달리 HS 버전 크로스워크가 없다 —— 관세청 포털에서 받은 KORUS PSR 의
 * HS6 가 현행 미국 HTS 에 그대로 있다(표본 50개 전수 확인). 그래서 입력 코드의
 * 접두사로 바로 찾는다.
 *
 * 규칙 평가는 한-EU 와 같은 evalNode 를 쓴다. 유형이 겹치고(CC·CTH·CTSH·WO·
 * OR·AND) 한-미에만 있는 RVC 는 evalNode 에 분기를 더해 뒀다.
 */
export async function assessKrUsOrigin(htsCode:string,input:HsClassificationInput): Promise<OriginAssessment> {
  const hs6=htsCode.replace(/[^0-9]/g,"").slice(0,6);
  if (hs6.length<6) return {status:"rule_unavailable",ruleCode:null,ruleTextKo:null,sourceUrl:null,checks:[],missingInputs:["6자리 이상의 HS 코드"]};
  const prefixes=[hs6,hs6.slice(0,4),hs6.slice(0,2)];
  // eu_origin_rules 는 생성된 Database 타입에 없다(이 파일의 한-EU 쪽도 같은
  // 상황이라 에러가 남아 있다). 새로 더하는 코드까지 늘리지 않도록 좁혀 쓴다.
  const sb = supabasePublicServer as unknown as SupabaseClient;
  const { data, error } = await sb
    .from("eu_origin_rules")
    .select("hs_prefix,rule_code,rule_text_ko,rule_json,source_url,metadata")
    .eq("agreement","KR-US FTA")
    .eq("is_active",true)
    .in("hs_prefix",prefixes);
  if (error) throw new Error("KORUS origin-rule lookup failed: " + error.message);
  const rows=(data ?? []) as RuleRow[];
  if (!rows.length) return {status:"rule_unavailable",ruleCode:null,ruleTextKo:null,sourceUrl:null,checks:[],missingInputs:["해당 품목의 한-미 FTA PSR"]};
  // 가장 구체적인(긴) 접두사를 쓴다 —— HS6 규칙이 류 규칙을 이긴다.
  const rule=rows.sort((a,b)=>b.hs_prefix.length-a.hs_prefix.length)[0];
  const result=evalNode(rule.rule_json,input,hs6);
  return {
    status: result.pass===true ? "qualified" : result.pass===false ? "not_qualified" : "needs_information",
    ruleCode: rule.rule_code ?? null,
    ruleTextKo: rule.rule_text_ko ?? null,
    sourceUrl: rule.source_url ?? null,
    checks: result.checks,
    missingInputs: result.missing,
  };
}

export async function assessKrEuOrigin(cnCode:string,input:HsClassificationInput): Promise<OriginAssessment> {
  const rule=await findRule(cnCode);
  if (!rule) return {status:"rule_unavailable",ruleCode:null,ruleTextKo:null,sourceUrl:null,checks:[],missingInputs:["해당 품목의 구조화된 한-EU FTA PSR"]};
  const result=evalNode(rule.rule_json,input,cnCode.slice(0,6));
  return {
    status: result.pass===true?"qualified":result.pass===false?"not_qualified":"needs_information",
    ruleCode: rule.rule_code,
    ruleTextKo: rule.rule_text_ko,
    sourceUrl: rule.source_url,
    checks: result.checks,
    missingInputs: result.missing,
  };
}
