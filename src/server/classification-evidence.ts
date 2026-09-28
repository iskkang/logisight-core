import { supabasePublicServer } from "@/integrations/supabase/public.server";

export type StoredClassificationEvidence = {
  sourceType: "CLASS" | "EBTI" | "CN_EXPLANATORY_NOTE" | "CLASSIFICATION_REGULATION" | "CCC_CONCLUSION" | "CJEU";
  sourceId: string | null;
  title: string;
  sourceUrl: string;
  productDescription: string | null;
  decisionSummary: string | null;
  legalBasis: string | null;
  decisionDate: string | null;
};

export async function findEuClassificationEvidence(cnCode: string): Promise<StoredClassificationEvidence[]> {
  const prefixes = [cnCode, cnCode.slice(0, 6), cnCode.slice(0, 4)];
  const { data, error } = await supabasePublicServer
    .from("customs_classification_evidence")
    .select("source_type,source_id,title,source_url,product_description,decision_summary,legal_basis,decision_date")
    .eq("market", "EU")
    .eq("is_active", true)
    .in("cn_code", prefixes)
    .order("decision_date", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) throw new Error(`Classification evidence lookup failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    sourceUrl: row.source_url,
    productDescription: row.product_description,
    decisionSummary: row.decision_summary,
    legalBasis: row.legal_basis,
    decisionDate: row.decision_date,
  }));
}
