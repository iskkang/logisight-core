import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { numUSD, parseTransit, normRouteType, isExpired } from "./partner-rates.normalize";

const ExtractInput = z.object({
  imageBase64: z.string(),
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export type ExtractedRow = {
  pol: string | null; pod: string | null; country: string | null;
  rate_20: string | null; rate_40: string | null;
  transit: string | null; route_type: string | null; via_port: string | null;
  carrier: string | null; remark: string | null;
};
export type ExtractedSheet = {
  sheet: { source: string | null; title: string | null; valid_until: string | null; notes: string | null };
  rows: ExtractedRow[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sheet: {
      type: "object", additionalProperties: false,
      properties: {
        source: { type: ["string", "null"] },
        title: { type: ["string", "null"] },
        valid_until: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: ["source", "title", "valid_until", "notes"],
    },
    rows: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          pol: { type: ["string", "null"] }, pod: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          rate_20: { type: ["string", "null"] }, rate_40: { type: ["string", "null"] },
          transit: { type: ["string", "null"] }, route_type: { type: ["string", "null"] },
          via_port: { type: ["string", "null"] }, carrier: { type: ["string", "null"] },
          remark: { type: ["string", "null"] },
        },
        required: ["pol", "pod", "country", "rate_20", "rate_40", "transit", "route_type", "via_port", "carrier", "remark"],
      },
    },
  },
  required: ["sheet", "rows"],
} as const;

const PROMPT = `이 이미지는 해상 FCL 운임표다. 모든 데이터 행을 추출하라.
- 숫자(rate_20/rate_40)는 표에 보이는 그대로의 문자열로(통화기호·콤마 포함 가능) 넣어라 — 정규화는 후처리한다.
- rate_40은 "40'/40HQ" 컬럼 값.
- transit은 표의 Transit Time을 그대로 문자열로(예 "14~18", "37").
- route_type은 ROUTE/REMARK의 DIRECT 또는 T/S 표기 그대로.
- pol(출발지), pod(도착지 항만, 영문 원문 그대로), country, carrier, via_port, remark도 채워라.
- sheet.valid_until은 "VALID TILL MM/DD/YYYY"를 YYYY-MM-DD로. sheet.notes는 하단 각주(AMS·FREETIME·국내부대비 등)를 한 문자열로.
- 보이지 않거나 불명확하면 null. 추정·창작 금지.`;

// 주의(서버측 인증): 이 레포의 admin 서버함수(policies/forecasts 등)는 모두 서버측 인증 검사가
// 없고 클라이언트 라우트 가드에만 의존한다. extractRateSheet은 유료 Anthropic 호출이라 비용 노출이
// 더 크다 — 외부 노출 환경에서는 호출자 세션 검증 추가를 후속 과제로 권장.
export const extractRateSheet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data }): Promise<ExtractedSheet> => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"]! });
    const req: any = {
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: data.mediaType, data: data.imageBase64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    };
    const msg = await client.messages.create(req);
    const block = msg.content.find((b: any) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("추출 실패: Claude 응답에 텍스트 블록이 없습니다(거부·빈 응답 가능).");
    }
    return JSON.parse(block.text) as ExtractedSheet;
  });

async function serviceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false },
  });
}

