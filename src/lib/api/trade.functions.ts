import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

// 관세청 통계는 월 단위로만 갱신된다 → CDN(s-maxage)에서 1시간 캐시하고, 만료 후에도 24시간
// 동안은 stale 응답을 즉시 주면서 백그라운드 갱신(stale-while-revalidate)한다. 결과적으로
// 첫 1회(또는 갱신 직후)만 원본을 치고, 나머지 방문자는 sub-second 로 받는다.
const TRADE_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
import type {
  TradeProvisionalRow,
  TradeCountryRow,
  TradeItemRow,
  TradeStatRow,
  TradeStatisticsBundle,
} from "./trade";

const TRADE_SELECT =
  "id,period,priod_dt,direction,stat_type,hs_code,hs_name,country_code,country_name,export_usd,export_weight,import_usd,import_weight,trade_balance,data_source,fetched_at";

function periodKey(period: string | null | undefined): string {
  return (period ?? "").replace(/\D/g, "").slice(0, 6);
}

function latestPeriod(rows: Pick<TradeStatRow, "period">[]): string | null {
  return [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))]
    .sort()
    .at(-1) ?? null;
}

async function fetchPagedByType(statType: string, maxRows: number): Promise<TradeStatRow[]> {
  const all: TradeStatRow[] = [];
  let from = 0;
  const pageSize = 1000;
  while (from < maxRows) {
    const { data, error } = await supabasePublicServer
      .from("trade_statistics")
      .select(TRADE_SELECT)
      .eq("stat_type", statType)
      .order("period", { ascending: false })
      .range(from, Math.min(from + pageSize - 1, maxRows - 1));
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TradeStatRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// 최신 기간만 직접 조회. 기존 fetchLatestRowsByType은 전 기간(최대 maxRows)을 1000행씩
// 순차 페이징해 받은 뒤 최신 1개월만 남겨, item(최대 30k행·~30회 왕복)에서 큰 지연을 냈다.
// 대신 ① period 컬럼만 받아(가벼움) 최신 정규화 기간을 구하고 ② 그 기간 행만 가져온다 →
// 왕복 수·전송량이 모두 급감한다. (period 포맷 "202606"·"2026-06" 혼재는 정규화로 흡수.)
async function fetchLatestPeriodRows(statType: string, maxRows: number): Promise<TradeStatRow[]> {
  const { data: periodRows, error: periodError } = await supabasePublicServer
    .from("trade_statistics")
    .select("period")
    .eq("stat_type", statType)
    .order("period", { ascending: false })
    .limit(1000);
  if (periodError) throw new Error(periodError.message);

  let maxKey = "";
  const rawByKey = new Map<string, Set<string>>();
  for (const row of (periodRows ?? []) as { period: string }[]) {
    const key = periodKey(row.period);
    if (!key) continue;
    if (key > maxKey) maxKey = key;
    if (!rawByKey.has(key)) rawByKey.set(key, new Set());
    rawByKey.get(key)!.add(row.period);
  }
  if (!maxKey) return [];
  const rawPeriods = [...(rawByKey.get(maxKey) ?? [])];

  const all: TradeStatRow[] = [];
  let from = 0;
  const pageSize = 1000;
  while (from < maxRows) {
    const { data, error } = await supabasePublicServer
      .from("trade_statistics")
      .select(TRADE_SELECT)
      .eq("stat_type", statType)
      .in("period", rawPeriods)
      .range(from, Math.min(from + pageSize - 1, maxRows - 1));
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TradeStatRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchTopRows(statType: string, column: "export_usd" | "import_usd", maxRows: number): Promise<TradeStatRow[]> {
  const { data, error } = await supabasePublicServer
    .from("trade_statistics")
    .select(TRADE_SELECT)
    .eq("stat_type", statType)
    .not(column, "is", null)
    .order("period", { ascending: false })
    .order(column, { ascending: false })
    .limit(maxRows);
  if (error) throw new Error(error.message);
  return (data ?? []) as TradeStatRow[];
}

function uniqueRows(rows: TradeStatRow[]): TradeStatRow[] {
  const seen = new Set<string>();
  const unique: TradeStatRow[] = [];
  for (const row of rows) {
    const key =
      row.id ??
      [row.stat_type, row.period, row.priod_dt, row.country_code, row.hs_code, row.direction].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

export const getTradeProvisional = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeProvisionalRow[]> => {
    const all: TradeProvisionalRow[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabasePublicServer
        .from("trade_statistics")
        .select(
          "period,priod_dt,stat_type,country_code,country_name,export_usd,import_usd,trade_balance",
        )
        .in("stat_type", ["provisional_exp", "provisional_imp"])
        .order("period", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TradeProvisionalRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 10000) break;
    }
    return all;
  },
);

export const getTradeByCountry = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeCountryRow[]> => {
    const all: TradeCountryRow[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabasePublicServer
        .from("trade_statistics")
        .select(
          "period,country_code,country_name,export_usd,import_usd,trade_balance",
        )
        .eq("stat_type", "country")
        .order("period", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TradeCountryRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 20000) break;
    }
    return all;
  },
);
export const getTradeByItem = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeItemRow[]> => {
    const all: TradeItemRow[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabasePublicServer
        .from("trade_statistics")
        .select(
          "period,hs_code,hs_name,export_usd,export_weight,import_usd,import_weight,country_code,country_name",
        )
        .eq("stat_type", "item")
        .order("period", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TradeItemRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 20000) break;
    }
    return all;
  },
);

// item 행을 HS 코드별로 합산(국가 차원 제거). 화면의 buildItemAgg가 어차피 hs_code로
// 그룹·합산하므로 결과는 동일하고, 전송 페이로드만 급감한다(HS×국가 ~수만 행 → HS ~수백 행).
function aggregateItemsByHs(rows: TradeStatRow[]): TradeStatRow[] {
  const byHs = new Map<string, TradeStatRow>();
  for (const row of rows) {
    const hs = row.hs_code ?? "미분류";
    const cur = byHs.get(hs);
    if (cur) {
      cur.export_usd = (cur.export_usd ?? 0) + (row.export_usd ?? 0);
      cur.import_usd = (cur.import_usd ?? 0) + (row.import_usd ?? 0);
      cur.export_weight = (cur.export_weight ?? 0) + (row.export_weight ?? 0);
      cur.import_weight = (cur.import_weight ?? 0) + (row.import_weight ?? 0);
    } else {
      byHs.set(hs, { ...row, country_code: null, country_name: null, trade_balance: null });
    }
  }
  return [...byHs.values()];
}

export const getTradeStatisticsBundle = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeStatisticsBundle> => {
    setResponseHeader("cache-control", TRADE_CACHE_CONTROL);
    const [country, provisional, continent, item, itemCountryExport, itemCountryImport, newnatureExport, newnatureImport] =
      await Promise.all([
        fetchPagedByType("country", 5000),
        fetchPagedByType("provisional_exp", 2000).then(async (exp) => [
          ...exp,
          ...(await fetchPagedByType("provisional_imp", 2000)),
        ]),
        fetchLatestPeriodRows("continent", 2000),
        fetchLatestPeriodRows("item", 30000),
        fetchTopRows("item_country", "export_usd", 1200),
        fetchTopRows("item_country", "import_usd", 1200),
        fetchTopRows("newnature", "export_usd", 800),
        fetchTopRows("newnature", "import_usd", 800),
      ]);

    const latestItemCountry = latestPeriod([...itemCountryExport, ...itemCountryImport]);
    const latestNewnature = latestPeriod([...newnatureExport, ...newnatureImport]);

    return {
      country,
      provisional,
      continent,
      item: aggregateItemsByHs(item),
      itemCountry: uniqueRows([...itemCountryExport, ...itemCountryImport]).filter(
        (row) => !latestItemCountry || periodKey(row.period) === latestItemCountry,
      ),
      newnature: uniqueRows([...newnatureExport, ...newnatureImport]).filter(
        (row) => !latestNewnature || periodKey(row.period) === latestNewnature,
      ),
    };
  },
);
