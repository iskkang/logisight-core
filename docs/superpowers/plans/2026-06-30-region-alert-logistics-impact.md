# 지역 경보 → 물류 영향 분석 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/climate`에서 모든 관측 경보에 물류 연관 판정 배지를 붙이고, 연관된 경보는 전용 섹션에 (AI 서술 포함) 노출한다.

**Architecture:** 순수 함수 게이트(`climate-gate.ts`)가 이벤트↔물류 자산/노선 근접을 결정론으로 판정. 프론트는 이 판정으로 타임라인 배지(전 이벤트)와 전용 `RegionImpact` 섹션(연관 이벤트)을 렌더. AI 3단 서술은 별도 파이프라인(logisight 레포)이 `forecasts`에 적재한 published 산출물을 `metric_ref='climate:event:<id>'`로 페어링해 표시만 한다.

**Tech Stack:** TanStack Start/React, TypeScript, vitest, Tailwind. 기존 `/climate` 컴포넌트(`LogisightClimate.tsx`, `RiskGlobe.tsx`)·`climate.ts`·`climate-quality.ts` 확장.

## Global Constraints

- 더미·임의 수치로 실데이터 행세 금지 — 데이터 없으면 숨김 또는 "검수 중" 표기.
- AI 산출물은 published만 노출(기존 RLS). 발행 후 본문 수정·삭제 불가.
- 게이트 반경 정본: `ASSET_RADIUS_KM = 200`, `ROUTE_RADIUS_KM = 1000`.
- 페어링 키: `metric_ref = 'climate:event:<event_id>'`.
- 기존 `/climate` 기능(지구본·RouteMonitor·Impact·Straits·Timeline) 회귀 금지.
- 비범위: 이벤트→`asset_risk` 점수 전파, 내륙 자산 노선 귀속, AI 적중률 자동 채점. 내륙 자산 시드·risk 채점·AI 생성 스크립트는 **logisight 레포(이 계획 밖)**.
- `npx tsc --noEmit`는 기존 에러(ws 모듈·server-fn 직렬화)가 있으니, 검증은 *편집 파일에 신규 에러 없음*으로 판정.

---

## File Structure

- `src/lib/api/climate.ts` — `AssetType`에 `"inland"` 추가 (Modify)
- `src/components/climate/RiskGlobe.tsx` — inland 마커·타입 라벨 (Modify)
- `src/lib/climate-quality.ts` — inland expectedRows 가드 (Modify)
- `src/lib/climate-gate.ts` — 게이트 순수 함수 (Create)
- `src/lib/__tests__/climate-gate.test.ts` — 게이트 테스트 (Create)
- `src/lib/__tests__/climate-quality.inland.test.ts` — 가드 테스트 (Create)
- `src/components/climate-page/LogisightClimate.tsx` — 타임라인 배지 + `RegionImpact` 섹션 + 페이지 배선 (Modify)

---

## Task 1: inland 자산 타입 + 지구본 마커

**Files:**
- Modify: `src/lib/api/climate.ts:11`
- Modify: `src/components/climate/RiskGlobe.tsx:56-57`, `:440`

**Interfaces:**
- Produces: `AssetType = "port" | "choke" | "rail" | "inland"`

- [ ] **Step 1: `AssetType`에 inland 추가**

`src/lib/api/climate.ts`의 기존 줄:
```ts
export type AssetType = "port" | "choke" | "rail";
```
교체:
```ts
export type AssetType = "port" | "choke" | "rail" | "inland";
```

- [ ] **Step 2: 지구본 타입 라벨 맵에 inland 추가**

`src/components/climate/RiskGlobe.tsx`의 기존 두 줄:
```ts
const TYPE_KO: Record<AssetType, string> = { port: "항만", choke: "초크포인트", rail: "철도" };
const TYPE_BADGE: Record<AssetType, string> = { port: "항만", choke: "관문", rail: "철도" };
```
교체:
```ts
const TYPE_KO: Record<AssetType, string> = { port: "항만", choke: "초크포인트", rail: "철도", inland: "내륙거점" };
const TYPE_BADGE: Record<AssetType, string> = { port: "항만", choke: "관문", rail: "철도", inland: "내륙" };
```

- [ ] **Step 3: inland 마커(삼각형) 그리기 분기 추가**