export const uploadRateImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ imageBase64: z.string(), ext: z.enum(["png", "jpg", "webp"]) }).parse(d))
  .handler(async ({ data }): Promise<{ path: string }> => {
    const sb = await serviceClient();
    const bytes = Buffer.from(data.imageBase64, "base64");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${data.ext}`;
    const { error } = await sb.storage.from("rate-sheets").upload(path, bytes, {
      contentType: data.ext === "jpg" ? "image/jpeg" : `image/${data.ext}`,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path };
  });

const SaveInput = z.object({
  sheet: z.object({
    source: z.string().nullable(), title: z.string().nullable(),
    valid_from: z.string().nullable(), valid_until: z.string().nullable(),
    image_path: z.string().nullable(), notes: z.string().nullable(),
    status: z.enum(["draft", "published"]),
  }),
  rows: z.array(z.object({
    pol: z.string().nullable(), pod: z.string().nullable(), country: z.string().nullable(),
    kita_dest: z.string().nullable(),
    rate_20: z.union([z.string(), z.number()]).nullable(),
    rate_40: z.union([z.string(), z.number()]).nullable(),
    transit: z.string().nullable(), route_type: z.string().nullable(),
    via_port: z.string().nullable(), carrier: z.string().nullable(), remark: z.string().nullable(),
  })),
});

export const saveRateSheet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data }): Promise<{ sheetId: string; rows: number }> => {
    // 비트랜잭션: rows insert 실패 시 sheet 행이 고아로 남을 수 있음(자식 0개). 단독 관리자·수동
    // 재시도 Phase 1에서는 수용. 빈도가 늘면 Postgres RPC로 묶을 것(후속 과제).
    const sb = await serviceClient();
    const { data: sheet, error: e1 } = await sb.from("rate_sheets").insert(data.sheet).select("id").single();
    if (e1) throw new Error(e1.message);
    const rows = data.rows.map((r, i) => {
      const t = parseTransit(r.transit);
      return {
        sheet_id: sheet.id, pol: r.pol, pod: r.pod, country: r.country, kita_dest: r.kita_dest,
        rate_20: numUSD(r.rate_20), rate_40: numUSD(r.rate_40),
        transit_min: t.min, transit_max: t.max,
        route_type: normRouteType(r.route_type), via_port: r.via_port,
        carrier: r.carrier, remark: r.remark, sort_order: i,
      };
    });
    const { error: e2 } = await sb.from("partner_rates").insert(rows);
    if (e2) throw new Error(e2.message);
    return { sheetId: sheet.id, rows: rows.length };
  });

export const listKitaDests = createServerFn({ method: "GET" }).handler(async (): Promise<string[]> => {
  const sb = await serviceClient();
  const { data, error } = await sb.from("kita_sea_rates").select("dest");
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r: { dest: string }) => r.dest))].sort((a, b) => a.localeCompare(b));
});

export const getPublishedPartnerRates = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: sheets, error } = await sb.from("rate_sheets")
    .select("id,source,title,valid_until,notes,status").eq("status", "published");
  if (error) throw new Error(error.message);
  const live = (sheets ?? []).filter((s: { valid_until: string | null }) => !isExpired(s.valid_until, today));
  if (live.length === 0) return [];
  const ids = live.map((s: { id: string }) => s.id);
  const { data: rows, error: e2 } = await sb.from("partner_rates").select("*").in("sheet_id", ids);
  if (e2) throw new Error(e2.message);
  const byId = new Map(live.map((s: { id: string }) => [s.id, s]));
  return (rows ?? []).map((r: { sheet_id: string }) => ({ ...r, sheet: byId.get(r.sheet_id) }));
});

export type RateSheetHistory = {
  id: string; source: string | null; title: string | null;
  valid_until: string | null; status: string; image_path: string | null;
  created_at: string; row_count: number;
};

// 업로드 이력(관리자 — draft·published 전부, 최신순)
export const listRateSheets = createServerFn({ method: "GET" }).handler(async (): Promise<RateSheetHistory[]> => {
  const sb = await serviceClient();
  const { data: sheets, error } = await sb.from("rate_sheets")
    .select("id,source,title,valid_until,status,image_path,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const list = (sheets ?? []) as Omit<RateSheetHistory, "row_count">[];
  if (list.length === 0) return [];
  const ids = list.map((s) => s.id);
  const { data: rows } = await sb.from("partner_rates").select("sheet_id").in("sheet_id", ids);
  const counts = new Map<string, number>();
  for (const r of (rows ?? []) as { sheet_id: string }[]) counts.set(r.sheet_id, (counts.get(r.sheet_id) ?? 0) + 1);
  return list.map((s) => ({ ...s, row_count: counts.get(s.id) ?? 0 }));
});

// 미리보기용 서명 URL(비공개 버킷)
export const getRateSheetImageUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const sb = await serviceClient();
    const { data: signed, error } = await sb.storage.from("rate-sheets").createSignedUrl(data.path, 3600);
    if (error || !signed) throw new Error(error?.message ?? "서명 URL 생성 실패");
    return { url: signed.signedUrl };
  });

// 삭제(시트 + partner_rates cascade + 스토리지 이미지)
export const deleteRateSheet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string(), image_path: z.string().nullable() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sb = await serviceClient();
    if (data.image_path) await sb.storage.from("rate-sheets").remove([data.image_path]);
    const { error } = await sb.from("rate_sheets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
