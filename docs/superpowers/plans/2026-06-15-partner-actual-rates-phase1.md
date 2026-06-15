# 실측 FCL 운임 업로드 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin uploads forwarder FCL rate-sheet screenshots; Claude vision extracts rows; admin reviews/maps POD→KITA dest and saves; published rates are queryable. (Phase 1 — no /rates merge yet.)

**Architecture:** New Supabase tables (`rate_sheets`, `partner_rates`) + private Storage bucket `rate-sheets`. Pure normalization helpers (vitest). Server functions (`createServerFn`) do all DB/Storage/LLM work so secrets stay server-side. Admin route (`/admin/partner-rates`) provides upload → extract → editable review table with POD→KITA dest mapping → save/publish.

**Tech Stack:** React 19 + TanStack Start (`createServerFn`), Supabase (Postgres + Storage), `@anthropic-ai/sdk` (Claude `claude-opus-4-8` vision + structured outputs), vitest.

Spec: `docs/superpowers/specs/2026-06-15-partner-actual-rates-design.md` (Phase 1 only).

---

## File Structure

- Create: `supabase/migrations/20260615000000_partner_rates.sql` — tables + indexes + RLS.
- Modify: `package.json` — add `@anthropic-ai/sdk`.
- Create: `src/lib/api/partner-rates.normalize.ts` — pure helpers (number/transit/route normalization, expiry filter).
- Create: `src/lib/__tests__/partner-rates.normalize.test.ts` — vitest unit tests.
- Create: `src/lib/api/partner-rates.functions.ts` — server functions (upload image, extract, save, list published, list dests).
- Create: `src/lib/api/partner-rates.ts` — types + query options.
- Create: `src/routes/admin.partner-rates.tsx` — admin upload + review UI.

Origin always 부산/인천 etc. is irrelevant here (POL is free text from the sheet). KITA dest list comes from `kita_sea_rates`.

