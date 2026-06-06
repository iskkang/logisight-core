import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { Forecast } from "./forecasts";

const SELECT =
  "id,module,statement,basis,impact_note,horizon_date,confidence,invalidation_condition,status,outcome,outcome_note,metric_ref,created_at,published_at,resolved_at";

async function serviceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// Public read — only published/resolved (RLS also enforces this).
export const getPublishedForecasts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Forecast[]> => {
    const { data, error } = await supabasePublicServer
      .from("forecasts")
      .select(SELECT)
      .in("status", ["published", "resolved"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as Forecast[];
  },
);

const DraftSchema = z.object({
  id: z.string().uuid().optional(),
  module: z.enum(["rates", "eurasia", "trade", "policy"]),
  statement: z.string().min(1).max(4000),
  basis: z.array(z.string()).nullable().optional(),
  impact_note: z.string().max(4000).nullable().optional(),
  horizon_date: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
  invalidation_condition: z.string().max(1000).nullable().optional(),
  metric_ref: z.string().max(200).nullable().optional(),
});

// Create or edit a DRAFT. The DB trigger blocks edits once a row is published.
export const saveForecastDraft = createServerFn({ method: "POST" })
  .inputValidator(DraftSchema)
  .handler(async ({ data }) => {
    const sb = await serviceClient();
    const { id, ...fields } = data;
    if (id) {
      const { error } = await sb.from("forecasts").update(fields).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("forecasts").insert(fields);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const publishForecast = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const sb = await serviceClient();
    const { error } = await sb
      .from("forecasts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveForecast = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      outcome: z.enum(["hit", "partial", "miss"]),
      outcome_note: z.string().max(4000).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.outcome !== "hit" && !data.outcome_note?.trim()) {
      throw new Error("miss·partial 판정에는 복기(outcome_note)가 필수입니다.");
    }
    const sb = await serviceClient();
    const { error } = await sb
      .from("forecasts")
      .update({
        status: "resolved",
        outcome: data.outcome,
        outcome_note: data.outcome_note ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