`src/components/climate/RiskGlobe.tsx`에서 rail 분기와 port(`else`) 사이. 기존:
```ts
        } else if (n.type === "rail") {
          const sq = seld ? 5 : 3.6;
          ctx.beginPath(); ctx.rect(p[0] - sq, p[1] - sq, 2 * sq, 2 * sq);
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(7,15,28,.7)"; ctx.stroke();
          if (seld) label(n.name, p[0], p[1] - 9);
        } else {
```
교체:
```ts
        } else if (n.type === "rail") {
          const sq = seld ? 5 : 3.6;
          ctx.beginPath(); ctx.rect(p[0] - sq, p[1] - sq, 2 * sq, 2 * sq);
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(7,15,28,.7)"; ctx.stroke();
          if (seld) label(n.name, p[0], p[1] - 9);
        } else if (n.type === "inland") {
          const t = seld ? 6 : 4.4;
          ctx.beginPath(); ctx.moveTo(p[0], p[1] - t); ctx.lineTo(p[0] + t, p[1] + t); ctx.lineTo(p[0] - t, p[1] + t); ctx.closePath();
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(7,15,28,.7)"; ctx.stroke();
          if (seld) label(n.name, p[0], p[1] - 9);
        } else {
```

- [ ] **Step 4: 편집 파일에 신규 타입 에러 없음 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "RiskGlobe|climate.ts\("`
Expected: 출력 없음 (빈 결과).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/climate.ts src/components/climate/RiskGlobe.tsx
git commit -m "feat(climate): inland 자산 타입·지구본 마커 추가"
```

---

## Task 2: forecastQuality inland expectedRows 가드

**Files:**
- Create: `src/lib/__tests__/climate-quality.inland.test.ts`
- Modify: `src/lib/climate-quality.ts:67-68`

**Interfaces:**
- Consumes: `buildClimateForecastQuality(data, nowMs)` from `@/lib/climate-quality`
- Produces: 동작 변경 — `expectedRows = (inland이 아니거나 risk 행이 있는 자산) 수`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/lib/__tests__/climate-quality.inland.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildClimateForecastQuality } from "@/lib/climate-quality";
import { HDAYS, type AssetRow, type RiskRow, type ClimateRiskData } from "@/lib/api/climate";

const NOW = Date.UTC(2026, 5, 30, 0, 0, 0);
const RECENT = new Date(NOW - 3600_000).toISOString();

function asset(id: string, type: AssetRow["type"]): AssetRow {
  return { id, name: id, type, lon: 0, lat: 0, freeze_prone: false };
}
function riskRowsFor(id: string): RiskRow[] {
  return HDAYS.map((h) => ({
    asset_id: id, horizon_days: h, score: 0, level: "g", driver: null,
    wind_gust: 1, wave_height: null, precip: 1, snowfall: null, temp_min: 1,
    is_freeze: false, updated_at: RECENT,
  }));
}
function data(assets: AssetRow[], risk: RiskRow[]): ClimateRiskData {
  return { assets, risk, routes: [], events: [], forecasts: [] };
}

