import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

// 유럽 복합운송 터미널 디렉터리 — scripts/fetch-cip-terminals.mjs 가 eu_rail_terminals 에 적재(CIP RNE 공개 데이터).
// /rail/eurasia '터미널' 탭에서 사용.
export type EuRailTerminal = {
  id: number;
  name: string;
  operator: string | null;
  type: string | null;
  corridors: string[];
  address: string | null;
  homePage: string | null;
  infoUrl: string | null;
};

type Row = {
  id: number;
  name: string;
  operator: string | null;
  type: string | null;
  corridors: string[] | null;
  address: string | null;
  home_page: string | null;
  info_url: string | null;
};

export const getEuRailTerminals = createServerFn({ method: "GET" }).handler(async (): Promise<EuRailTerminal[]> => {
  const sb = supabasePublicServer as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await sb
    .from("eu_rail_terminals")
    .select("id,name,operator,type,corridors,address,home_page,info_url")
    .order("name", { ascending: true });
  if (error) {
    // 마이그레이션 적용 전(테이블 부재)에는 빈 목록으로 graceful degrade — 그 외 에러는 throw.
    if (/schema cache|does not exist|could not find the table/i.test(error.message)) {
      setResponseHeader("cache-control", "no-store");
      return [];
    }
    throw new Error(error.message);
  }
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    operator: r.operator,
    type: r.type,
    corridors: Array.isArray(r.corridors) ? r.corridors : [],
    address: r.address,
    homePage: r.home_page,
    infoUrl: r.info_url,
  }));
  // 데이터가 있을 때만 CDN 캐시 — 빈 결과(테이블 미적재 시점)가 stale로 굳는 것을 방지.
  setResponseHeader(
    "cache-control",
    rows.length ? "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" : "no-store",
  );
  return rows;
});
