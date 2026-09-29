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
    .select("hs2007_code,mapping_type")
    .eq("cn2026_code",cnCode)
    .eq("is_active",true)
    .maybeSingle();
  if (crossError) throw new Error("HS crosswalk lookup failed: " + crossError.message);

  const mapped = cross?.hs2007_code as string | null | undefined;
  const mappingType = cross?.mapping_type as string | undefined;
  const allowedLen = mappingType === "HS6_IDENTITY" ? 6 : mappingType === "HS4_FAMILY" ? 4 : mappingType === "CHAPTER_FAMILY" ? 2 : 0;

  const mappedPrefixes = mapped && allowedLen
    ? [mapped.slice(0,allowedLen), mapped.slice(0,4), mapped.slice(0,2)].filter((x,i,a)=>x && a.indexOf(x)===i)
    : [];
  const currentPrefixes = [cnCode.slice(0,8),cnCode.slice(0,6),cnCode.slice(0,4),cnCode.slice(0,2)];
  const prefixes = [...new Set([...currentPrefixes, ...mappedPrefixes])];

  const { data, error } = await supabasePublicServer
    .from("eu_origin_rules")
    .select("hs_prefix,rule_code,rule_text_ko,rule_json,source_url,metadata")
    .eq("agreement","KR-EU FTA")
    .eq("is_active",true)
    .in("hs_prefix",prefixes);
  if (error) throw new Error("Origin-rule lookup failed: " + error.message);
  const rows=(data ?? []) as RuleRow[];

  const usable = rows.filter(r => {
    if (!r.metadata?.source || r.metadata.source !== "EUR-Lex OJ L127/2011") return true;
    return mappedPrefixes.includes(r.hs_prefix);
  });

  return usable.sort((a,b)=>{
    const manualA = a.metadata?.source === "EUR-Lex OJ L127/2011" ? 0 : 1;
    const manualB = b.metadata?.source === "EUR-Lex OJ L127/2011" ? 0 : 1;
    return (b.hs_prefix.length-a.hs_prefix.length) || (manualB-manualA);
  })[0] ?? null;
}

function evalNode(node:any, input:HsClassificationInput, finalHs4:string): {pass:boolean|null; checks:string[]; missing:string[]} {
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
  if (node.type==="CTH") {
    const hs=input.originNonOriginatingMaterialHs4;
    if (!hs?.length) return {pass:null,checks:[],missing:["비원산지 원재료 HS4 목록"]};
    const bad=hs.filter(x=>x===finalHs4);
    return {pass:bad.length===0,checks:[bad.length ? "완제품과 같은 HS4 비원산지재료 존재: " + bad.join(", ") : "모든 비원산지재료가 완제품과 다른 HS4"],missing:[]};
  }
  if (node.type==="MC") {
    if (input.originExWorksPrice == null || input.originNonOriginatingMaterialValue == null)
      return {pass:null,checks:[],missing:["공장도가격","비원산지재료 가격"]};
    if (input.originExWorksPrice<=0) return {pass:null,checks:[],missing:["유효한 공장도가격"]};
    const pct=input.originNonOriginatingMaterialValue/input.originExWorksPrice*100;
    return {pass:pct<=Number(node.maxPercent),checks:["비원산지재료 비율 " + pct.toFixed(2) + "% ≤ " + node.maxPercent + "%"],missing:[]};
  }
  if (node.type==="OR" && Array.isArray(node.rules)) {
    const results=node.rules.map((r:any)=>evalNode(r,input,finalHs4));
    if (results.some(x=>x.pass===true)) return {pass:true,checks:results.flatMap(x=>x.checks),missing:[]};
    if (results.every(x=>x.pass===false)) return {pass:false,checks:results.flatMap(x=>x.checks),missing:[]};
    return {pass:null,checks:results.flatMap(x=>x.checks),missing:[...new Set(results.flatMap(x=>x.missing))]};
  }
  return {pass:null,checks:[],missing:["지원되지 않는 원산지 규칙 유형"]};
}

export async function assessKrEuOrigin(cnCode:string,input:HsClassificationInput): Promise<OriginAssessment> {
  const rule=await findRule(cnCode);
  if (!rule) return {status:"rule_unavailable",ruleCode:null,ruleTextKo:null,sourceUrl:null,checks:[],missingInputs:["해당 품목의 구조화된 한-EU FTA PSR"]};
  const result=evalNode(rule.rule_json,input,cnCode.slice(0,4));
  return {
    status: result.pass===true?"qualified":result.pass===false?"not_qualified":"needs_information",
    ruleCode: rule.rule_code,
    ruleTextKo: rule.rule_text_ko,
    sourceUrl: rule.source_url,
    checks: result.checks,
    missingInputs: result.missing,
  };
}
