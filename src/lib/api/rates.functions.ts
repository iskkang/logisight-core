import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type {
  FreightIndexHistoryRow,
  FreightRateRow,
  BunkerPriceRow,
  RateFilterOptions,
} from "./rates";

const CODES = [
  "SCFI",
  "FBX",
  "KCCI",
  "CCFI",
  "NYFI:ASIA-USWC",
  "NYFI:ASIA-USEC",
  "NYFI:ASIA-NEUR",
  "NYFI:TRANS-ATLANTIC_WESTBOUND",
  "NYFI:TRANS-ATLANTIC_EASTBOUND",
] as const;

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