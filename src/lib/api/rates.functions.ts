import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { percentile52wSeries, normalRange52w, type FreightIndexPoint } from "@/server/signals";
import type {
  FreightIndexHistoryRow,
  FreightRateRow,
  BunkerPriceRow,
  RateFilterOptions,
  KitaAirRateRow,
  KitaSeaRateRow,
  KitaPercentileResult,
  IndexStats,
} from "./rates";

const CODES = ["SCFI", "FBX", "KCCI", "CCFI"] as const;

export const getFreightIndicesHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<FreightIndexHistoryRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date,source,source_url")
      .in("index_code", CODES as unknown as string[])
      .order("week_date", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as FreightIndexHistoryRow[];
  },
);

export const getRateFilterOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<RateFilterOptions> => {
    const { data, error } = await supabasePublicServer
      .from("freight_rates")
      .select("pol_code,pol_name,pod_code,pod_name,container_type")
      .limit(5000);
    if (error) throw new Error(error.message);

    const polMap = new Map<string, string>();
    const podMap = new Map<string, string>();
    const ctypeSet = new Set<string>();
    for (const r of data ?? []) {
      if (r.pol_code) polMap.set(r.pol_code, r.pol_name ?? r.pol_code);
      if (r.pod_code) podMap.set(r.pod_code, r.pod_name ?? r.pod_code);
      if (r.container_type) ctypeSet.add(r.container_type);
    }
    return {
      pols: [...polMap.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "ko")),
      pods: [...podMap.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "ko")),
      containerTypes: [...ctypeSet].sort(),
    };
  },
);

export const getFreightRates = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      polCode: z.string().min(1).max(20).optional(),
      podCode: z.string().min(1).max(20).optional(),
      containerType: z.string().min(1).max(20).optional(),
      limit: z.number().int().min(1).max(200).default(80),
    }),
  )
  .handler(async ({ data }): Promise<FreightRateRow[]> => {
    let q = supabasePublicServer
      .from("freight_rates")
      .select(
        "id,carrier,pol_code,pol_name,pod_code,pod_name,container_type,rate_usd,currency,weekly_change_pct,is_partner_rate,transit_days,valid_from,valid_until,data_source,source_updated_at,display_order",
      )
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("rate_usd", { ascending: true, nullsFirst: false })
      .limit(data.limit);
    if (data.polCode) q = q.eq("pol_code", data.polCode);
    if (data.podCode) q = q.eq("pod_code", data.podCode);
    if (data.containerType) q = q.eq("container_type", data.containerType);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as FreightRateRow[];
  });

export const getKitaAirRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<KitaAirRateRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("kita_air_rates")
      .select("origin,dest,region,year_mon,kg100,kg300,kg500,chg100,chg300,chg500")
      .order("year_mon", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as KitaAirRateRow[];
  },
);

export const getKitaSeaRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<KitaSeaRateRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("kita_sea_rates")
      .select("origin,dest,region,year_mon,teu,feu,teu_chg,feu_chg")
      .order("year_mon", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as KitaSeaRateRow[];
  },
);

// 52-week percentile and normal range (mean ±1σ) — computed server-side, never on missing data
export const getKitaAirPercentile = createServerFn({ method: "GET" })
  .inputValidator(z.object({ origin: z.string(), dest: z.string(), tier: z.enum(["kg100", "kg300", "kg500"]) }))
  .handler(async ({ data }): Promise<KitaPercentileResult | null> => {
    const { data: rows, error } = await supabasePublicServer
      .from("kita_air_rates")
      .select("year_mon,kg100,kg300,kg500")
      .eq("origin", data.origin)
      .eq("dest", data.dest)
      .order("year_mon", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);
    if (!rows || rows.length < 4) return null;

    const values = rows
      .map((r) => (r[data.tier] as number | null))
      .filter((v): v is number => v !== null);
    if (values.length < 4) return null;

    const latest = values[values.length - 1];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const sigma = Math.sqrt(variance);
    const pct = Math.round((values.filter((v) => v <= latest).length / values.length) * 100);
    const asOf = rows[rows.length - 1].year_mon;

    return { pct52w: pct, normalLow: mean - sigma, normalHigh: mean + sigma, asOf };
  });

const INDEX_CODES = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"] as const;

export const getIndexStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<IndexStats[]> => {
    const { data, error } = await supabasePublicServer
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date,source")
      .in("index_code", INDEX_CODES as unknown as string[])
      .order("week_date", { ascending: true })
      .limit(10000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as (FreightIndexPoint & { index_code: string; source: string | null })[];

    const grouped = new Map<string, (FreightIndexPoint & { source: string | null })[]>();
    for (const r of rows) {
      const arr = grouped.get(r.index_code) ?? [];
      arr.push(r);
      grouped.set(r.index_code, arr);
    }

    return INDEX_CODES.map((code) => {
      const series = grouped.get(code) ?? [];
      const last = series.at(-1);
      if (!last || last.value === null) {
        return { index_code: code, latest_value: null, latest_date: null, change_pct: null, mom_pct: null, yoy_pct: null, pct_52w: null, normal_range: null, source: null };
      }

      const lastDate = new Date(last.week_date).getTime();
      const monthAgo = series
        .filter((p) => p.value !== null && new Date(p.week_date).getTime() <= lastDate - 28 * 86400000)
        .at(-1);
      const yearAgo = series
        .filter((p) => p.value !== null && new Date(p.week_date).getTime() <= lastDate - 365 * 86400000)
        .at(-1);

      const mom_pct =
        monthAgo?.value && last.value
          ? Math.round(((last.value - monthAgo.value) / monthAgo.value) * 1000) / 10
          : null;
      const yoy_pct =
        yearAgo?.value && last.value
          ? Math.round(((last.value - yearAgo.value) / yearAgo.value) * 1000) / 10
          : null;

      const pct_52w = percentile52wSeries(series, last.value);
      const normal_range = normalRange52w(series);

      return {
        index_code: code,
        latest_value: last.value,
        latest_date: last.week_date,
        change_pct: last.change_pct,
        mom_pct,
        yoy_pct,
        pct_52w,
        normal_range,
        source: last.source,
      };
    });
  },
);

export const getBunkerPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<BunkerPriceRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("bunker_prices")
      .select("grade,port,price_usd,obs_date,source,source_url")
      .order("obs_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const latest = new Map<string, BunkerPriceRow>();
    for (const r of (data ?? []) as BunkerPriceRow[]) {
      const k = `${r.grade}__${r.port}`;
      if (!latest.has(k)) latest.set(k, r);
    }
    return [...latest.values()].sort((a, b) =>
      a.port === b.port ? a.grade.localeCompare(b.grade) : a.port.localeCompare(b.port),
    );
  },
);