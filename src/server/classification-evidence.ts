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

function evidenceTokens(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(/\s+/).filter((token) => token.length >= 3));
}

function evidenceSimilarity(productText: string, evidenceText: string) {
  const product = evidenceTokens(productText);
  const evidence = evidenceTokens(evidenceText);
  if (!product.size || !evidence.size) return 0;
  let matches = 0;
  for (const token of product) if (evidence.has(token)) matches += 1;
  return matches / Math.min(product.size, evidence.size);
}

export async function findEuClassificationEvidence(cnCode: string, productText = ""): Promise<StoredClassificationEvidence[]> {
  const prefixes = [cnCode, cnCode.slice(0, 6), cnCode.slice(0, 4)];
  const { data, error } = await supabasePublicServer
    .from("customs_classification_evidence")
    .select("source_type,source_id,title,source_url,product_description,decision_summary,legal_basis,decision_date")
    .eq("market", "EU")
    .eq("is_active", true)
    // Quarantine the first consolidated-PDF import: row boundaries were parsed incorrectly.
    .neq("source_version", "2026-02-11")
    .in("cn_code", prefixes)
    .order("decision_date", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) throw new Error(`Classification evidence lookup failed: ${error.message}`);
  const rank: Record<string, number> = { CLASSIFICATION_REGULATION: 1, CJEU: 2, CCC_CONCLUSION: 3, CN_EXPLANATORY_NOTE: 4, EBTI: 5, CLASS: 6 };
  const relevant = (data ?? []).filter((row) => {
    if (!productText.trim()) return false;
    const evidenceText = [row.product_description, row.decision_summary, row.legal_basis].filter(Boolean).join(" ");
    const score = evidenceSimilarity(productText, evidenceText);
    if (row.source_type === "EBTI" || row.source_type === "CLASS") return score >= 0.18;
    return score >= 0.28;
  });
  return relevant.sort((a,b) => (rank[a.source_type] ?? 99) - (rank[b.source_type] ?? 99)).map((row) => ({
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
