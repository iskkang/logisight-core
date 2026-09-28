import { supabasePublicServer } from "@/integrations/supabase/public.server";

export type EuProductRegulation = { title:string; detail:string; url:string; category:string; legalBasis:string|null };

export async function findEuProductRegulations(cnCode:string, productText:string):Promise<EuProductRegulation[]> {
  const prefixes=[cnCode,cnCode.slice(0,6),cnCode.slice(0,4),cnCode.slice(0,2)];
  const {data,error}=await supabasePublicServer.from("eu_product_regulations")
    .select("cn_prefix,category,title,detail,legal_basis,source_url,condition_keywords")
    .in("cn_prefix",prefixes).eq("is_active",true).limit(50);
  if(error) throw new Error(`EU product regulations lookup failed: ${error.message}`);
  const hay=productText.toLowerCase();
  return (data??[]).filter(row=>{
    const kw=(row.condition_keywords??[]) as string[];
    return !kw.length || kw.some(k=>hay.includes(String(k).toLowerCase()));
  }).sort((a,b)=>b.cn_prefix.length-a.cn_prefix.length)
    .map(row=>({title:row.title,detail:row.detail,url:row.source_url,category:row.category,legalBasis:row.legal_basis}));
}
