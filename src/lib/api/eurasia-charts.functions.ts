import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

// index1520(ERAI) 차트 스냅샷 — 파이프라인이 eurasia_charts(jsonb)에 적재, 프론트는 이 테이블만 읽는다.
export type ChartDataset = {
  label: string;
  borderColor: string;
  hidden: boolean;
  data: (number | null)[];
};
export type LabelInfo = { month: string; year: string; full: string; lite: string };
export type ChartSection = {
  labels: { month: string[]; week: string[] };
  datasets: { month: ChartDataset[]; week: ChartDataset[] };
  labelsInfo: { month: LabelInfo[]; week: unknown[] };
  toggles: boolean[];
};
export type IndexQuotes = { indexes: ChartSection; times: ChartSection; speeds: ChartSection };
export type GeoItem = {
  id: string;
  countrySet: "cn" | "eu";
  name: string;
  TEU: string;
  rank: number;
  previousTEU: string;
  relativeTEU: number;
};
export type GeoPayload = {
  data: GeoItem[];
  interval: { minMaxInterval: string; minDate: string; maxDate: string };
};
export type EurasiaCharts = {
  indexQuotes: IndexQuotes | null;
  geo: GeoPayload | null;
  updatedAt: string | null;
};

export const getEurasiaCharts = createServerFn({ method: "GET" }).handler(
  async (): Promise<EurasiaCharts> => {
    setResponseHeader(
      "cache-control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    // eurasia_charts는 생성 타입에 없으므로 캐스팅해서 읽는다.
    const sb = supabasePublicServer as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (col: string, vals: string[]) => Promise<{ data: { key: string; payload: unknown; updated_at: string }[] | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await sb.from("eurasia_charts").select("key,payload,updated_at").in("key", ["index_quotes", "geo"]);
    if (error) throw new Error(error.message);
    const byKey = new Map((data ?? []).map((r) => [r.key, r]));
    const iq = byKey.get("index_quotes");
    const geo = byKey.get("geo");
    return {
      indexQuotes: (iq?.payload as IndexQuotes) ?? null,
      geo: (geo?.payload as GeoPayload) ?? null,
      updatedAt: iq?.updated_at ?? geo?.updated_at ?? null,
    };
  },
);
