# News Date Archive Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a date navigator to `/news` so users can browse articles by KST day, with URL persistence via `?date=YYYY-MM-DD`.

**Architecture:** Three files change — the Supabase server function gains `dateFrom`/`dateTo` params and an `agent_type` exclusion filter; the query options layer adds a `date` param and derives the KST range; the route file gains a `DateNavigator` component inserted below the category tab bar. Date state lives in the URL search params (`date=YYYY-MM-DD`); absence of `date` means "전체 기간" (no filter).

**Tech Stack:** TanStack Start, TanStack Router, React Query, Supabase JS, Zod, Tailwind CSS, Vitest (added for utility tests)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/api/news.functions.ts` | Add `dateFrom`/`dateTo` to input schema + Supabase `.gte/.lte`; add `agent_type` exclusion |
| Modify | `src/lib/api/news.ts` | Add `date` param to `latestNewsQueryOptions`; export `todayKST()` and `dateToKSTRange()` helpers |
| Modify | `src/routes/news.tsx` | Add `date` to search schema; add `DateNavigator` component; wire into page |
| Create | `src/lib/api/__tests__/news.date.test.ts` | Unit tests for `todayKST()` and `dateToKSTRange()` |
| Modify | `package.json` + `vitest.config.ts` | Add Vitest |

---

## Task 1: Install Vitest and create config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1.1: Install Vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 1.2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 1.3: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.4: Verify Vitest is runnable**

```bash
npx vitest run --reporter=verbose 2>&1 | head -20
```

Expected: "No test files found" or similar (no failures).

- [ ] **Step 1.5: Commit**

```bash
git add package.json vitest.config.ts package-lock.json
git commit -m "chore: add vitest for utility testing"
```

---

## Task 2: Write failing tests for date utilities

**Files:**
- Create: `src/lib/api/__tests__/news.date.test.ts`

- [ ] **Step 2.1: Create test file**

```ts
// src/lib/api/__tests__/news.date.test.ts
import { describe, it, expect } from "vitest";
import { todayKST, dateToKSTRange } from "../news";

describe("todayKST", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const result = todayKST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dateToKSTRange", () => {
  it("returns dateFrom as T00:00:00+09:00", () => {
    const { dateFrom } = dateToKSTRange("2026-05-31");
    expect(dateFrom).toBe("2026-05-31T00:00:00+09:00");
  });

  it("returns dateTo as T23:59:59+09:00", () => {
    const { dateTo } = dateToKSTRange("2026-05-31");
    expect(dateTo).toBe("2026-05-31T23:59:59+09:00");
  });

  it("works for a different date", () => {
    const { dateFrom, dateTo } = dateToKSTRange("2026-01-01");
    expect(dateFrom).toBe("2026-01-01T00:00:00+09:00");
    expect(dateTo).toBe("2026-01-01T23:59:59+09:00");
  });
});
```

- [ ] **Step 2.2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL — `todayKST` and `dateToKSTRange` not exported yet.

---

## Task 3: Add date utilities to `news.ts` and make tests pass

**Files:**
- Modify: `src/lib/api/news.ts`

Current content of `src/lib/api/news.ts` (full file for reference):

```ts
import { queryOptions } from "@tanstack/react-query";
import { getLatestNews } from "./news.functions";

export type NewsItem = { ... }; // unchanged

