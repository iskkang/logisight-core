import { supabasePublicServer } from "@/integrations/supabase/public.server";

export type EuCustomsMeasure = {
  measureType: "THIRD_COUNTRY_DUTY" | "PREFERENCE" | "VAT" | "REQUIREMENT" | "REGULATION";
  ratePercent: number | null;
  rateText: string | null;
  title: string;
  detail: string | null;
  legalBasis: string | null;
  sourceUrl: string;
};

export async function findEuCustomsMeasures(cnCode: string, originCountry: string, destinationCountry?: string) {
  const prefixes = [cnCode, cnCode.slice(0, 6), cnCode.slice(0, 4)];
  const { data, error } = await supabasePublicServer
    .from("eu_customs_measures")
    .select("measure_type,rate_percent,rate_text,title,detail,legal_basis,source_url,origin_country,destination_country")
    .in("cn_code", prefixes)
    .eq("is_active", true)
    .or(`origin_country.is.null,origin_country.eq.${originCountry}`)
    .limit(50);
  if (error) throw new Error(`EU customs measures lookup failed: ${error.message}`);
  return (data ?? []).filter((row) => !destinationCountry || !row.destination_country || row.destination_country === destinationCountry).map((row) => ({
    measureType: row.measure_type,
    ratePercent: row.rate_percent == null ? null : Number(row.rate_percent),
    rateText: row.rate_text,
    title: row.title,
    detail: row.detail,
    legalBasis: row.legal_basis,
    sourceUrl: row.source_url,
  })) as EuCustomsMeasure[];
}
