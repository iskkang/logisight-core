import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { Forecast } from "./forecasts";

// "*" so new scoring columns (direction/composite/factor_scores/…) flow through when present,
// and the query never 400s if the scoring migration hasn't been applied yet (resilient).
const SELECT = "*";

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
    // impact_note(화주 영향)는 영업 토킹포인트 자산 — 공개 페이로드에서 제거(admin 카드에서만 노출).
    return ((data ?? []) as Forecast[]).map((f) => ({ ...f, impact_note: null }));
  },
);

export type SeriesPoint = { date: string; value: number };
export type ForecastSeries = {
  points: SeriesPoint[]; // 발행 이전 이력(오름차순)
  actuals: SeriesPoint[]; // 발행 이후 도착한 실측(오름차순) — 콘 위에 겹쳐 그림
  published_at: string | null;
  horizon_date: string | null;
};

// metric_ref → 소스 테이블 매핑(서버 내부에서만 — 임의 테이블 조회 인젝션 차단).
function parseMetricRef(ref: string | null) {
  if (ref && ref.startsWith("kita_sea_rates:")) {
    const lane = ref.slice("kita_sea_rates:".length);
    const i = lane.indexOf("-"); // 첫 하이픈에서 origin/dest 분리(dest에 하이픈 가능)
    return { kind: "kita" as const, origin: i >= 0 ? lane.slice(0, i) : lane, dest: i >= 0 ? lane.slice(i + 1) : "" };
  }
  return { kind: "index" as const, code: ref ?? "" };
}
const ymToDate = (ym: string) => `${String(ym).slice(0, 4)}-${String(ym).slice(4, 6)}-01`;

type SeriesRow = { id: string; metric_ref: string | null; cadence: string | null; published_at: string | null; horizon_date: string | null };

async function fetchSeries(
  sb: Awaited<ReturnType<typeof serviceClient>>,
  f: SeriesRow,
): Promise<ForecastSeries> {
  const m = parseMetricRef(f.metric_ref);
  const limit = f.cadence === "monthly" ? 6 : 12; // 월간 4~6 / 주간 8~12
  let raw: SeriesPoint[] = [];
  if (m.kind === "index") {
    const { data } = await sb
      .from("freight_indices")
      .select("value,week_date")
      .eq("index_code", m.code)
      .order("week_date", { ascending: false })
      .limit(limit);
    raw = (data ?? [])
      .filter((r: { value: number | null }) => r.value != null)
      .map((r: { value: number; week_date: string }) => ({ date: r.week_date, value: Number(r.value) }));
  } else {
    const { data } = await sb
      .from("kita_sea_rates")
      .select("feu,year_mon")
      .eq("origin", m.origin)
      .eq("dest", m.dest)
      .order("year_mon", { ascending: false })
      .limit(limit);
    raw = (data ?? [])
      .filter((r: { feu: number | null }) => r.feu != null)
      .map((r: { feu: number; year_mon: string }) => ({ date: ymToDate(r.year_mon), value: Number(r.feu) }));
  }
  raw.sort((a, b) => a.date.localeCompare(b.date)); // 오름차순
  const pub = f.published_at ? String(f.published_at).slice(0, 10) : null;
  const points = pub ? raw.filter((p) => p.date <= pub) : raw;
  const actuals = pub ? raw.filter((p) => p.date > pub) : [];
  return { points, actuals, published_at: f.published_at, horizon_date: f.horizon_date };
}

export type RiskNote = { id: string; note: string; week_start: string | null; created_at: string };
export type DataUpdate = { dataset: string; updated_at: string | null };

// 리스크 노트 — 최신순. 마이그레이션 미적용 시 graceful([])로 페이지 비파손.
export const getRiskNotes = createServerFn({ method: "GET" }).handler(async (): Promise<RiskNote[]> => {
  const sb = await serviceClient();
  const { data, error } = await sb
    .from("risk_notes")
    .select("id,note,week_start,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return [];
  return (data ?? []) as RiskNote[];
});

// 주요 데이터 출처 — data_updates의 dataset별 최신, 최근 4개.
export const getRecentDataUpdates = createServerFn({ method: "GET" }).handler(async (): Promise<DataUpdate[]> => {
  const sb = await serviceClient();
  const { data, error } = await sb
    .from("data_updates")
    .select("dataset,updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return [];
  const seen = new Set<string>();
  const out: DataUpdate[] = [];
  for (const r of (data ?? []) as DataUpdate[]) {
    if (r.dataset && !seen.has(r.dataset)) { seen.add(r.dataset); out.push(r); }
    if (out.length >= 4) break;
  }
  return out;
});

// 공개 페이지는 전 방문자 동일 → published/resolved 전체 시계열을 단일 배치로(워터폴 금지, loader prefetch).
export const getForecastSeriesBatch = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, ForecastSeries>> => {
    const sb = await serviceClient();
    const { data: rows, error } = await sb
      .from("forecasts")
      .select("id,metric_ref,cadence,published_at,horizon_date")
      .in("status", ["published", "resolved"])
      .limit(100);
    if (error) throw new Error(error.message);
    const out: Record<string, ForecastSeries> = {};
    await Promise.all(((rows ?? []) as SeriesRow[]).map(async (f) => { out[f.id] = await fetchSeries(sb, f); }));
    return out;
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

// Add/replace the retrospective (복기) on an already-resolved forecast — for rows the
// auto-adjudicator confirmed as miss/partial without a note ("복기 작성 중"). The DB
// immutability trigger permits outcome_note changes post-publish.
export const annotateForecast = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ id: z.string().uuid(), outcome_note: z.string().min(1).max(4000) }),
  )
  .handler(async ({ data }) => {
    const sb = await serviceClient();
    const { error } = await sb
      .from("forecasts")
      .update({ outcome_note: data.outcome_note.trim() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