describe("buildClimateForecastQuality inland guard", () => {
  it("risk 행 없는 inland 자산은 expectedRows에서 제외", () => {
    const assets = [asset("p1", "port"), asset("p2", "port"), asset("chi", "inland")];
    const risk = [...riskRowsFor("p1"), ...riskRowsFor("p2")]; // inland 없음
    const q = buildClimateForecastQuality(data(assets, risk), NOW);
    expect(q.horizons[0].expectedRows).toBe(2);
  });

  it("risk 행 있는 inland 자산은 expectedRows에 포함", () => {
    const assets = [asset("p1", "port"), asset("chi", "inland")];
    const risk = [...riskRowsFor("p1"), ...riskRowsFor("chi")];
    const q = buildClimateForecastQuality(data(assets, risk), NOW);
    expect(q.horizons[0].expectedRows).toBe(2);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/climate-quality.inland.test.ts`
Expected: FAIL — 첫 테스트가 `expected 2, received 3` (현재 expectedRows = assets.length = 3).

- [ ] **Step 3: 가드 구현**

`src/lib/climate-quality.ts`의 기존:
```ts
  const maritimeIds = new Set(data.assets.filter((a) => a.type === "port" || a.type === "choke").map((a) => a.id));
  const expectedRows = data.assets.length;
```
교체:
```ts
  const maritimeIds = new Set(data.assets.filter((a) => a.type === "port" || a.type === "choke").map((a) => a.id));
  // inland 자산은 risk 잡이 채점하기 전까지 expectedRows에서 제외 — 신규 자산이 "일부 자산 누락(warn)"을
  // 유발하지 않게. risk 행이 생기면 자동으로 포함된다.
  const riskAssetIds = new Set(data.risk.map((r) => r.asset_id));
  const expectedRows = data.assets.filter((a) => a.type !== "inland" || riskAssetIds.has(a.id)).length;
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/climate-quality.inland.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/climate-quality.ts src/lib/__tests__/climate-quality.inland.test.ts
git commit -m "feat(climate): inland 자산 expectedRows 가드(미채점 시 제외)"
```

---

## Task 3: 게이트 순수 함수 `climate-gate.ts`

**Files:**
- Create: `src/lib/climate-gate.ts`
- Create: `src/lib/__tests__/climate-gate.test.ts`

**Interfaces:**
- Consumes: `AssetRow, EventRow, RouteRow` from `@/lib/api/climate`
- Produces:
  - `ASSET_RADIUS_KM: 200`, `ROUTE_RADIUS_KM: 1000`
  - `type GateTier = "LINKED_HIGH" | "LINKED_WATCH" | "LIMITED"`
  - `type LinkedAsset = { id: string; name: string; type: AssetRow["type"]; km: number }`
  - `type GateVerdict = { tier: GateTier; nearestAsset: LinkedAsset | null; nearestKm: number | null; linkedAssets: LinkedAsset[]; linkedRouteIds: string[] }`
  - `gateEvent(event: EventRow, assets: AssetRow[], routes: RouteRow[], nodes: Record<string, AssetRow>): GateVerdict`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/lib/__tests__/climate-gate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gateEvent } from "@/lib/climate-gate";
import type { AssetRow, EventRow, RouteRow } from "@/lib/api/climate";

const asset = (id: string, lon: number, lat: number, type: AssetRow["type"] = "inland"): AssetRow =>
  ({ id, name: id, type, lon, lat, freeze_prone: false });
const ev = (over: Partial<EventRow>): EventRow => ({
  id: "e1", source: "nws", kind: "flood", title: "Flood Warning", severity: "r",
  lon: 0, lat: 0, area: null, url: null, starts_at: null, ends_at: null, updated_at: null, track: null, ...over,
});

describe("gateEvent", () => {
  it("자산 위 severity r → LINKED_HIGH (NWS 소스도 통과)", () => {
    const v = gateEvent(ev({ lon: 0, lat: 0, source: "nws", severity: "r" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LINKED_HIGH");
    expect(v.linkedAssets).toHaveLength(1);
    expect(v.linkedAssets[0].id).toBe("chi");
  });

  it("~111km(위도 1°) severity r → LINKED_HIGH (반경 내)", () => {
    const v = gateEvent(ev({ lon: 0, lat: 1, severity: "r" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LINKED_HIGH");
  });

  it("~222km(위도 2°) severity r, 단일 자산 → LIMITED, nearestKm > 200", () => {
    const v = gateEvent(ev({ lon: 0, lat: 2, severity: "r" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LIMITED");
    expect(v.nearestKm).toBeGreaterThan(200);
    expect(v.nearestAsset?.id).toBe("chi");
  });

  it("반경 내 severity a → LINKED_WATCH", () => {
    const v = gateEvent(ev({ lon: 0, lat: 0, severity: "a" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LINKED_WATCH");
  });

  it("반경 내지만 severity 없음 → LIMITED", () => {
    const v = gateEvent(ev({ lon: 0, lat: 0, severity: "" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LIMITED");
  });

  it("좌표 없는 이벤트 → LIMITED, nearestAsset null", () => {
    const v = gateEvent(ev({ lon: null, lat: null }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LIMITED");
    expect(v.nearestAsset).toBeNull();
  });

  it("점 자산은 멀고 노선 waypoint 근접 → LINKED_HIGH (노선 경유)", () => {
    const routes: RouteRow[] = [{ id: "r1", name: "R1", waypoints: [[0, 0]], chokes: [] }];
    const v = gateEvent(ev({ lon: 0, lat: 0, severity: "r" }), [asset("far", 100, 80)], routes, {});
    expect(v.tier).toBe("LINKED_HIGH");
    expect(v.linkedRouteIds).toEqual(["r1"]);
    expect(v.linkedAssets).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/climate-gate.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/climate-gate"` (모듈 없음).

- [ ] **Step 3: 게이트 구현**

Create `src/lib/climate-gate.ts`:
```ts
import type { AssetRow, EventRow, RouteRow } from "@/lib/api/climate";

// 게이트 반경 정본 — 파이프라인(logisight 레포)도 이 값을 그대로 구현해야 한다.
export const ASSET_RADIUS_KM = 200;
export const ROUTE_RADIUS_KM = 1000;

export type GateTier = "LINKED_HIGH" | "LINKED_WATCH" | "LIMITED";
export type LinkedAsset = { id: string; name: string; type: AssetRow["type"]; km: number };
export type GateVerdict = {
  tier: GateTier;
  nearestAsset: LinkedAsset | null;
  nearestKm: number | null;
  linkedAssets: LinkedAsset[];
  linkedRouteIds: string[];
};

const EARTH_KM = 6371;
function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const t = Math.PI / 180;
  const dla = (lat2 - lat1) * t, dlo = (lon2 - lon1) * t;
  const x = Math.sin(dla / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dlo / 2) ** 2;
  return 2 * EARTH_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// routes.waypoints: 문자열(asset id) 또는 [lon,lat]. 문자열은 nodes로 해소.
function routeCoords(r: RouteRow, nodes: Record<string, AssetRow>): [number, number][] {
  return (r.waypoints || [])
    .map((w): [number, number] | null =>
      typeof w === "string" ? (nodes[w] ? [nodes[w].lon, nodes[w].lat] : null) : (w as [number, number]))
    .filter((c): c is [number, number] => !!c);
}

// 이벤트가 물류 자산/노선과 연관 있는지 결정론으로 판정. severityTier()는 NWS를 INFO로 떨구므로 쓰지 않고
// 이벤트 원본 severity('r'/'a')를 직접 사용한다.
export function gateEvent(
  event: EventRow,
  assets: AssetRow[],
  routes: RouteRow[],
  nodes: Record<string, AssetRow>,
): GateVerdict {
  if (event.lon == null || event.lat == null) {
    return { tier: "LIMITED", nearestAsset: null, nearestKm: null, linkedAssets: [], linkedRouteIds: [] };
  }
  const elon = event.lon, elat = event.lat;
  const linkedAssets: LinkedAsset[] = [];
  let nearest: LinkedAsset | null = null;
  for (const a of assets) {
    const km = Math.round(hav(elat, elon, a.lat, a.lon));
    const la: LinkedAsset = { id: a.id, name: a.name, type: a.type, km };
    if (nearest == null || km < nearest.km) nearest = la;
    if (km <= ASSET_RADIUS_KM) linkedAssets.push(la);
  }
  linkedAssets.sort((x, y) => x.km - y.km);
  const linkedRouteIds: string[] = [];
  for (const r of routes) {
    let min = Infinity;
    for (const c of routeCoords(r, nodes)) { const d = hav(elat, elon, c[1], c[0]); if (d < min) min = d; }
    if (min <= ROUTE_RADIUS_KM) linkedRouteIds.push(r.id);
  }
  const linked = linkedAssets.length > 0 || linkedRouteIds.length > 0;
  const sev = event.severity;
  const tier: GateTier = !linked ? "LIMITED" : sev === "r" ? "LINKED_HIGH" : sev === "a" ? "LINKED_WATCH" : "LIMITED";
  return { tier, nearestAsset: nearest, nearestKm: nearest ? nearest.km : null, linkedAssets, linkedRouteIds };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/climate-gate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/climate-gate.ts src/lib/__tests__/climate-gate.test.ts
git commit -m "feat(climate): 이벤트-물류 연관 게이트(순수 함수)+테스트"
```

---

## Task 4: 타임라인 물류 연관 배지

**Files:**
- Modify: `src/components/climate-page/LogisightClimate.tsx` (imports, `Timeline` 컴포넌트, 호출부)

**Interfaces:**
- Consumes: `gateEvent`, `GateVerdict`, `GateTier` from `@/lib/climate-gate`
- Produces: `LOGI_BADGE`, `logiVerdictText(v: GateVerdict): string` (Task 5에서 재사용)

- [ ] **Step 1: import에 useMemo·게이트 추가**

`src/components/climate-page/LogisightClimate.tsx` 상단. 기존:
```ts
import { useId, useState } from "react";
```
교체:
```ts
import { useId, useMemo, useState } from "react";
```
그리고 `GeoArticleSchema` import 아래 줄에 추가:
```ts
import { gateEvent, type GateVerdict, type GateTier } from "@/lib/climate-gate";
```

- [ ] **Step 2: 배지 헬퍼 추가**

`/* ============================ SMALL UI ============================ */` 주석 바로 아래(`Spark` 함수 위)에 추가:
```tsx
const LOGI_BADGE: Record<GateTier, { label: string; cls: string }> = {
  LINKED_HIGH: { label: "물류 연관", cls: "border-[#fbd5d5] bg-[#fef2f2] text-[#dc2626]" },
  LINKED_WATCH: { label: "연관 가능", cls: "border-[#fde6c8] bg-[#fff7ed] text-[#b45309]" },
  LIMITED: { label: "영향 제한적", cls: "border-[#d8dfe9] bg-[#eef1f6] text-[#828d9d]" },
};
function logiVerdictText(v: GateVerdict): string {
  if (v.tier === "LIMITED") return v.nearestAsset ? `최근접 ${v.nearestAsset.name} ~${v.nearestKm}km` : "물류 거점 원거리";
  const lead = v.linkedAssets[0]?.name ?? "주요 항로 인근";
  const more = v.linkedAssets.length > 1 ? ` 외 ${v.linkedAssets.length - 1}곳` : "";
  return `${lead}${more}`;
}
```

- [ ] **Step 3: `Timeline` 시그니처·판정·행 배지 수정**

기존 `Timeline` 함수 시작부:
```tsx
function Timeline({ events }: { events: EventRow[] }) {
  const [filter, setFilter] = useState<"all" | "r" | "a">("all");
  if (events.length === 0) return null;
```
교체:
```tsx
function Timeline({ events, assets, routes, nodes }: { events: EventRow[]; assets: AssetRow[]; routes: RouteG[]; nodes: Record<string, AssetRow> }) {
  const [filter, setFilter] = useState<"all" | "r" | "a">("all");
  const verdicts = useMemo(() => {
    const m: Record<string, GateVerdict> = {};
    for (const e of events) m[e.id] = gateEvent(e, assets, routes, nodes);
    return m;
  }, [events, assets, routes, nodes]);
  if (events.length === 0) return null;
```

그리고 행 렌더의 source 셀. 기존:
```tsx
              <span className="text-[11px] text-[#828d9d]">{e.source.toUpperCase()}</span>
            </div>
          );
        })}
```
교체:
```tsx
              <span className="flex items-center gap-2 text-[11px] text-[#828d9d]">
                {(() => {
                  const v = verdicts[e.id];
                  const b = LOGI_BADGE[v.tier];
                  return (
                    <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-[3px] text-[10px] font-bold ${b.cls}`} title={logiVerdictText(v)}>
                      {b.label}
                    </span>
                  );
                })()}
                <span className="whitespace-nowrap">{e.source.toUpperCase()}</span>
              </span>
            </div>
          );
        })}
