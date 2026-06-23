# 홈 리디자인(LogisightHome 샘플 통합) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 제공 샘플 디자인(LogisightHome)을 메인페이지(`/`)에 적용하고 더미 배열을 기존 Supabase/API 실데이터에 연결하며 모든 링크를 실제 라우트로 연결한다.

**Architecture:** 순수 데이터 변환 로직은 `src/lib/home-view-model.ts`(TDD)로 분리하고, 샘플 마크업은 `src/components/home/*` 컴포넌트로 포팅한다. 글로벌 `SiteShell`은 `/`에서만 글로벌 Nav/Footer를 건너뛰어 샘플 자체 Nav/Footer가 홈을 책임지게 한다. 데이터는 라우트 loader가 prefetch하고 컴포넌트는 `useSuspenseQuery`로 구독한다.

**Tech Stack:** React 19, TanStack Start/Router, TanStack Query, Tailwind v4(arbitrary values), Vitest(node + jsdom), Supabase.

## Global Constraints

- 더미·임의 수치로 실데이터 행세 금지 — 데이터 없으면 "데이터 수집 중" 표시.
- 샘플의 narrative 문장(카드 풋노트, 브리프 불릿)은 **AI 생성물**에서만 가져온다(하드코딩 금지). 소스: `latestRatesBrief.prose_json`/`signals_json`, 계산 시그널(ocean/global/airModal), `latestBriefing` points. 없으면 "데이터 수집 중".
- 샘플의 **디자인 카피(라벨·섹션 제목·푸터 문구·INSIGHTS 카드 카피)** 는 변경하지 않는다.
- 헤더/푸터는 **홈(`/`)에서만** 샘플 것 사용. 글로벌 `Navigation.tsx`/`Footer.tsx`는 수정 금지(다른 페이지 회귀 금지).
- 인사이트 하위 메뉴(SUB_GNB 8항목)는 기존 `Navigation.tsx`와 동일 라벨·라우트로 홈 Nav에 드롭다운/모바일로 살린다.
- 항공 운임 표시는 **MoM(%)** 만 사용(USD 단독 가격 표기 아님 → 4요소 규칙 대상 아님).
- `kita_air_rates` kg100/300/500 정렬·MoM은 USD 기준(원본). MoM은 단위 무관 비율이라 kg300 시계열로 계산.
- 비목표: 글로벌 Nav/Footer 전체 교체, 새 데이터 소스/마이그레이션, 다국어 실토글, 기존 페이지 동작 변경.

**테스트 전략:** 순수 로직(`home-view-model.ts`)만 Vitest로 TDD(node env, 기존 `src/lib/__tests__` 패턴). 컴포넌트는 TanStack `Link`가 라우터 컨텍스트를 요구해 단위 렌더 테스트가 비현실적 → **타입체크/`bun run build` + 수동 실행**으로 검증(현 저장소에 컴포넌트 테스트 없음, 패턴 준수).

## File Structure

- Create `src/lib/home-view-model.ts` — 순수 변환: `toTickerItems`, `aggregatePortCongestion`, `pickAirMoM`.
- Create `src/lib/__tests__/home-view-model.test.ts` — 위 3함수 테스트.
- Create `src/components/home/Wordmark.tsx` — 샘플 워드마크(Nav/Footer 공용).
- Create `src/components/home/HomeNav.tsx` — 샘플 Nav + 인사이트 드롭다운(SUB_GNB) + 모바일 메뉴, 실제 `Link`.
- Create `src/components/home/HomeFooter.tsx` — 샘플 Footer + 실제 링크.
- Create `src/components/home/LogisightHome.tsx` — STYLE/Ticker/Hero/LivePanel/Brief/NewsSection/Sidebar/Insight 조립 + 데이터 훅.
- Modify `src/routes/__root.tsx` — `SiteShell`이 `/`에서 글로벌 Nav/Footer 건너뜀.
- Modify `src/routes/index.tsx` — loader prefetch(+`riskSnapshotQueryOptions`) + head meta 유지 + `<LogisightHome/>` 렌더.

---

### Task 1: 홈 뷰모델 순수 로직 (TDD)

**Files:**
- Create: `src/lib/home-view-model.ts`
- Test: `src/lib/__tests__/home-view-model.test.ts`

**Interfaces:**
- Consumes: `IndexStats`, `KitaAirRateRow`, `orderedTickerStats`, `latestByRoute`, `computeMoM` from `@/lib/api/rates`.
- Produces:
  - `type TickerDir = "up" | "down" | "flat"`
  - `type TickerVM = { sym: string; value: string; delta: string; dir: TickerDir }`
  - `function toTickerItems(stats: IndexStats[]): TickerVM[]`
  - `type PortCongestionVM = { value: number | null; topPorts: string[] }`
  - `function aggregatePortCongestion(snapshot: { ports: { name: string; congestion: number | null }[] } | null): PortCongestionVM`
  - `type AirMoMVM = { mom: number | null; routeLabel: string; yearMon: string | null }`
  - `function pickAirMoM(rows: KitaAirRateRow[]): AirMoMVM`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/home-view-model.test.ts
import { describe, it, expect } from "vitest";
import { toTickerItems, aggregatePortCongestion, pickAirMoM } from "@/lib/home-view-model";
import type { IndexStats, KitaAirRateRow } from "@/lib/api/rates";

const stat = (code: string, value: number | null, chg: number | null): IndexStats => ({
  index_code: code, latest_value: value, latest_date: "2026-06-15", change_pct: chg,
  mom_pct: null, yoy_pct: null, pct_52w: null, normal_range: null, source: null,
});

describe("toTickerItems", () => {
  it("orders by ticker order, formats value, sets direction + delta", () => {
    const out = toTickerItems([stat("WCI", 3549, -3), stat("SCFI", 3121.69, 4.57)]);
    expect(out.map((o) => o.sym)).toEqual(["SCFI", "WCI"]);
    expect(out[0]).toMatchObject({ value: "3,121.69", dir: "up", delta: "▲ +4.57%" });
    expect(out[1]).toMatchObject({ dir: "down", delta: "▼ -3.00%" });
  });
  it("drops null-value indices and renders flat with em dash", () => {
    const out = toTickerItems([stat("BDI", 2809, 0), stat("CCFI", null, 1)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sym: "BDI", dir: "flat", delta: "— 0.00%" });
  });
});