---

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/20260615000000_partner_rates.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 실측 FCL 운임(파트너 견적) — 업로드 시트 + 행
create table if not exists public.rate_sheets (
  id uuid primary key default gen_random_uuid(),
  source text,
  title text,
  valid_from date,
  valid_until date,
  image_path text,
  notes text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table if not exists public.partner_rates (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.rate_sheets(id) on delete cascade,
  pol text,
  pod text,
  country text,
  kita_dest text,
  rate_20 numeric,
  rate_40 numeric,
  transit_min int,
  transit_max int,
  route_type text check (route_type in ('DIRECT','T_S') or route_type is null),
  via_port text,
  carrier text,
  remark text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists partner_rates_sheet_id_idx on public.partner_rates (sheet_id);
create index if not exists partner_rates_kita_dest_idx on public.partner_rates (kita_dest);
create index if not exists rate_sheets_status_valid_idx on public.rate_sheets (status, valid_until);

-- RLS: anon/authenticated 직접 접근 차단 — 모든 접근은 서버함수(service role)로.
alter table public.rate_sheets enable row level security;
alter table public.partner_rates enable row level security;
```

- [ ] **Step 2: Apply the migration**

Run (one of, per project convention):
`npx supabase db push` (if Supabase CLI linked) — or apply via the Supabase SQL editor by pasting the file.
Expected: tables `rate_sheets`, `partner_rates` exist; no error.

- [ ] **Step 3: Verify tables exist**

Run a quick check via the project's existing DB access (e.g. a node script with `SUPABASE_SERVICE_ROLE_KEY`), or the Supabase dashboard. Confirm both tables and the three indexes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260615000000_partner_rates.sql
git commit -m "feat(rates): partner_rates + rate_sheets tables (Phase 1)"
```

---

## Task 2: Storage bucket

**Files:** (no code file — Supabase config)

- [ ] **Step 1: Create a private bucket**

In Supabase dashboard → Storage → New bucket: name `rate-sheets`, **Public: off**.
(Or via SQL/CLI: `insert into storage.buckets (id, name, public) values ('rate-sheets','rate-sheets', false) on conflict do nothing;`)

- [ ] **Step 2: Verify**

Confirm the bucket `rate-sheets` exists and is private. No commit (infra).

---

## Task 3: Pure normalization helpers (TDD)

**Files:**
- Create: `src/lib/api/partner-rates.normalize.ts`
- Test: `src/lib/__tests__/partner-rates.normalize.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/partner-rates.normalize.test.ts
import { describe, it, expect } from "vitest";
import { numUSD, parseTransit, normRouteType, isExpired } from "../api/partner-rates.normalize";

describe("numUSD", () => {
  it("strips currency symbols and commas", () => {
    expect(numUSD("$6,200")).toBe(6200);
    expect(numUSD("4,950")).toBe(4950);
    expect(numUSD(6200)).toBe(6200);
    expect(numUSD("")).toBeNull();
    expect(numUSD(null)).toBeNull();
    expect(numUSD("N/A")).toBeNull();
  });
});

describe("parseTransit", () => {
  it("parses ranges and single values", () => {
    expect(parseTransit("14~18")).toEqual({ min: 14, max: 18 });
    expect(parseTransit("37")).toEqual({ min: 37, max: 37 });
    expect(parseTransit("22-26")).toEqual({ min: 22, max: 26 });
    expect(parseTransit("")).toEqual({ min: null, max: null });
    expect(parseTransit(null)).toEqual({ min: null, max: null });
  });
});

describe("normRouteType", () => {
  it("maps free text to DIRECT/T_S/null", () => {
    expect(normRouteType("DIRECT")).toBe("DIRECT");
    expect(normRouteType("direct")).toBe("DIRECT");
    expect(normRouteType("T/S CLL")).toBe("T_S");
    expect(normRouteType("T/S BUN or LZC")).toBe("T_S");
    expect(normRouteType("DIRECT or T/S ZLO")).toBe("DIRECT");
    expect(normRouteType("")).toBeNull();
  });
});

describe("isExpired", () => {
  it("true when valid_until is before today", () => {
    expect(isExpired("2026-06-14", "2026-06-15")).toBe(true);
    expect(isExpired("2026-06-15", "2026-06-15")).toBe(false);
    expect(isExpired("2026-06-30", "2026-06-15")).toBe(false);
    expect(isExpired(null, "2026-06-15")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/partner-rates.normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

```ts
// src/lib/api/partner-rates.normalize.ts
export function numUSD(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseTransit(v: string | null | undefined): { min: number | null; max: number | null } {
  if (!v) return { min: null, max: null };
  const nums = String(v).match(/\d+/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  const a = Number(nums[0]);
  const b = nums.length > 1 ? Number(nums[1]) : a;
  return { min: a, max: b };
}

export function normRouteType(v: string | null | undefined): "DIRECT" | "T_S" | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  if (s.startsWith("DIRECT")) return "DIRECT";
  if (s.includes("T/S") || s.includes("T.S") || s.includes("TS ")) return "T_S";
  return null;
}

export function isExpired(validUntil: string | null | undefined, today: string): boolean {
  if (!validUntil) return false;
  return validUntil < today;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/partner-rates.normalize.test.ts`
Expected: PASS (4 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/partner-rates.normalize.ts src/lib/__tests__/partner-rates.normalize.test.ts
git commit -m "feat(rates): partner-rate normalization helpers"
```

---

## Task 4: Add Anthropic SDK + extract server function

**Files:**
- Modify: `package.json`
- Create: `src/lib/api/partner-rates.functions.ts`

- [ ] **Step 1: Install the SDK**

Run: `npm install @anthropic-ai/sdk`
Expected: dependency added; `node -e "require('@anthropic-ai/sdk/package.json')"` prints a version.

- [ ] **Step 2: Write the extract server function**

```ts
// src/lib/api/partner-rates.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const extractRateSheet = createServerFn({ method: "POST" })
  .validator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data }): Promise<ExtractedSheet> => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"]! });
    const msg = await client.messages.create({
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
    });
    const block = msg.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "{}";
    return JSON.parse(text) as ExtractedSheet;
  });
```

Note: if the installed SDK version rejects `output_config`/`thinking` typings, cast the request object to `any` for those two fields only — do not remove them. If `messages.parse()` is available, prefer it and return `msg.parsed_output`.

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/api/partner-rates.functions.ts
git commit -m "feat(rates): Claude vision extract server fn for rate sheets"
```

---

## Task 5: Storage upload + save + read server functions

**Files:**
- Modify: `src/lib/api/partner-rates.functions.ts`
- Create: `src/lib/api/partner-rates.ts`

- [ ] **Step 1: Add a service-role client + upload/save/read functions**

Append to `src/lib/api/partner-rates.functions.ts`:

```ts
import { numUSD, parseTransit, normRouteType, isExpired } from "./partner-rates.normalize";

async function serviceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false },
  });
}