```

- [ ] **Step 4: 호출부 수정**

기존:
```tsx
          <Timeline events={data.events} />
```
교체:
```tsx
          <Timeline events={data.events} assets={data.assets} routes={routesG} nodes={nodes} />
```

- [ ] **Step 5: 편집 파일 신규 에러 없음 + 기존 테스트 통과 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "LogisightClimate|climate-gate"`
Expected: 출력 없음.

Run: `npx vitest run src/lib/__tests__/climate-gate.test.ts src/lib/__tests__/climate-quality.inland.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/climate-page/LogisightClimate.tsx
git commit -m "feat(climate): 타임라인 이벤트에 물류 연관 배지"
```

---

## Task 5: `RegionImpact` 전용 섹션 + 페이지 배선

**Files:**
- Modify: `src/components/climate-page/LogisightClimate.tsx` (`RegionImpact` 컴포넌트 신설, 페이지 배선)

**Interfaces:**
- Consumes: `gateEvent`, `LOGI_BADGE`, `logiVerdictText`, `RouteForecast`, `fcByEvent` 페어링, `ClimateForecastRow`
- Produces: `RegionImpact` 컴포넌트

- [ ] **Step 1: `RegionImpact` 컴포넌트 추가**

`Impact` 함수 정의 바로 아래에 추가:
```tsx
// 관측 경보 → 물류 영향. 게이트가 LINKED인 이벤트만 카드화(LIMITED은 타임라인 배지가 담당).
// published 이벤트 forecast(metric_ref='climate:event:<id>')가 있으면 AI 3단 서술을 RouteForecast로 표시.
function RegionImpact({ events, assets, routes, nodes, forecasts }: { events: EventRow[]; assets: AssetRow[]; routes: RouteG[]; nodes: Record<string, AssetRow>; forecasts: ClimateForecastRow[] }) {
  const fcByEvent: Record<string, ClimateForecastRow> = {};
  const PFX = "climate:event:";
  for (const f of forecasts) {
    const ref = f.metric_ref ?? "";
    if (ref.startsWith(PFX)) { const eid = ref.slice(PFX.length); if (eid && !fcByEvent[eid]) fcByEvent[eid] = f; }
  }
  const linked = events
    .map((e) => ({ e, v: gateEvent(e, assets, routes, nodes), fc: fcByEvent[e.id] ?? null }))
    .filter((x) => x.v.tier !== "LIMITED")
    .sort((a, b) => (a.v.tier === "LINKED_HIGH" ? 0 : 1) - (b.v.tier === "LINKED_HIGH" ? 0 : 1) || (a.v.nearestKm ?? 1e9) - (b.v.nearestKm ?? 1e9))
    .slice(0, 6);
  if (linked.length === 0) return null;
  return (
    <>
      <div className="mb-3.5 mt-[26px] flex items-center justify-between gap-2.5"><h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">지역 경보 → 물류 영향</h2><span className={CHIP}>관측 경보 · 물류 거점 근접</span></div>
      <div className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-2">
        {linked.map(({ e, v, fc }) => {
          const b = LOGI_BADGE[v.tier];
          const sev: Lv = e.severity === "r" ? "r" : "a";
          return (
            <div key={e.id} className={`p-[18px] ${CARD}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-extrabold text-[#1a2433]">{eventName(e)}</span>
                <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-[3px] text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                <Badge c={sev}>{KIND_KO[e.kind] || e.kind}</Badge>
              </div>
              <div className="mt-2 text-[12px] leading-[1.5] text-[#54606f]">
                {e.area ? <><b className="font-bold text-[#1a2433]">{e.area}</b> · </> : null}{e.source.toUpperCase()} · {logiVerdictText(v)}
              </div>
              {v.linkedAssets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.linkedAssets.slice(0, 4).map((la) => (
                    <span key={la.id} className="rounded-[6px] border border-[#d8dfe9] bg-[#eef1f6] px-2 py-[3px] text-[11px] text-[#54606f] lsg-mono">{la.name} ~{la.km}km</span>
                  ))}
                </div>
              )}
              {fc ? <RouteForecast fc={fc} /> : <div className="mt-3 rounded-[8px] border border-[#e6ebf2] bg-[#f6f8fb] px-3 py-2 text-[11.5px] text-[#828d9d]">AI 영향 분석 검수 중 — 발행되면 여기에 표시됩니다.</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: 페이지에 `RegionImpact` 배선 (Impact 뒤)**

기존:
```tsx
          <Impact rm={rm} routes={routesG} events={data.events} nodes={nodes} forecasts={data.forecasts} />
          <Straits rm={rm} chokes={chokes} routes={routesG} />
```
교체:
```tsx
          <Impact rm={rm} routes={routesG} events={data.events} nodes={nodes} forecasts={data.forecasts} />
          <RegionImpact events={data.events} assets={data.assets} routes={routesG} nodes={nodes} forecasts={data.forecasts} />
          <Straits rm={rm} chokes={chokes} routes={routesG} />
```

- [ ] **Step 3: 편집 파일 신규 에러 없음 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "LogisightClimate"`
Expected: 출력 없음.

- [ ] **Step 4: 전체 climate 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/climate-gate.test.ts src/lib/__tests__/climate-quality.inland.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/climate-page/LogisightClimate.tsx
git commit -m "feat(climate): 지역 경보 → 물류 영향 전용 섹션"
```

---

## Self-Review 결과

- **Spec coverage:** §3 데이터모델→Task 1·2, §4 게이트→Task 3, §6.2 배지→Task 4, §6.3 섹션→Task 5. §5 파이프라인은 logisight 레포(비범위, Global Constraints에 명시). ✅
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함, TBD 없음. "검수 중" 문구는 의도된 graceful 상태(더미 아님). ✅
- **Type consistency:** `GateVerdict`/`GateTier`/`LinkedAsset`/`gateEvent` 시그니처가 Task 3 정의와 Task 4·5 사용처 일치. `RouteG`는 `RouteRow` 확장이라 `gateEvent(routes: RouteRow[])`에 할당 가능. `eventName`·`KIND_KO`·`CHIP`·`CARD`·`Badge`·`Lv`·`RouteForecast`·`ClimateForecastRow`는 모두 `LogisightClimate.tsx` 내 기존 정의. ✅