describe("aggregatePortCongestion", () => {
  it("averages congestion and returns top 2 port names", () => {
    const out = aggregatePortCongestion({ ports: [
      { name: "Shanghai", congestion: 80 }, { name: "Busan", congestion: 40 }, { name: "LA", congestion: 60 },
    ] });
    expect(out.value).toBe(60);
    expect(out.topPorts).toEqual(["Shanghai", "LA"]);
  });
  it("returns null value when no congestion data", () => {
    expect(aggregatePortCongestion({ ports: [{ name: "X", congestion: null }] })).toEqual({ value: null, topPorts: [] });
    expect(aggregatePortCongestion(null)).toEqual({ value: null, topPorts: [] });
  });
});

describe("pickAirMoM", () => {
  const row = (dest: string, ym: string, kg300: number | null): KitaAirRateRow => ({
    origin: "ICN", dest, region: null, year_mon: ym, kg100: null, kg300, kg500: null, chg100: null, chg300: null, chg500: null,
  });
  it("picks route with largest |MoM| within ±200% and labels it", () => {
    const out = pickAirMoM([
      row("FRA", "202604", 100), row("FRA", "202605", 110), // +10%
      row("JFK", "202604", 100), row("JFK", "202605", 150), // +50%
    ]);
    expect(out.mom).toBeCloseTo(50, 5);
    expect(out.routeLabel).toBe("인천→JFK");
    expect(out.yearMon).toBe("202605");
  });
  it("returns null MoM and fallback label when no usable series", () => {
    expect(pickAirMoM([row("FRA", "202605", 100)])).toEqual({ mom: null, routeLabel: "인천발", yearMon: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- home-view-model`
Expected: FAIL — `Cannot find module '@/lib/home-view-model'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/home-view-model.ts
import type { IndexStats, KitaAirRateRow } from "@/lib/api/rates";
import { orderedTickerStats, latestByRoute, computeMoM } from "@/lib/api/rates";

export type TickerDir = "up" | "down" | "flat";
export type TickerVM = { sym: string; value: string; delta: string; dir: TickerDir };

export function toTickerItems(stats: IndexStats[]): TickerVM[] {
  return orderedTickerStats(stats).map((s) => {
    const p = s.change_pct;
    const dir: TickerDir = p == null || p === 0 ? "flat" : p > 0 ? "up" : "down";
    const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
    const delta = p == null ? "—" : `${glyph} ${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
    return {
      sym: s.index_code,
      value: (s.latest_value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
      delta,
      dir,
    };
  });
}

export type PortCongestionVM = { value: number | null; topPorts: string[] };

export function aggregatePortCongestion(
  snapshot: { ports: { name: string; congestion: number | null }[] } | null,
): PortCongestionVM {
  const ports = (snapshot?.ports ?? []).filter(
    (p): p is { name: string; congestion: number } => p.congestion != null,
  );
  if (ports.length === 0) return { value: null, topPorts: [] };
  const avg = Math.round(ports.reduce((s, p) => s + p.congestion, 0) / ports.length);
  const topPorts = [...ports].sort((a, b) => b.congestion - a.congestion).slice(0, 2).map((p) => p.name);
  return { value: avg, topPorts };
}

export type AirMoMVM = { mom: number | null; routeLabel: string; yearMon: string | null };

export function pickAirMoM(rows: KitaAirRateRow[]): AirMoMVM {
  const top =
    latestByRoute(rows)
      .map((r) => {
        const series = rows
          .filter((a) => a.origin === r.origin && a.dest === r.dest)
          .map((a) => ({ year_mon: a.year_mon, value: a.kg300 }));
        return { r, mom: computeMoM(series) };
      })
      .filter((c) => c.mom !== null && Math.abs(c.mom) <= 200)
      .sort((a, b) => Math.abs(b.mom!) - Math.abs(a.mom!))
      .at(0) ?? null;
  return {
    mom: top?.mom ?? null,
    routeLabel: top ? `인천→${top.r.dest}` : "인천발",
    yearMon: top?.r.year_mon ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- home-view-model`
Expected: PASS (3 describe blocks, 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/home-view-model.ts src/lib/__tests__/home-view-model.test.ts
git commit -m "feat(home): add home view-model pure helpers (ticker/port/air MoM)"
```

---

### Task 2: SiteShell — 홈에서 글로벌 Nav/Footer 건너뛰기

**Files:**
- Modify: `src/routes/__root.tsx` (`SiteShell` 함수)

**Interfaces:**
- Consumes: `useRouterState` (이미 import됨).
- Produces: 동작 변경만 — 새 export 없음.

- [ ] **Step 1: Modify SiteShell to bypass on home**

`SiteShell` 함수 본문 시작부에 홈 분기를 추가한다. 기존 `pathname`/`isThemeTogglePage`/`return`은 유지.

```tsx
function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // 홈(/)은 자체 Nav/Footer를 가진 LogisightHome이 전체 레이아웃을 책임진다 →
  // 글로벌 Navigation/Footer/theme-light 래퍼를 건너뛴다. 다른 라우트는 영향 없음.
  if (pathname === "/") {
    return <>{children}</>;
  }

  const isThemeTogglePage = THEME_TOGGLE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  return (
    <div
      className={`flex min-h-screen flex-col ${isThemeTogglePage ? "" : "theme-light"}`}
      style={{ background: "var(--color-surface)" }}
    >
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck/build**

Run: `bun run build`
Expected: 빌드 성공(타입 에러 없음). 이 시점에서 홈은 기존 `index.tsx` 컴포넌트가 글로벌 셸 없이 렌더됨(헤더/푸터 사라짐) — Task 5에서 샘플 셸로 교체될 때까지 일시적.

- [ ] **Step 3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(home): bypass global nav/footer on / for sample shell"
```

---

### Task 3: Wordmark + HomeNav + HomeFooter

**Files:**
- Create: `src/components/home/Wordmark.tsx`
- Create: `src/components/home/HomeNav.tsx`
- Create: `src/components/home/HomeFooter.tsx`

**Interfaces:**
- Consumes: `Link` from `@tanstack/react-router`.
- Produces:
  - `export function Wordmark(): JSX.Element`
  - `export function HomeNav(): JSX.Element`
  - `export function HomeFooter(): JSX.Element`

**SUB_GNB(인사이트 드롭다운, 기존 Navigation.tsx와 동일):** 종합 `/dashboard` · 전망 `/forecasts` · 운임 `/rates` · 유라시아 `/eurasia` · 포트 `/policy` · 무역 `/trade` · 산업 `/industries` · 기후예측 `/climate`.

- [ ] **Step 1: Create Wordmark (샘플 워드마크 verbatim)**

```tsx
// src/components/home/Wordmark.tsx
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-[9px] text-[18px] font-extrabold tracking-[-0.02em]">
      <span
        className="inline-block h-[18px] w-[9px] -skew-x-12 rounded-[2px]"
        style={{ background: "linear-gradient(180deg,#2dd4bf,#0ea5a0)" }}
      />
      <span>
        <span className="text-white">Logi</span>
        <span className="lsg-ls">s</span>
        <span className="text-[#2dd4bf]">ight</span>
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Create HomeNav (샘플 Nav + 인사이트 드롭다운 + 모바일 메뉴)**

샘플 `Nav`의 마크업/클래스/카피("홈","뉴스","인사이트","KOR · ENG")는 그대로. `href="#"` → `Link`. 인사이트는 호버 드롭다운(데스크톱) + 모바일 햄버거.

```tsx
// src/components/home/HomeNav.tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";

const WRAP = "mx-auto w-full max-w-[1200px] px-[18px] min-[620px]:px-7";

const SUB_GNB = [
  { to: "/dashboard", label: "종합" },
  { to: "/forecasts", label: "전망" },
  { to: "/rates", label: "운임" },
  { to: "/eurasia", label: "유라시아" },
  { to: "/policy", label: "포트" },
  { to: "/trade", label: "무역" },
  { to: "/industries", label: "산업" },
  { to: "/climate", label: "기후예측" },
] as const;

export function HomeNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-[#78a0cd1c] bg-[#070b16cc] backdrop-blur-[14px] backdrop-saturate-150">
      <div className={`${WRAP} flex h-[62px] items-center gap-9`}>
        <Link to="/"><Wordmark /></Link>
        <nav className="hidden gap-[26px] text-[14px] font-medium text-[#93a1b7] min-[620px]:flex">
          <Link to="/" className="relative py-1 text-white">
            홈<span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded bg-[#2dd4bf]" />
          </Link>
          <Link to="/news" className="py-1 transition-colors hover:text-white">뉴스</Link>
          {/* 인사이트 — 호버 드롭다운(기존 SUB_GNB) */}
          <div className="group relative py-1">
            <Link to="/dashboard" className="transition-colors hover:text-white">인사이트</Link>
            <div className="invisible absolute left-0 top-full z-50 min-w-[160px] rounded-[10px] border border-[#78a0cd1c] bg-[#0a0f1d] p-1.5 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100">
              {SUB_GNB.map((s) => (
                <Link key={s.to} to={s.to} className="block rounded-[7px] px-3 py-2 text-[13px] text-[#93a1b7] hover:bg-white/5 hover:text-white">
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <div className="ml-auto hidden text-[13px] text-[#5d6b80] min-[620px]:block">
          <b className="text-white">KOR</b> · ENG
        </div>
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#78a0cd33] text-white min-[620px]:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-[#78a0cd1c] px-[18px] py-2 min-[620px]:hidden">
          <Link to="/" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[15px] text-white">홈</Link>
          <Link to="/news" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[15px] text-[#93a1b7]">뉴스</Link>
          <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d6b80]">Insight</p>
          {SUB_GNB.map((s) => (
            <Link key={s.to} to={s.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[14px] text-[#93a1b7]">
              {s.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 3: Create HomeFooter (샘플 Footer + 실제 링크)**

샘플 `Footer` 마크업/카피("서비스","뉴스","MTL", © 라인)는 그대로. `FOOT_COLS` 링크를 라우트로 연결: 서비스(운임 대시보드 `/rates`, 유라시아 코리도어 `/eurasia`, 산업별 교역 `/industries`) · 뉴스(해상/항공/철도/무역 → `/news` search `{cat}`) · MTL(회사소개 `https://mtlship.com`, 뉴스레터 구독 `#newsletter`, 영업 문의 `mailto:sales@mtlship.com`).

```tsx
// src/components/home/HomeFooter.tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

const WRAP = "mx-auto w-full max-w-[1200px] px-[18px] min-[620px]:px-7";

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h6 className="mb-[13px] text-[11px] font-bold uppercase tracking-[0.12em] text-[#93a1b7]">{title}</h6>
      {children}
    </div>
  );
}
const itemCls = "block py-[5px] text-[#5d6b80] transition-colors hover:text-[#2dd4bf]";

export function HomeFooter() {
  return (
    <footer className="border-t border-[#78a0cd1c] bg-[#060912] pt-12 pb-[30px] text-[13px] text-[#5d6b80]">
      <div className={WRAP}>
        <div className="grid grid-cols-1 gap-[30px] border-b border-[#78a0cd1c] pb-[30px] min-[980px]:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mb-3.5 mt-2.5 max-w-[240px] leading-[1.55] text-[#93a1b7]">(주)MTL이 운영하는 물류 인텔리전스</p>
          </div>
          <Col title="서비스">
            <Link to="/rates" className={itemCls}>운임 대시보드</Link>
            <Link to="/eurasia" className={itemCls}>유라시아 코리도어</Link>
            <Link to="/industries" className={itemCls}>산업별 교역</Link>
          </Col>
          <Col title="뉴스">
            {(["해상", "항공", "철도", "무역"] as const).map((cat) => (
              <Link key={cat} to="/news" search={{ cat }} className={itemCls}>{cat}</Link>
            ))}
          </Col>
          <Col title="MTL">
            <a href="https://mtlship.com" target="_blank" rel="noopener noreferrer" className={itemCls}>회사소개</a>
            <a href="#newsletter" className={itemCls}>뉴스레터 구독</a>
            <a href="mailto:sales@mtlship.com" className={itemCls}>영업 문의</a>
          </Col>
        </div>
        <div className="pt-[22px] lsg-mono text-[11.5px] leading-[1.8] text-[#445064]">
          Logisight is operated by MTL Shipping Agency. · 공공데이터 출처: PORT-MIS · 관세청 · 해양수산부<br />
          © 2026 MTL Shipping Agency. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Verify typecheck/build**

Run: `bun run build`
Expected: 빌드 성공. `/news` search 파라미터 `{cat}`이 기존 news 라우트 search 스키마와 일치하는지 타입에서 확인(불일치 시 Footer의 `search={{ cat }}` 키를 news 라우트 스키마에 맞춰 수정).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/Wordmark.tsx src/components/home/HomeNav.tsx src/components/home/HomeFooter.tsx
git commit -m "feat(home): add sample Nav (with insight dropdown) and Footer with real links"
```

---

### Task 4: LogisightHome 본문 (Ticker/Hero/LivePanel/Brief/News/Sidebar/Insight)

**Files:**
- Create: `src/components/home/LogisightHome.tsx`

**Interfaces:**
- Consumes: `HomeNav`, `HomeFooter` (Task 3); `toTickerItems`, `aggregatePortCongestion`, `pickAirMoM` (Task 1); query options + `NewsletterForm` + `articleParam` + signals.
- Produces: `export function LogisightHome(): JSX.Element` (default export 아님 — named).

샘플 `LogisightHome.tsx`의 마크업/클래스/디자인 카피는 그대로 포팅하되, 더미 배열을 아래 데이터로 치환한다.

- [ ] **Step 1: 셸 + STYLE + 데이터 훅 골격 작성**

샘플의 `STYLE` 문자열(lsg-* 클래스/애니메이션)과 `WRAP` 상수, 아이콘(`IconTrend/IconPort/IconRisk/IconPlane`), `HeroArt`, `Spark`, `SparkBars`, `SecLabel`은 샘플 그대로 복사한다. 최상위 컴포넌트는 데이터를 구독하고 하위 섹션에 전달한다.

```tsx
// src/components/home/LogisightHome.tsx (상단)
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { indexStatsQueryOptions, freightIndicesHistoryQueryOptions, kitaAirRatesQueryOptions } from "@/lib/api/rates";
import { riskSnapshotQueryOptions } from "@/lib/api/risk";
import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import { latestRatesBriefQueryOptions, isFresh } from "@/lib/api/rates-brief";
import { latestNewsQueryOptions, formatPublishedAt } from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";
import { latestBriefingQueryOptions, formatBriefingDate } from "@/lib/api/briefing";
import { articleParam } from "@/lib/api/article";
import { computeOceanPressureSignal, computeAirModalShiftSignal, type FreightIndexPoint } from "@/server/signals";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { toTickerItems, aggregatePortCongestion, pickAirMoM } from "@/lib/home-view-model";
import { HomeNav } from "./HomeNav";
import { HomeFooter } from "./HomeFooter";

const WRAP = "mx-auto w-full max-w-[1200px] px-[18px] min-[620px]:px-7";
// const STYLE = `...샘플 STYLE 그대로...`;
// 샘플의 IconTrend/IconPort/IconRisk/IconPlane, HeroArt, Spark, SparkBars 그대로 복사

export function LogisightHome() {
  return (
    <div className="lsg-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <HomeNav />
      <Ticker />
      <Hero />
      <div className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1]" style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}>
        <LivePanel />
        <Body />
        <Insight />
      </div>
      <HomeFooter />
    </div>
  );
}
```

- [ ] **Step 2: Ticker — 실데이터**

샘플 `Ticker` 마크업 유지, `INDICES` 더미 제거. `toTickerItems(indexStats)`로 렌더. 데이터 0건이면 티커 숨김.

```tsx
function Ticker() {
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const items = toTickerItems(stats);
  if (items.length === 0) return null;
  const row = [...items, ...items];
  return (
    <div className="lsg-ticker overflow-hidden border-b border-[#78a0cd1c]" style={{ background: "linear-gradient(180deg,#0a0f1d,#070b16)" }}>
      <div className="lsg-track flex w-max">
        {row.map((it, i) => (
          <div key={i} className="flex items-center gap-[9px] whitespace-nowrap border-r border-[#78a0cd1c] px-[22px] py-2.5 text-[12.5px]">
            <b className="font-semibold tracking-[0.04em] text-[#93a1b7]">{it.sym}</b>
            <span className="lsg-mono font-medium text-[#e9eef7]">{it.value}</span>
            <span className={`lsg-mono text-[11.5px] ${it.dir === "up" ? "text-[#22c55e]" : it.dir === "down" ? "text-[#f43f5e]" : "text-[#94a3b8]"}`}>{it.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Hero — 칩 실데이터**

샘플 `Hero` 마크업/카피 유지. 두 버튼 → `Link`(이번 주 분석 보기 `/forecasts` search `{ dir: [], series: [] }`; 운임 대시보드 `/rates`). 칩: 기준일 = KCCI `latest_date`, 활성 리스크 = `alerts.length`. 값 없으면 칩 자체 생략.

```tsx
function Hero() {
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const asOf = stats.find((s) => s.index_code === "KCCI")?.latest_date?.slice(0, 10) ?? null;
  const alertCount = alerts.length;
  return (
    <section className="relative overflow-hidden bg-[#070b16]">
      {/* 샘플 HeroArt + 그라디언트 오버레이 그대로 */}
      <div className="pointer-events-none absolute inset-0">
        <HeroArt className="absolute right-[-4%] top-1/2 w-[780px] max-w-[72%] -translate-y-1/2 opacity-90" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 80% 30%, rgba(45,212,191,.10), transparent 55%), linear-gradient(90deg, #070b16 30%, rgba(7,11,22,.4) 62%, transparent 100%)" }} />
      </div>
      <div className={`${WRAP} relative z-[1]`}>
        <div className="max-w-[660px] pt-14 pb-16 min-[620px]:pt-[84px] min-[620px]:pb-24">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">Logistics Intelligence Platform</span>
          <h1 className="mt-[18px] text-[clamp(38px,5.4vw,62px)] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#e9eef7]">물류를 읽는<br /><span className="text-[#2dd4bf]">새로운 시선</span></h1>
          <p className="mt-[22px] max-w-[520px] text-[17px] leading-[1.6] text-[#93a1b7]">운임 지수, 교역 흐름, 정책 변화 동향을 한 화면에서 분석하세요.<br />흩어진 데이터를 구조화해 빠르게 판단할 인텔리전스를 제공합니다.</p>
          <div className="mt-[34px] flex flex-wrap gap-3">
            <Link to="/forecasts" search={{ dir: [], series: [] }} className="rounded-[9px] bg-[#2dd4bf] px-[22px] py-[13px] text-[14.5px] font-semibold text-[#04231f] transition-transform hover:-translate-y-px" style={{ boxShadow: "0 8px 28px -10px rgba(45,212,191,.6)" }}>이번 주 분석 보기</Link>
            <Link to="/rates" className="rounded-[9px] border border-[#78a0cd33] bg-white/5 px-[22px] py-[13px] text-[14.5px] font-semibold text-[#e9eef7] transition-transform hover:-translate-y-px hover:bg-white/10">운임 대시보드 →</Link>
          </div>
          <div className="mt-[30px] flex flex-wrap gap-2.5">
            {asOf && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]"><span className="h-[7px] w-[7px] rounded-full bg-[#2dd4bf]" />기준일 <span className="lsg-mono text-[12px] text-[#e9eef7]">{asOf}</span></span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]"><span className="h-[7px] w-[7px] rounded-full bg-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.16)]" />활성 리스크 <span className="lsg-mono text-[12px] text-[#e9eef7]">{alertCount}건</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: LivePanel + 4개 MarketCard — 실데이터/AI narrative**

샘플 `MarketCard`/`LivePanel` 마크업·라벨("운임 · FREIGHT" 등)·"LIVE INTELLIGENCE"·출처 카피는 그대로. 각 카드의 값·delta·풋노트만 실데이터/시그널로 치환. 값/풋노트 없으면 "데이터 수집 중". 스파크라인은 실 시계열 없으면 생략(가짜 데이터 금지).

```tsx
function fmtPct(p: number | null): { t: string; cls: string } {
  if (p == null) return { t: "—", cls: "text-[#828d9d]" };
  const cls = p > 0 ? "text-[#16a34a]" : p < 0 ? "text-[#e11d48]" : "text-[#828d9d]";
  const g = p > 0 ? "▲ +" : p < 0 ? "▼ " : "— ";
  return { t: `${g}${p.toFixed(2)}%`, cls };
}

function LivePanel() {
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: risk } = useSuspenseQuery(riskSnapshotQueryOptions());

  const kcci = stats.find((s) => s.index_code === "KCCI") ?? null;
  const kcciSeries: FreightIndexPoint[] = history
    .filter((r) => r.index_code === "KCCI")
    .map((r) => ({ week_date: r.week_date, value: r.value, change_pct: r.change_pct }));
  const ocean = computeOceanPressureSignal(kcciSeries);

  const air = pickAirMoM(airRates);
  const airSignal = computeAirModalShiftSignal(air.mom, air.routeLabel, kcci?.pct_52w ?? null, air.yearMon);

  const port = aggregatePortCongestion(risk);
  const NA = "데이터 수집 중";

  return (
    <section className="pt-10 pb-[14px]">
      <div className={WRAP}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-[18px]">
          <div className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[#1a2433]">
            <span className="inline-flex items-center gap-[7px] text-[11px] tracking-[0.14em] text-[#0d9488]">
              <span className="lsg-pulse relative h-[7px] w-[7px] rounded-full bg-[#14b8a6]" />LIVE INTELLIGENCE
            </span>
            <span>· 시장 핵심 요약</span>
          </div>
          <div className="text-[12px] normal-case tracking-normal text-[#828d9d]">업데이트 <b className="font-medium text-[#54606f]">주간 단위</b> · 출처 PORT-MIS · 관세청 · 해양수산부</div>
        </div>
        <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-4">
          {/* ① 운임 FREIGHT */}
          <MarketCard
            label="운임 · FREIGHT" icon={<IconTrend />} dot="bg-[#d97706]"
            value={kcci?.latest_value != null ? kcci.latest_value.toLocaleString("en-US") : NA}
            delta={fmtPct(kcci?.change_pct ?? null)}
            unit="KCCI"
            foot={ocean ? ocean.basis : NA}
          />
          {/* ② 항만 PORT */}
          <MarketCard
            label="항만 · PORT" icon={<IconPort />} dot="bg-[#d97706]"
            value={port.value != null ? <>{port.value}<small className="text-[15px] text-[#828d9d]"> /100</small></> : NA}
            delta={{ t: "혼잡도 지수", cls: "text-[#828d9d]" }}
            unit="주요 항만 평균"
            foot={port.topPorts.length ? `상위 혼잡: ${port.topPorts.join(" · ")}` : NA}
          />
          {/* ③ 리스크 RISK */}
          <MarketCard
            label="리스크 · RISK" icon={<IconRisk />} dot="bg-[#ef4444]"
            value={<>{alerts.length}<small className="text-[15px] text-[#828d9d]"> 건</small></>}
            delta={{ t: alerts.length ? "활성" : "안정", cls: alerts.length ? "text-[#e11d48]" : "text-[#16a34a]" }}
            unit="주요 해협 모니터링"
            foot={alerts[0]?.title ?? NA}
          />
          {/* ④ 항공 AIR — KITA 항공운임 MoM(%) */}
          <MarketCard
            label="항공 · AIR" icon={<IconPlane />} dot="bg-[#16a34a]"
            value={air.mom != null ? <>{air.mom >= 0 ? "+" : ""}{air.mom.toFixed(1)}<small className="text-[15px] text-[#828d9d]">% MoM</small></> : NA}
            delta={fmtPct(air.mom)}
            unit={`${air.routeLabel} · KITA 항공운임`}
            foot={airSignal ? airSignal.basis : NA}
          />
        </div>
      </div>
    </section>
  );
}
```

`MarketCard`는 샘플 마크업을 props 기반으로 단순화(스파크 인자 제거, 값/풋노트 ReactNode 허용):

```tsx
function MarketCard({ label, icon, value, delta, unit, foot, dot }: {
  label: string; icon: React.ReactNode; value: React.ReactNode;
  delta: { t: string; cls: string }; unit: string; foot: React.ReactNode; dot: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[14px] border border-[#d4dce7] bg-[#f1f4f8] pt-5 px-[18px] pb-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[#c5cfdc] hover:shadow-[0_16px_34px_-20px_rgba(16,24,40,0.28)]">
      <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#0d9488] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#0d9488]">{label}</span>
        <span className="text-[#828d9d]">{icon}</span>
      </div>
      <div className="lsg-mono text-[30px] font-bold leading-none tracking-[-0.02em] text-[#1a2433]">{value}</div>
      <div className="mt-[7px] flex items-baseline gap-2.5">
        <span className={`lsg-mono text-[13px] ${delta.cls}`}>{delta.t}</span>
        <span className="text-[12px] text-[#828d9d]">{unit}</span>
      </div>
      <div className="mt-3.5 flex items-center gap-2 border-t border-[#d4dce7] pt-[11px] text-[12px] text-[#54606f]">
        <span className={`h-[7px] w-[7px] flex-none rounded-full ${dot}`} />{foot}
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Body — Brief(AI) + NewsSection + Sidebar**

`Body`/`SecLabel` 레이아웃 유지. `SecLabel`의 "운임 대시보드 전체 보기 →" 링크 → `/rates`("전체 보기 →" 뉴스는 `/news`). 

**Brief** — 샘플 `Brief` 마크업·라벨("WEEKLY BRIEF","전망 ·","출처 ·") 유지, 본문은 `latestRatesBrief`(AI). fresh 아니면 본문 영역 "데이터 수집 중":

```tsx
function Brief() {
  const { data: brief } = useSuspenseQuery(latestRatesBriefQueryOptions());
  const fresh = isFresh(brief);
  const prose = fresh ? brief!.prose_json : null;
  const asOf = fresh ? brief!.as_of.slice(0, 10) : null;
  const bullets = prose ? [prose.ocean, prose.global, prose.air].filter(Boolean) : [];
  return (
    <article className="relative overflow-hidden rounded-[16px] border border-[#d4dce7] bg-[#f1f4f8] p-[26px] shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      <div className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#14b8a6,transparent 70%)" }} />
      <div className="mb-3.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.04em] text-[#0d9488]"><span className="h-[6px] w-[6px] rounded-full bg-[#14b8a6]" />WEEKLY BRIEF</span>
        {asOf && <span className="lsg-mono text-[12px] text-[#828d9d]">기준 {asOf}</span>}
      </div>
      {!prose ? (
        <p className="rounded-[8px] border border-dashed border-[#c5cfdc] bg-white/40 px-4 py-8 text-center text-[14px] text-[#828d9d]">데이터 수집 중</p>
      ) : (
        <>
          <h3 className="mb-3 text-[22px] font-bold leading-[1.35] tracking-[-0.025em] text-[#1a2433]">{prose.headline}</h3>
          <ul className="my-1 flex flex-col gap-[11px]">
            {bullets.map((b, i) => (
              <li key={i} className="relative pl-[18px] text-[14.5px] leading-[1.6] text-[#54606f]">
                <span className="absolute left-0 top-[9px] h-[6px] w-[6px] rounded-full bg-[#14b8a6]" />{b}
              </li>
            ))}
          </ul>
          {prose.outlook && (
            <div className="mt-[18px] rounded-[8px] border border-l-[3px] border-[#ccfbf1] border-l-[#0d9488] bg-[#e9f8f4] px-[15px] py-[13px] text-[13.5px] text-[#0f5f57]"><b className="font-bold text-[#0d9488]">전망 ·</b> {prose.outlook}</div>
          )}
        </>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-[#d4dce7] pt-3.5 text-[12px] text-[#828d9d]"><span>출처 · KCCI · SCFI · WCI · KITA 항공</span><Link to="/rates" className="font-semibold text-[#0d9488]">상세 분석 →</Link></div>
    </article>
  );
}
```

**NewsSection** — 샘플 마크업·탭 유지. 데이터 `latestNews(ko, 12)`, 탭 필터(`category`), featured=filtered[0], 카드=slice(1,7). featured/카드 → `Link to="/article/$slug" params={{slug: articleParam(item)}}`. "전체 보기 →" → `/news`. 데이터 0건이면 "수집 예정". (기존 `index.tsx` `NewsBlock` 로직 재사용, 마크업만 샘플 스타일로.)

**Sidebar** — 샘플 마크업·카피 유지. 주간 브리핑 = `latestBriefing`(없으면 "데이터 수집 중"). 브리핑 링크/전체 분석 → `/briefing`. 뉴스레터 입력은 샘플 raw input 대신 `<NewsletterForm compact />`(실제 작동)로 교체하고 주변 카피 유지. 광고 카드는 샘플 그대로(`mailto:sales@mtlship.com` 링크로 감쌈).

```tsx
function Sidebar() {
  const { data } = useSuspenseQuery(latestBriefingQueryOptions());
  const briefing = data?.briefing ?? null;
  const points = data?.points ?? [];
  return (
    <aside className="flex flex-col gap-[18px] min-[980px]:sticky min-[980px]:top-[82px]">
      <div className="rounded-[14px] border border-[#d4dce7] bg-[#f1f4f8] p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-[#0d9488]">주간 인사이트</div>
        <h3 className="mb-1 text-[18px] font-bold tracking-[-0.02em] text-[#1a2433]">{briefing?.title ?? "주간 시장 브리핑"}</h3>
        {briefing?.week_of && <div className="mb-4 lsg-mono text-[11.5px] text-[#828d9d]">{formatBriefingDate(briefing.week_of)} · 시황 · 기업 · 글로벌</div>}
        {!briefing ? (
          <p className="rounded-md border border-dashed border-[#c5cfdc] bg-white/40 px-3 py-6 text-center text-[13px] text-[#828d9d]">데이터 수집 중</p>
        ) : (
          <>
            {(["shipping", "corp", "brief"] as const).map((cat, i) => {
              const item = points.find((p) => p.agent_type === cat) ?? points.find((p) => p.category === cat);
              const label = cat === "shipping" ? "시황 · By Shipping" : cat === "corp" ? "기업 · By Corp" : "글로벌 · By Brief";
              return (
                <Link key={cat} to="/briefing" className={`group block border-t border-[#d4dce7] py-[13px] ${i === 0 ? "border-t-0 pt-0" : ""}`}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#828d9d]">{label}</span>
                  <div className="mt-[5px] text-[14px] font-semibold leading-[1.45] tracking-[-0.015em] text-[#1a2433] transition-colors group-hover:text-[#0d9488]">{item?.headline ?? "수집 예정"}</div>
                </Link>
              );
            })}
            <div className="mt-4 flex items-center justify-between border-t border-[#d4dce7] pt-3.5 text-[11.5px] text-[#828d9d]">
              <span className="lsg-mono">{formatBriefingDate(briefing.published_at)} 발행 · 매주 월요일</span>
              <Link to="/briefing" className="font-semibold text-[#0d9488]">전체 분석 →</Link>
            </div>
          </>
        )}
      </div>

      {/* 뉴스레터 — 샘플 카피 유지, 입력은 작동하는 NewsletterForm */}
      <div id="newsletter" className="rounded-[14px] border border-[#2dd4bf47] p-5 shadow-[0_18px_40px_-24px_rgba(13,80,73,0.6)]" style={{ background: "linear-gradient(150deg,#0e1626,#0c2a2a)" }}>
        <h3 className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.02em] text-white">📨 주간 뉴스레터</h3>
        <p className="mb-3.5 mt-2 text-[13px] text-[#9fb2c4]">매주 월요일, 한 편의 분석으로 정리해 보내드립니다.</p>
        <NewsletterForm compact />
        <small className="mt-2.5 block text-[11px] text-[#5d6b80]">주 1회 발송 · 언제든 구독 해지 가능</small>
      </div>

      {/* 광고 — 샘플 그대로 */}
      <a href="mailto:sales@mtlship.com" className="block rounded-[14px] border border-dashed border-[#c5cfdc] bg-[#f1f4f8] p-4">
        <div className="mb-[11px] flex justify-between text-[10px] uppercase tracking-[0.1em] text-[#828d9d]"><span>Sponsored · 광고</span><span>MTL Shipping Agency</span></div>
        <div className="flex items-center gap-3">
          <div className="grid h-[54px] w-[54px] flex-none place-items-center rounded-[10px] text-[15px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#c0392b,#7d2018)" }}>MTL</div>
          <div className="text-[13px] font-semibold leading-[1.4] text-[#1a2433]">MTL Truck LCL 서비스<span className="mt-[3px] block text-[11.5px] font-normal text-[#54606f]">빠른 출발 · 신뢰성 있는 배송 · 소형 화물 최적</span></div>
        </div>
      </a>
    </aside>
  );
}
```

NewsSection 구현(기존 NewsBlock 로직 재사용):

```tsx
const NEWS_TABS = ["전체", "해상", "항공", "철도·CIS", "물류", "무역"] as const;
type NewsTab = (typeof NEWS_TABS)[number];

function NewsSection() {
  const [tab, setTab] = useState<NewsTab>("전체");
  const { data } = useSuspenseQuery(latestNewsQueryOptions({ lang: "ko", limit: 12 }));
  const all = data ?? [];
  const filtered = tab === "전체" ? all : all.filter((n) => (n.category ?? "") === tab);
  const featured = filtered[0];
  const rest = filtered.slice(1, 7);
  return (
    <div className="mt-10">
      <SecLabel title="오늘의 뉴스" link="전체 보기 →" to="/news" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {NEWS_TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={t === tab
            ? "cursor-pointer rounded-full border border-[#14b8a6] bg-[#14b8a6] px-[13px] py-1.5 text-[12.5px] font-semibold text-[#04231f]"
            : "cursor-pointer rounded-full border border-[#d4dce7] bg-[#f1f4f8] px-[13px] py-1.5 text-[12.5px] text-[#54606f] transition-colors hover:border-[#0d9488] hover:text-[#0d9488]"}>{t}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[#c5cfdc] bg-[#f1f4f8] p-8 text-center text-[14px] text-[#828d9d]">수집 예정 (매주 업데이트)</p>
      ) : (
        <>
          {featured && <FeaturedCard item={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
              {rest.map((n) => <SmallCard key={n.id} item={n} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

`FeaturedCard`/`SmallCard`는 샘플의 featured/grid 마크업을 사용하되 텍스트를 `item.title`/`item.summary`/`item.category`/`item.source`+`formatPublishedAt(item.published_at)`로 치환하고 `Link to="/article/$slug" params={{ slug: articleParam(item) }}`로 감싼다. featured 이미지 영역은 `item.image_url` 있으면 배경 이미지, 없으면 샘플의 그라디언트+✈ 플레이스홀더 유지. `SecLabel`은 `to` prop을 받아 `<Link>`로 렌더하도록 확장(샘플 `<a href="#">` → `Link`).

- [ ] **Step 6: Insight — 링크 연결(카피 유지)**

샘플 `Insight`/`INSIGHTS` 카피 그대로. 3카드 → `Link`: [↗ 무역 인사이트 → `/trade`], [🏭 산업 인사이트 → `/industries`], [⚠️ 리스크 인사이트 → `/policy`]. "전체 보기 →" → `/industries`.

```tsx
const INSIGHTS: { em: string; k: string; h: string; p: string; to: "/trade" | "/industries" | "/policy" }[] = [
  { em: "↗", k: "무역 인사이트", h: "HS 챕터별 수출입 동향", p: "관세청 통계 기준 월간 갱신", to: "/trade" },
  { em: "🏭", k: "산업 인사이트", h: "주요 산업별 물동량 · 운임 동향", p: "업종별 데이터 기반 분석", to: "/industries" },
  { em: "⚠️", k: "리스크 인사이트", h: "주요 항만 disruption 이벤트 추적", p: "실시간 신호등 모니터링", to: "/policy" },
];

function Insight() {
  return (
    <section className="border-t border-[#d4dce7] pt-12 pb-16">
      <div className={WRAP}>
        <SecLabel title="산업별 인사이트" link="전체 보기 →" to="/industries" />
        <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
          {INSIGHTS.map((c) => (
            <Link key={c.k} to={c.to} className="flex gap-3.5 rounded-[13px] border border-[#d4dce7] bg-[#f1f4f8] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#0d9488] hover:shadow-[0_14px_30px_-20px_rgba(13,148,136,0.3)]">
              <span className="flex-none text-[22px]">{c.em}</span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0d9488]">{c.k}</div>
                <h4 className="mb-1 mt-1.5 text-[15px] font-semibold tracking-[-0.015em] text-[#1a2433]">{c.h}</h4>
                <p className="text-[12.5px] leading-[1.5] text-[#54606f]">{c.p}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

`Body` 컴포넌트는 샘플 그대로(좌측 SecLabel "운임 인텔리전스" link "운임 대시보드 전체 보기 →" `to="/rates"` + `<Brief/>` + `<NewsSection/>`, 우측 `<Sidebar/>`).

- [ ] **Step 7: Verify typecheck/build**

Run: `bun run build`
Expected: 빌드 성공. `Link` `to`/`search`/`params` 타입이 라우트 정의와 일치(불일치 시 라우트 정의에 맞춰 수정).

- [ ] **Step 8: Commit**

```bash
git add src/components/home/LogisightHome.tsx
git commit -m "feat(home): port LogisightHome body wired to real data + signals"
```

---

### Task 5: 라우트 연결 — index.tsx loader + 렌더

**Files:**
- Modify: `src/routes/index.tsx` (전체 교체)

**Interfaces:**
- Consumes: `LogisightHome` (Task 4), 모든 query options.
- Produces: 홈 라우트 — 새 export 없음.

- [ ] **Step 1: index.tsx 교체**

기존 head meta는 유지. loader는 LogisightHome이 구독하는 모든 쿼리를 prefetch(+ `riskSnapshotQueryOptions`). 본문 컴포넌트는 `<LogisightHome/>`.

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { indexStatsQueryOptions, freightIndicesHistoryQueryOptions, kitaAirRatesQueryOptions } from "@/lib/api/rates";
import { riskSnapshotQueryOptions } from "@/lib/api/risk";
import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import { latestRatesBriefQueryOptions } from "@/lib/api/rates-brief";
import { latestNewsQueryOptions } from "@/lib/api/news";
import { latestBriefingQueryOptions } from "@/lib/api/briefing";
import { LogisightHome } from "@/components/home/LogisightHome";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    const qc = context.queryClient;
    qc.ensureQueryData(indexStatsQueryOptions());
    qc.ensureQueryData(freightIndicesHistoryQueryOptions());
    qc.ensureQueryData(kitaAirRatesQueryOptions());
    qc.ensureQueryData(alertCandidatesQueryOptions());
    qc.ensureQueryData(riskSnapshotQueryOptions());
    qc.ensureQueryData(latestRatesBriefQueryOptions());
    qc.ensureQueryData(latestNewsQueryOptions({ lang: "ko", limit: 12 }));
    qc.ensureQueryData(latestBriefingQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Logisight — 물류를 읽는 새로운 시선" },
      { name: "description", content: "운임 지수와 시장 뉴스, 정책 변화. 흩어진 정보를 매주 한 편의 분석으로 정리합니다." },
      { property: "og:title", content: "Logisight — 물류를 읽는 새로운 시선" },
      { property: "og:description", content: "운임 지수와 시장 뉴스, 정책 변화. 매주 한 편의 분석으로 정리합니다." },
      { property: "og:url", content: "https://logisight-core.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/" }],
  }),
  component: LogisightHome,
});
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: 빌드 성공. 기존 `index.tsx`가 쓰던 컴포넌트/import(HeroBackdrop, DashboardSection, RatesBrief, DashboardTicker 등)가 모두 제거돼 미사용 import 경고 없음.

- [ ] **Step 3: 수동 검증 (dev 실행)**

Run: `bun run dev` → 브라우저 `http://localhost:3000/`
확인:
- 헤더/푸터가 **1회만** 렌더(샘플 다크 Nav + 다크 Footer, 글로벌 navy nav 없음).
- 티커·히어로 칩·4개 마켓 카드가 실데이터 또는 "데이터 수집 중"으로 채워짐(고정 더미 숫자 없음).
- 인사이트 드롭다운 8항목 hover 동작, 각 라우트 이동.
- 히어로 버튼(`/forecasts`,`/rates`), 뉴스 카드(`/article/$slug`), 브리핑(`/briefing`), 인사이트 카드(`/trade`,`/industries`,`/policy`), 푸터 링크 모두 정상 이동(404 없음).
- 뉴스레터 입력 → 제출 시 NewsletterForm 동작(성공/에러 상태).
- `/news`,`/rates`,`/dashboard` 등 다른 페이지는 기존 글로벌 Nav/Footer 그대로(회귀 없음).

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(home): render LogisightHome on / with real-data loader"
```

---

## Self-Review (작성자 체크 완료)

**Spec coverage:** 헤더/푸터 홈전용(Task 2·3·5) / 인사이트 드롭다운(Task 3) / 더미→실데이터 매핑 12항목(Task 1·4) / AI narrative·하드카피 금지(Task 4 Brief·카드 풋노트) / 항공 MoM(Task 1·4) / 링크 연결(Task 3·4·5) / 데이터 공백 "데이터 수집 중"(Task 4) — 모두 태스크에 대응.

**Placeholder scan:** 코드 스텝은 실제 코드 포함. 샘플 verbatim 복사 지시(STYLE/아이콘/HeroArt/Spark)는 원본이 사용자 제공 코드에 존재 → "TBD" 아님.

**Type consistency:** `TickerVM/PortCongestionVM/AirMoMVM`(Task 1) ↔ Task 4 사용 일치. `ComputedSignal.basis`(시그널) ↔ 카드 foot 일치. `IndexStats.latest_date/pct_52w/change_pct`, `KitaAirRateRow.kg300`, `RiskSnapshot.ports[].congestion/name`, `NewsItem`, `WeeklyBriefingPayload.points[].agent_type/headline`, `RatesBriefProse.headline/ocean/global/air/outlook` 모두 실제 정의와 일치 확인.

**알려진 리스크:** `riskSnapshotQueryOptions`는 외부 econdb 의존 — 홈 로딩이 외부 소스에 묶임. 비거나 느리면 항만 카드 "데이터 수집 중"으로 폴백(하드 제약 충족). `/news` 라우트 search 스키마와 Footer `search={{ cat }}` 키 일치는 Task 3 Step 4에서 빌드로 확인.
