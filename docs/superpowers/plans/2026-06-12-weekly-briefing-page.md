# 주간 브리핑 전용 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/briefing` 전용 페이지를 만들어 `weekly_briefings.content`(주간 분석 본문)와 헤드라인 3건을 렌더하고, 홈 카드의 "전체 분석 읽기 →"를 그 페이지로 연결한다.

**Architecture:** 기존 서버 함수 `getLatestBriefing`/`latestBriefingQueryOptions`를 재사용하는 단일 TanStack Start 파일 라우트(`src/routes/briefing.tsx`). 기사 페이지(`article.$slug.tsx`)의 레이아웃·ReactMarkdown 패턴을 따른다. API/서버 함수 추가 없음.

**Tech Stack:** React + TypeScript, TanStack Start(파일 라우트, loader, head), TanStack Query(useSuspenseQuery), react-markdown, Tailwind(디자인 토큰 var(--color-*)), Vite.

**Repo:** logisight-core (c:\Users\DELL\Documents\logisight-core)

**Spec:** `docs/superpowers/specs/2026-06-12-weekly-briefing-page-design.md`

**참고 — 검증 방식:** 순수 로직이 없어 단위 테스트 대상이 없다. 검증은 `npm run build`(타입체크 포함 vite build) 통과 + 라우트 등록 확인으로 한다. TanStack Router는 파일 라우트를 기반으로 `routeTree.gen.ts`를 자동 생성하므로(dev/build 시) `briefing.tsx`만 추가하면 `/briefing`이 등록된다.

**기존 자산 (그대로 사용):**
- `latestBriefingQueryOptions()` — `@/lib/api/briefing` (react-query options, getLatestBriefing 호출).
- 타입 `WeeklyBriefingPayload = { briefing: BriefingRow | null; points: BriefingPoint[] }`, `BriefingRow = { id,title,subtitle,week_of,content,published_at }`, `BriefingPoint = { id,briefing_id,category,agent_type,headline,display_order }`.
- `formatBriefingDate(iso)` — `@/lib/api/briefing`.
- 홈 카드 슬롯 매칭 로직(참고용): `points.find(p => p.agent_type === cat) ?? points.find(p => p.category === cat)`, 라벨 `{shipping:"시황",corp:"기업",brief:"글로벌"}`.

---

### Task 1: `/briefing` 라우트 페이지 생성

**Files:**
- Create: `src/routes/briefing.tsx`

- [ ] **Step 1: 라우트 파일 작성**

`src/routes/briefing.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import {
  latestBriefingQueryOptions,
  formatBriefingDate,
} from "@/lib/api/briefing";
import type { BriefingPoint } from "@/lib/api/briefing";

const SLOTS = [
  { key: "shipping", label: "시황" },
  { key: "corp", label: "기업" },
  { key: "brief", label: "글로벌" },
] as const;

const DEFAULT_DESC = "이번 주 해운·항공·철도·무역 시장의 핵심 이슈를 한눈에 정리한 주간 브리핑.";

export const Route = createFileRoute("/briefing")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(latestBriefingQueryOptions());
    return { subtitle: data?.briefing?.subtitle ?? null };
  },
  head: ({ loaderData }) => {
    const subtitle = loaderData?.subtitle;
    const desc = subtitle && subtitle.trim().length > 0 ? subtitle : DEFAULT_DESC;
    const url = "https://logisight-core.lovable.app/briefing";
    return {
      meta: [
        { title: "주간 시장 브리핑 — Logisight" },
        { name: "description", content: desc },
        { property: "og:title", content: "주간 시장 브리핑 — Logisight" },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BriefingPage,
});

function PointCard({ point, label }: { point: BriefingPoint | undefined; label: string }) {
  return (
    <div className="h-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-alt,#f7f9fc)] p-4">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
        <span style={{ color: "var(--color-cyan)" }}>{label}</span>
        {point && (
          <span className="text-[var(--color-ink-muted)]/70">
            BY {point.agent_type.toUpperCase()}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-[var(--color-ink)]" style={{ wordBreak: "keep-all" }}>
        {point?.headline ?? "수집 예정"}
      </p>
    </div>
  );
}

function BriefingPage() {
  const { data } = useSuspenseQuery(latestBriefingQueryOptions());
  const briefing = data?.briefing ?? null;
  const points = data?.points ?? [];

  if (!briefing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
        >
          주간 인사이트
        </span>
        <h1 className="mt-4 text-2xl font-bold text-[var(--color-ink)]">주간 시장 브리핑</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">이번 주 브리핑을 준비 중입니다.</p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]/80">매주 월요일 발행</p>
        <Link to="/news" className="mt-6 inline-block text-sm font-semibold text-[var(--color-navy-600)] underline">
          시장 뉴스로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:py-14">
      <header className="border-b border-[var(--color-line)] pb-6">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
        >
          주간 인사이트
        </span>
        <h1
          className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] lg:text-4xl"
          style={{ wordBreak: "keep-all" }}
        >
          {briefing.title}
        </h1>
        {briefing.subtitle && (
          <p className="mt-3 text-base text-[var(--color-ink-muted)]">{briefing.subtitle}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-ink-muted)]">
          <time dateTime={briefing.week_of}>{formatBriefingDate(briefing.week_of)} 주간</time>
          <span>·</span>
          <span>{formatBriefingDate(briefing.published_at)} 발행</span>
        </div>
      </header>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {SLOTS.map(({ key, label }) => {
          const point =
            points.find((p) => p.agent_type === key) ??
            points.find((p) => p.category === key);
          return (
            <li key={key}>
              <PointCard point={point} label={label} />
            </li>
          );
        })}
      </ul>

      {briefing.content && briefing.content.trim().length > 0 ? (
        <div
          className="prose prose-neutral mt-10 max-w-none text-[var(--color-ink)]"
          style={{ lineHeight: 1.8, wordBreak: "keep-all" }}
        >
          <ReactMarkdown>{briefing.content}</ReactMarkdown>
        </div>
      ) : (
        <div
          className="mt-10 rounded-lg border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-navy-900)_4%,white)] p-6 text-sm text-[var(--color-ink-muted)]"
          style={{ lineHeight: 1.8, wordBreak: "keep-all" }}
        >
          이번 주 분석은 준비 중입니다.
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--color-line)] pt-6">
        <Link to="/news" className="text-sm font-semibold text-[var(--color-navy-600)] underline">
          시장 뉴스 전체 보기 →
        </Link>
      </footer>
    </article>
  );
}
```

