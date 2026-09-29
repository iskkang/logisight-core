import { supabasePublicServer } from "@/integrations/supabase/public.server";

export type EuCustomsMeasure = {
  measureType: "THIRD_COUNTRY_DUTY" | "PREFERENCE" | "VAT" | "REQUIREMENT" | "REGULATION";
  ratePercent: number | null; rateText: string | null; title: string; detail: string | null;
  legalBasis: string | null; sourceUrl: string;
};

export async function findEuCustomsMeasures(cnCode:string,originCountry:string,destinationCountry?:string) {
  const code=cnCode.replace(/\D/g,"").slice(0,8);
  if(!/^\d{8}$/.test(code)) return [];
  const prefixes=[code,code.slice(0,6),code.slice(0,4)];
  const {data,error}=await supabasePublicServer.from("eu_customs_measures")
    .select("cn_code,measure_type,rate_percent,rate_text,title,detail,legal_basis,source_url,origin_country,destination_country")
    .in("cn_code",prefixes).eq("is_active",true)
    .or(`origin_country.is.null,origin_country.eq.${originCountry}`).limit(100);
  if(error) throw new Error(`EU customs measures lookup failed: ${error.message}`);
  const rows=(data??[]).filter(row=>!destinationCountry||!row.destination_country||row.destination_country===destinationCountry);
  // Exact CN8 beats inherited CN6/CN4. Origin-specific preference beats generic
  // rows at the same code depth. This prevents a heading-level fallback from
  // masking an available 2026 CN8 conventional duty.
  rows.sort((a,b)=>(b.cn_code?.length??0)-(a.cn_code?.length??0)+
    (b.origin_country===originCountry?1:0)-(a.origin_country===originCountry?1:0));
  return rows.map(row=>({measureType:row.measure_type,ratePercent:row.rate_percent==null?null:Number(row.rate_percent),rateText:row.rate_text,title:row.title,detail:row.detail,legalBasis:row.legal_basis,sourceUrl:row.source_url})) as EuCustomsMeasure[];
}
