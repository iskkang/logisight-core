import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ws from "ws";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { PolicyRow } from "./policies";

export const getPolicies = createServerFn({ method: "GET" }).handler(
  async (): Promise<PolicyRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("policies")
      .select(
        "id,title_ko,title_en,country_code,region,policy_type,effective_date,expiry_date,severity,status,summary_ko,summary_en,affected_hs_chapters,source_url,last_verified_at,created_at,updated_at",
      )
      .eq("status", "active")
      .order("effective_date", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as PolicyRow[];
  },
);

const PolicySchema = z.object({
  id: z.string().uuid().optional(),
  title_ko: z.string().min(1).max(500),
  title_en: z.string().nullable().optional(),
  country_code: z.string().max(3).nullable().optional(),
  region: z.string().nullable().optional(),
  policy_type: z.string().min(1).max(100),
  effective_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  severity: z.enum(["high", "medium", "low", "info"]),
  status: z.enum(["active", "expired", "draft"]).optional(),
  summary_ko: z.string().nullable().optional(),
  affected_hs_chapters: z.array(z.string()).nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  last_verified_at: z.string().nullable().optional(),
});

export const upsertPolicy = createServerFn({ method: "POST" })
  .inputValidator(PolicySchema)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      {
        auth: { persistSession: false },
        realtime: { transport: ws },
      },
    );
    const { error } = await supabase.from("policies").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