// 업로드: base64 이미지를 rate-sheets 버킷에 저장하고 경로 반환
export const uploadRateImage = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ imageBase64: z.string(), ext: z.enum(["png", "jpg", "webp"]) }).parse(d))
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

// 저장: 검수된 시트+행을 정규화하여 insert. status는 draft 또는 published.
export const saveRateSheet = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data }): Promise<{ sheetId: string; rows: number }> => {
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

// KITA dest 후보(매핑 드롭다운용) — kita_sea_rates의 distinct dest
export const listKitaDests = createServerFn({ method: "GET" }).handler(async (): Promise<string[]> => {
  const sb = await serviceClient();
  const { data, error } = await sb.from("kita_sea_rates").select("dest");
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r: { dest: string }) => r.dest))].sort((a, b) => a.localeCompare(b));
});

// 발행·미만료 실측 행(+시트 메타)
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
  const byId = new Map(live.map((s) => [s.id, s]));
  return (rows ?? []).map((r: { sheet_id: string }) => ({ ...r, sheet: byId.get(r.sheet_id) }));
});
```

- [ ] **Step 2: Add types + query options**

```ts
// src/lib/api/partner-rates.ts
import { queryOptions } from "@tanstack/react-query";
import { getPublishedPartnerRates, listKitaDests } from "./partner-rates.functions";

export const publishedPartnerRatesQueryOptions = () =>
  queryOptions({
    queryKey: ["partner_rates", "published"],
    queryFn: () => getPublishedPartnerRates(),
    staleTime: 5 * 60 * 1000,
  });

export const kitaDestsQueryOptions = () =>
  queryOptions({
    queryKey: ["kita_sea_rates", "dests"],
    queryFn: () => listKitaDests(),
    staleTime: 30 * 60 * 1000,
  });
```

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/partner-rates.functions.ts src/lib/api/partner-rates.ts
git commit -m "feat(rates): upload/save/read partner-rate server fns + query options"
```

---

## Task 6: Admin upload + review UI

**Files:**
- Create: `src/routes/admin.partner-rates.tsx`

- [ ] **Step 1: Build the route**

Mirror the auth/layout pattern of `src/routes/admin.policies.tsx` (read it first and replicate its `createFileRoute("/admin/...")` + auth gate). Then implement:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { extractRateSheet, uploadRateImage, saveRateSheet, type ExtractedSheet } from "@/lib/api/partner-rates.functions";
import { kitaDestsQueryOptions } from "@/lib/api/partner-rates";

export const Route = createFileRoute("/admin/partner-rates")({
  component: AdminPartnerRates,
});

type EditRow = ExtractedSheet["rows"][number] & { kita_dest: string | null };

