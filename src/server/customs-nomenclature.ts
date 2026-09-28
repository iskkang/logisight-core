import { supabasePublicServer } from "@/integrations/supabase/public.server";

export type OfficialNomenclatureCandidate = {
  code: string;
  nomenclature: "HS" | "CN" | "TARIC";
  description: string;
  level: 2 | 4 | 6 | 8 | 10;
  sourceName: string;
  sourceUrl: string;
  sourceVersion: string;
};

function queryTerms(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3)
  )].slice(0, 8);
}

export async function searchOfficialEuNomenclature(
  productDescription: string,
  limit = 25,
): Promise<OfficialNomenclatureCandidate[]> {
  const terms = queryTerms(productDescription);
  if (terms.length === 0) return [];

  // Retrieval first, reasoning second: AI must never invent a code that is
  // absent from the versioned official nomenclature table.
  const orFilter = terms.map((term) => `description.ilike.%${term}%`).join(",");

  const { data, error } = await supabasePublicServer
    .from("customs_nomenclature")
    .select("code,nomenclature,description,level,source_name,source_url,source_version")
    .eq("market", "EU")
    .eq("is_active", true)
    .or(orFilter)
    .order("level", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Official nomenclature lookup failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    code: row.code,
    nomenclature: row.nomenclature as "HS" | "CN" | "TARIC",
    description: row.description,
    level: row.level as 2 | 4 | 6 | 8 | 10,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceVersion: row.source_version,
  }));
}


export async function searchOfficialEuNomenclatureByConcepts(
  concepts: string[],
  limit = 25,
): Promise<OfficialNomenclatureCandidate[]> {
  const terms = [...new Set(concepts.flatMap(queryTerms))].slice(0, 12);
  if (terms.length === 0) return [];
  const orFilter = terms.map((term) => `description.ilike.%${term}%`).join(",");
  const { data, error } = await supabasePublicServer
    .from("customs_nomenclature")
    .select("code,nomenclature,description,level,source_name,source_url,source_version")
    .eq("market", "EU")
    .eq("nomenclature", "CN")
    .eq("is_active", true)
    .eq("is_leaf", true)
    .or(orFilter)
    .order("code", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Official nomenclature lookup failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    code: row.code,
    nomenclature: row.nomenclature as "CN",
    description: row.description,
    level: row.level as 8,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceVersion: row.source_version,
  }));
}
