import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { ExchangeRateRow } from "./exchange-rates";

export const getLatestExchangeRate = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExchangeRateRow | null> => {
    const { data, error } = await supabasePublicServer
      .from("exchange_rates")
      .select("rate_date,usd_krw,eur_krw,cny_krw,source,fetched_at")
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as ExchangeRateRow | null;
  },
);

export const getExchangeRateHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExchangeRateRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("exchange_rates")
      .select("rate_date,usd_krw,eur_krw,cny_krw,source,fetched_at")
      .order("rate_date", { ascending: true })
      .limit(400);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ExchangeRateRow[];
  },
);
