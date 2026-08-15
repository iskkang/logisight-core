import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ws from "ws";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { EurasiaDisruptionRow } from "./eurasia-disruptions";
import { requireAdmin } from "./require-admin";

export const getEurasiaDisruptionsActive = createServerFn({ method: "GET" }).handler(
  async (): Promise<EurasiaDisruptionRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("eurasia_disruptions")
      .select(
        "id,lane_id,segment,title,severity,delay_contribution_days,status,started_at,resolved_at,source,confidence,created_at",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as EurasiaDisruptionRow[];
  },
);

const DisruptionSchema = z.object({
  token: z.string(),
  id: z.string().optional(),
  lane_id: z.string().min(1).max(120).nullable().optional(),
  segment: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  severity: z.enum(["high", "medium", "low"]),
  delay_contribution_days: z.number().min(0).max(365).nullable().optional(),
  started_at: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
});

export const upsertEurasiaDisruption = createServerFn({ method: "POST" })
  .inputValidator(DisruptionSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      {
        auth: { persistSession: false },
        realtime: { transport: ws },
      },
    );
    // token 은 인가용 입력이지 컬럼이 아니다.
    const { token: _token, ...fields } = data;
    const { error } = await supabase
      .from("eurasia_disruptions")
      .upsert({ ...fields, status: "active" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveEurasiaDisruption = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), id: z.string().uuid(), resolved_at: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      {
        auth: { persistSession: false },
        realtime: { transport: ws },
      },
    );
    const { error } = await supabase
      .from("eurasia_disruptions")
      .update({ status: "resolved", resolved_at: data.resolved_at })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