- [ ] **Step 2: 빌드(타입체크 포함)로 라우트 등록·타입 확인**

Run: `npm run build`
Expected: 성공. 빌드 과정에서 TanStack Router가 `routeTree.gen.ts`를 갱신해 `/briefing`이 등록되고, `<Link to="/briefing">`(Task 2)가 타입상 유효해진다. 타입 에러 0.

만약 `BriefingPoint` import 경로 타입 에러가 나면 `@/lib/api/briefing`에서 `BriefingPoint`/`BriefingRow`가 export되는지 확인한다(이미 export됨).

- [ ] **Step 3: 커밋**

```bash
git add src/routes/briefing.tsx
git commit -m "feat(briefing): /briefing page rendering weekly briefing content + headlines"
```

---

### Task 2: 홈 카드 링크를 `/briefing`으로 변경

**Files:**
- Modify: `src/routes/index.tsx` (WeeklyBriefingBlock 내 "전체 분석 읽기" 링크)

- [ ] **Step 1: 링크 변경**

`src/routes/index.tsx`에서 다음을 찾는다:

```tsx
            <Link to="/news" className="font-semibold text-[var(--color-navy-600)]">
              전체 분석 읽기 →
            </Link>
```

다음으로 교체:

```tsx
            <Link to="/briefing" className="font-semibold text-[var(--color-navy-600)]">
              전체 분석 읽기 →
            </Link>
```

주의: `index.tsx`에는 `<Link to="/news">`가 여러 곳 있을 수 있다. **반드시 "전체 분석 읽기 →" 텍스트를 가진 그 링크만** 변경한다(WeeklyBriefingBlock 내부, 약 361번째 줄). 다른 `/news` 링크는 건드리지 않는다.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공, 타입 에러 0. `to="/briefing"`이 Task 1에서 등록된 라우트와 매칭되어 타입 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/routes/index.tsx
git commit -m "feat(briefing): link home weekly card to /briefing"
```

---

### Task 3: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 빌드 전체 통과 확인**

Run: `npm run build`
Expected: 성공, 타입 에러·라우트 에러 0.

- [ ] **Step 2: 스펙 검증 기준 대조**

스펙 `2026-06-12-weekly-briefing-page-design.md`의 기준 5개:
1. `npm run build` 통과 — Step 1.
2. `/briefing` 헤더+헤드라인 3개+본문 표시 — Task 1 컴포넌트 구조.
3. 홈 "전체 분석 읽기 →"가 `/briefing`으로 — Task 2.
4. content 없는 주: "준비 중" 안내, 페이지 안 깨짐 — Task 1 조건부 렌더.
5. briefing null: 빈 상태 안내 — Task 1 early return.

- [ ] **Step 3: 로컬 확인 안내 + push**

```bash
npm run dev
```

브라우저에서 `/briefing` 접속 → 이번 주(week_of=2026-06-08) 브리핑의 헤드라인 3개 + 분석 본문 표시 확인. 홈(`/`)에서 "전체 분석 읽기 →" 클릭 시 `/briefing` 이동 확인. 그 후:

```bash
git push
```

Lovable/배포 환경에서 `/briefing`이 노출되는지 확인(검증 기준 2·3).
