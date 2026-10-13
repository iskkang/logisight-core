import type { SupabaseClient } from "@supabase/supabase-js";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

// customs_product_regulations 는 생성된 Database 타입에 없다(다른 customs_* 표와
// 같은 상황). types.ts 를 다시 생성하면 들어온다.
const sb = supabasePublicServer as unknown as SupabaseClient;

export type UsProductRegulation = {
  title: string;
  detail: string;
  url: string;
  category: string;
  legalBasis: string | null;
};

/**
 * 미국 수입 규제(PGA) "해당 가능성" 조회.
 *
 * 세번 단위 PGA 플래그의 권위 있는 원본은 ACE REF-003 이고 계정이 있어야 받는다.
 * 공개된 기계판독 배포처는 찾지 못했고, HTS 데이터 자체에도 기관 정보가 거의
 * 없다(FDA 1건·EPA 3건). 그래서 류 단위 수기 시드로 "해당 가능성"을 알리고
 * 공식 링크로 보낸다 —— EU 쪽도 자동 수집기가 아니라 수기 17행이다.
 *
 * 세액처럼 틀리면 손해가 나는 값이 아니라, 모르고 지나치는 것이 손해인 영역이라
 * 이 수준이 실제로 쓸모 있다.
 */
export async function findUsProductRegulations(
  htsCode: string,
  productText: string,
): Promise<UsProductRegulation[]> {
  const code = htsCode.replace(/[^0-9]/g, "");
  const prefixes = [code, code.slice(0, 8), code.slice(0, 6), code.slice(0, 4), code.slice(0, 2)].filter(
    (value) => value.length >= 2,
  );
  const { data, error } = await sb
    .from("customs_product_regulations")
    .select("code_prefix,agency,category,title,detail,legal_basis,source_url,condition_keywords")
    .eq("market", "US")
    .eq("is_active", true)
    .in("code_prefix", [...new Set(prefixes)])
    .limit(50);
  if (error) throw new Error(`US product regulations lookup failed: ${error.message}`);

  const hay = productText.toLowerCase();
  return ((data ?? []) as {
    code_prefix: string;
    agency: string;
    category: string;
    title: string;
    detail: string;
    legal_basis: string | null;
    source_url: string;
    condition_keywords: string[] | null;
  }[])
    // 조건 낱말이 있으면 제품 설명에 그 말이 있을 때만 보여준다. 코드만 넣은
    // 조회에서는 설명이 공식 품명뿐이라 일부가 걸러진다 —— 결과 warnings 에
    // 그 사실을 적어 둔다.
    .filter((row) => !row.condition_keywords?.length || row.condition_keywords.some((k) => hay.includes(String(k).toLowerCase())))
    .sort((a, b) => b.code_prefix.length - a.code_prefix.length)
    .map((row) => ({
      title: `[${row.agency}] ${row.title}`,
      detail: row.detail,
      url: row.source_url,
      category: row.category,
      legalBasis: row.legal_basis,
    }));
}
