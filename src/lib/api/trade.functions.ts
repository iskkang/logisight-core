import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
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

async function fetchLatestRowsByType(statType: string, maxRows: number): Promise<TradeStatRow[]> {
  const rows = await fetchPagedByType(statType, maxRows);
  const latest = latestPeriod(rows);
  if (!latest) return [];
  return rows.filter((row) => periodKey(row.period) === latest);
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

export const getTradeStatisticsBundle = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeStatisticsBundle> => {
    const [country, provisional, continent, item, itemCountryExport, itemCountryImport, newnatureExport, newnatureImport] =
      await Promise.all([
        fetchPagedByType("country", 5000),
        fetchPagedByType("provisional_exp", 2000).then(async (exp) => [
          ...exp,
          ...(await fetchPagedByType("provisional_imp", 2000)),
        ]),
        fetchLatestRowsByType("continent", 2000),
        fetchLatestRowsByType("item", 30000),
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
      item,
      itemCountry: uniqueRows([...itemCountryExport, ...itemCountryImport]).filter(
        (row) => !latestItemCountry || periodKey(row.period) === latestItemCountry,
      ),
      newnature: uniqueRows([...newnatureExport, ...newnatureImport]).filter(
        (row) => !latestNewnature || periodKey(row.period) === latestNewnature,
      ),
    };
  },
);
