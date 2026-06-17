import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { RatesBriefRow } from "./rates-brief";

export const getLatestRatesBrief = createServerFn({ method: "GET" }).handler(
  async (): Promise<RatesBriefRow | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabasePublicServer as any)
      .from("rates_brief")
      .select("week_id, as_of, signals_json, prose_json, generated_at")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error((error as { message: string }).message);
    return (data as RatesBriefRow) ?? null;
  },
);