export const latestNewsQueryOptions = (input: {
  lang?: string;
  limit?: number;
  category?: string;
}) => ...
```

- [ ] **Step 3.1: Add `todayKST` and `dateToKSTRange` exports to `src/lib/api/news.ts`**

Add these two functions **before** `latestNewsQueryOptions`:

```ts
/** Returns today's date in KST as "YYYY-MM-DD". */
export function todayKST(): string {
  // Swedish locale produces ISO date format "YYYY-MM-DD"
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** Given "YYYY-MM-DD", returns KST start-of-day and end-of-day ISO strings. */
export function dateToKSTRange(date: string): {
  dateFrom: string;
  dateTo: string;
} {
  return {
    dateFrom: `${date}T00:00:00+09:00`,
    dateTo: `${date}T23:59:59+09:00`,
  };
}
```

- [ ] **Step 3.2: Add `date` param to `latestNewsQueryOptions`**

Replace the existing `latestNewsQueryOptions` with:

```ts
export const latestNewsQueryOptions = (input: {
  lang?: string;
  limit?: number;
  category?: string;
  date?: string; // "YYYY-MM-DD" — undefined means no date filter
}) => {
  const range = input.date ? dateToKSTRange(input.date) : undefined;
  return queryOptions({
    queryKey: ["maritime_news", "latest", input],
    queryFn: () =>
      getLatestNews({
        data: {
          lang: input.lang ?? "ko",
          limit: input.limit ?? 20,
          category: input.category,
          dateFrom: range?.dateFrom,
          dateTo: range?.dateTo,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });
};
```

- [ ] **Step 3.3: Run tests — expect PASS**

```bash
npm test
```

Expected: all 4 tests PASS.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/api/news.ts src/lib/api/__tests__/news.date.test.ts
git commit -m "feat(news): add todayKST/dateToKSTRange helpers + date param to queryOptions"
```

---

## Task 4: Update server function with date filter and agent_type exclusion

**Files:**
- Modify: `src/lib/api/news.functions.ts`

- [ ] **Step 4.1: Replace the full contents of `src/lib/api/news.functions.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { NewsItem } from "./news";

const SELECT =
  "id,slug,title,summary,url,source,category,image_url,published_at,lang,tags,is_hero";

export const getLatestNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lang: z.string().min(2).max(5).default("ko"),
      limit: z.number().int().min(1).max(50).default(20),
      category: z.string().min(1).max(40).optional(),
      dateFrom: z.string().optional(), // e.g. "2026-05-31T00:00:00+09:00"
      dateTo: z.string().optional(),   // e.g. "2026-05-31T23:59:59+09:00"
    }),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    let q = supabasePublicServer
      .from("maritime_news")
      .select(SELECT)
      .eq("lang", data.lang)
      .not("agent_type", "in", "(daily_card,external)")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.category) q = q.eq("category", data.category);
    if (data.dateFrom) q = q.gte("published_at", data.dateFrom);
    if (data.dateTo)   q = q.lte("published_at", data.dateTo);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as NewsItem[];
  });
```

- [ ] **Step 4.2: Build to verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/api/news.functions.ts
git commit -m "feat(news): add dateFrom/dateTo filter + exclude daily_card/external by agent_type"
```

---

## Task 5: Update route search schema and loader

**Files:**
- Modify: `src/routes/news.tsx` (top of file only)

- [ ] **Step 5.1: Update `newsSearchSchema` to include `date`**

Find this block at the top of `src/routes/news.tsx`:

```ts
const newsSearchSchema = z.object({
  cat: z.string().min(1).max(40).optional(),
});
```

Replace with:

```ts
const newsSearchSchema = z.object({
  cat:  z.string().min(1).max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

- [ ] **Step 5.2: Update `loaderDeps` and `loader` to pass `date`**

Find this block in the `Route` definition:

```ts
loaderDeps: ({ search }) => ({ cat: search.cat }),
loader: ({ context, deps }) =>
  context.queryClient.ensureQueryData(
    latestNewsQueryOptions({ lang: "ko", limit: 40, category: deps.cat }),
  ),
```

Replace with:

```ts
loaderDeps: ({ search }) => ({ cat: search.cat, date: search.date }),
loader: ({ context, deps }) =>
  context.queryClient.ensureQueryData(
    latestNewsQueryOptions({ lang: "ko", limit: 40, category: deps.cat, date: deps.date }),
  ),
```

- [ ] **Step 5.3: Update `NewsPage` component — destructure `date` from search**

Find:

```ts
function NewsPage() {
  const { cat } = Route.useSearch();
  const { data } = useSuspenseQuery(
    latestNewsQueryOptions({ lang: "ko", limit: 40, category: cat }),
  );
```

Replace with:

```ts
function NewsPage() {
  const { cat, date } = Route.useSearch();
  const { data } = useSuspenseQuery(
    latestNewsQueryOptions({ lang: "ko", limit: 40, category: cat, date }),
  );
```

- [ ] **Step 5.4: Build to verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5.5: Commit**

```bash
git add src/routes/news.tsx
git commit -m "feat(news): add date param to route search schema and loader"
```

---

## Task 6: Add `DateNavigator` component and wire into page

**Files:**
- Modify: `src/routes/news.tsx` (component section + new component at bottom)

- [ ] **Step 6.1: Add `todayKST` import to `news.tsx`**

Find the existing import line:

```ts
import {
  latestNewsQueryOptions,
  formatPublishedAt,
} from "@/lib/api/news";
```

Replace with:

```ts
import {
  latestNewsQueryOptions,
  formatPublishedAt,
  todayKST,
} from "@/lib/api/news";
```

- [ ] **Step 6.2: Insert `DateNavigator` below the category nav in `NewsPage`**

In `NewsPage`, find the closing `</nav>` of the section nav inside `<header>`:

```tsx
        </nav>
      </header>
```

Replace with:

```tsx
        </nav>

        {/* Date navigator */}
        <div className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2 lg:px-6">
            <DateNavigator date={date} cat={cat} count={items.length} />
          </div>
        </div>
      </header>
```

- [ ] **Step 6.3: Update section header label based on active date**

In `NewsPage`, find:

```tsx
          <SectionRule label="오늘의 헤드라인" eyebrow="Top Stories" />
```

Replace with:

```tsx
          <SectionRule
            label={date ? `${date.replace(/-/g, ".")} 뉴스` : "오늘의 헤드라인"}
            eyebrow="Top Stories"
          />
```

- [ ] **Step 6.4: Add `DateNavigator` component at the bottom of `news.tsx`**

Append after the last function in the file (after `Byline`):

```tsx
function DateNavigator({
  date,
  cat,
  count,
}: {
  date: string | undefined;
  cat: string | undefined;
  count: number;
}) {
  const today = todayKST();
  const displayDate = date ?? today;

  function prevDay(d: string): string {
    const dt = new Date(`${d}T12:00:00+09:00`);
    dt.setDate(dt.getDate() - 1);
    return dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  }

  function nextDay(d: string): string {
    const dt = new Date(`${d}T12:00:00+09:00`);
    dt.setDate(dt.getDate() + 1);
    return dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  }

  const isToday = displayDate >= today;
  const baseSearch = cat ? { cat } : {};

  return (
    <div className="flex items-center gap-3 text-[13px]">
      {/* Prev arrow */}
      <Link
        to="/news"
        search={{ ...baseSearch, date: prevDay(displayDate) }}
        className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-navy-900)] hover:text-[var(--color-navy-900)]"
        aria-label="이전 날짜"
      >
        ←
      </Link>

      {/* Date label */}
      <span className="font-semibold text-[var(--color-navy-900)]">
        {new Date(`${displayDate}T12:00:00+09:00`).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Seoul",
        })}
        {date && (
          <span className="ml-1.5 text-[11px] font-normal text-[var(--color-ink-muted)]">
            ({count}건)
          </span>
        )}
      </span>

      {/* Next arrow — disabled when at today */}
      {isToday ? (
        <span
          className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded border border-[var(--color-line)] text-[var(--color-line)]"
          aria-disabled="true"
          aria-label="다음 날짜"
        >
          →
        </span>
      ) : (
        <Link
          to="/news"
          search={{ ...baseSearch, date: nextDay(displayDate) }}
          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-navy-900)] hover:text-[var(--color-navy-900)]"
          aria-label="다음 날짜"
        >
          →
        </Link>
      )}

      {/* 전체 기간 toggle */}
      <Link
        to="/news"
        search={baseSearch}
        className={`ml-2 rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
          !date
            ? "bg-[var(--color-navy-900)] text-white"
            : "border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-navy-900)] hover:text-[var(--color-navy-900)]"
        }`}
      >
        전체 기간
      </Link>
    </div>
  );
}
```

- [ ] **Step 6.5: Build and verify**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 6.6: Commit**

```bash
git add src/routes/news.tsx
git commit -m "feat(news): add DateNavigator component with prev/next/전체기간"
```

---

## Task 7: Manual smoke test and final commit

- [ ] **Step 7.1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000/news` in browser.

- [ ] **Step 7.2: Verify default state (no date param)**

- DateNavigator shows today's KST date
- "전체 기간" button is active (navy background)
- Articles are visible (not filtered by date)
- URL is `/news` (no `date` param)

- [ ] **Step 7.3: Verify left arrow navigation**

Click `←` arrow once.
- URL changes to `/news?date=<yesterday>`
- Section header changes to `YYYY.MM.DD 뉴스`
- Article count `(N건)` appears next to date
- "전체 기간" button is now inactive

- [ ] **Step 7.4: Verify right arrow at today is disabled**

Navigate to `/news?date=<today>`.
- Right arrow `→` is greyed out, not clickable

- [ ] **Step 7.5: Verify "전체 기간" clears date**

While on a dated URL, click "전체 기간".
- URL becomes `/news` (or `/news?cat=해상` if category was active)
- All articles shown, "전체 기간" button becomes active

- [ ] **Step 7.6: Verify category + date combination**

Navigate to `/news?cat=해상&date=2026-05-31`.
- Only 해상 category articles for that day are shown.
- Category tab "해상" is active.
- DateNavigator shows May 31 with count.

- [ ] **Step 7.7: Run tests one final time**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 7.8: Final commit and push**

```bash
git add -A
git commit -m "feat(news): add date archive filter to /news page"
git push
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| 날짜 네비게이터 UI (← 이전 날짜 다음 →) | Task 6 |
| 기본값: 전체 기간 (date 없을 때) | Task 5 + Task 6 |
| URL 쿼리파라미터 `date=YYYY-MM-DD` | Task 5 |
| 전체 기간 버튼 | Task 6 |
| Supabase `.gte/.lte` KST 범위 쿼리 | Task 4 |
| `published_at DESC` 정렬 | Task 4 (already in code, preserved) |
| `agent_type NOT IN (daily_card, external)` | Task 4 |
| 기사 수 (N건) 표시 | Task 6 |
| 카테고리 + 날짜 조합 | Task 5 (both in search schema) |
| `todayKST` / `dateToKSTRange` 유틸 테스트 | Task 2 + Task 3 |