function AdminPartnerRates() {
  const { data: dests = [] } = useQuery(kitaDestsQueryOptions());
  const [busy, setBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ExtractedSheet["sheet"] | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [msg, setMsg] = useState("");

  async function onFile(file: File) {
    setBusy(true); setMsg("추출 중…");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (const b of buf) bin += String.fromCharCode(b);
      const base64 = btoa(bin);
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const media = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
      const up = await uploadRateImage({ data: { imageBase64: base64, ext } });
      setImagePath(up.path);
      const ex = await extractRateSheet({ data: { imageBase64: base64, mediaType: media } });
      setSheet(ex.sheet);
      setRows(ex.rows.map((r) => ({ ...r, kita_dest: null })));
      setMsg(`추출 완료: ${ex.rows.length}행. 확인·보정 후 저장하세요.`);
    } catch (e) { setMsg("실패: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  async function save(status: "draft" | "published") {
    if (!sheet) return;
    setBusy(true); setMsg("저장 중…");
    try {
      const res = await saveRateSheet({ data: {
        sheet: { ...sheet, valid_from: null, image_path: imagePath, status },
        rows,
      } });
      setMsg(`저장됨 (${status}): ${res.rows}행`);
      setSheet(null); setRows([]); setImagePath(null);
    } catch (e) { setMsg("저장 실패: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  function setRow(i: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>실측 운임 업로드</h1>
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <p>{msg}</p>

      {sheet && (
        <>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4,1fr)", margin: "12px 0" }}>
            <label>출처<input value={sheet.source ?? ""} onChange={(e) => setSheet({ ...sheet, source: e.target.value })} /></label>
            <label>제목<input value={sheet.title ?? ""} onChange={(e) => setSheet({ ...sheet, title: e.target.value })} /></label>
            <label>유효기간<input value={sheet.valid_until ?? ""} placeholder="YYYY-MM-DD" onChange={(e) => setSheet({ ...sheet, valid_until: e.target.value })} /></label>
            <label>각주<input value={sheet.notes ?? ""} onChange={(e) => setSheet({ ...sheet, notes: e.target.value })} /></label>
          </div>
          <table border={1} cellPadding={4} style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead><tr>
              <th>POL</th><th>POD</th><th>국가</th><th>20'</th><th>40'/HQ</th><th>Transit</th><th>Route</th><th>Carrier</th><th>비고</th><th>KITA 항만 매핑</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.pol ?? ""} onChange={(e) => setRow(i, { pol: e.target.value })} /></td>
                  <td><input value={r.pod ?? ""} onChange={(e) => setRow(i, { pod: e.target.value })} /></td>
                  <td><input value={r.country ?? ""} onChange={(e) => setRow(i, { country: e.target.value })} /></td>
                  <td><input value={r.rate_20 ?? ""} onChange={(e) => setRow(i, { rate_20: e.target.value })} /></td>
                  <td><input value={r.rate_40 ?? ""} onChange={(e) => setRow(i, { rate_40: e.target.value })} /></td>
                  <td><input value={r.transit ?? ""} onChange={(e) => setRow(i, { transit: e.target.value })} /></td>
                  <td><input value={r.route_type ?? ""} onChange={(e) => setRow(i, { route_type: e.target.value })} /></td>
                  <td><input value={r.carrier ?? ""} onChange={(e) => setRow(i, { carrier: e.target.value })} /></td>
                  <td><input value={r.remark ?? ""} onChange={(e) => setRow(i, { remark: e.target.value })} /></td>
                  <td>
                    <select value={r.kita_dest ?? ""} onChange={(e) => setRow(i, { kita_dest: e.target.value || null })}>
                      <option value="">(미매핑)</option>
                      {dests.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={() => save("draft")}>임시저장(draft)</button>
            <button disabled={busy} onClick={() => save("published")}>발행(published)</button>
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: `✓ built`. Fix any auth-gate import mismatches by aligning with `admin.policies.tsx`.

- [ ] **Step 3: Manual smoke**

Run `npm run dev`, open `/admin/partner-rates` (log in via admin.login if gated). Upload one of the JH Logistics screenshots → verify rows extract → map a couple PODs → 발행 → confirm "저장됨".

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.partner-rates.tsx
git commit -m "feat(rates): admin upload + review UI for partner rate sheets"
```

---

## Task 7: Final verification + push

- [ ] **Step 1: Build + tests**

Run: `npx vite build && npx vitest run`
Expected: build OK; all tests pass (including partner-rates.normalize).

- [ ] **Step 2: Push**

```bash
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** §3 데이터모델=Task1; Storage=Task2; §4 추출=Task4; 저장/읽기=Task5; §5 관리자 UI=Task6; 정규화·만료 헬퍼(§8 테스트)=Task3. /rates 병합(§6, Phase 2)은 의도적으로 제외.
- **Type names:** `ExtractedSheet`/`ExtractedRow`, `EditRow`, server fns `extractRateSheet`/`uploadRateImage`/`saveRateSheet`/`listKitaDests`/`getPublishedPartnerRates`, helpers `numUSD`/`parseTransit`/`normRouteType`/`isExpired` — consistent across tasks.
- **Known follow-ups:** signed-URL preview of the stored image in admin; a "published sheets" management list (re-publish/expire); these are Phase 1.5/2, not required for the core loop.
- **Risk:** `@anthropic-ai/sdk` typing for `output_config`/`thinking` may lag — Task 4 Step 2 notes the `any`-cast escape hatch (keep the fields).
