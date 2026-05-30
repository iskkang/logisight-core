---
title: News Date Archive Filter
date: 2026-05-31
status: approved
---

# News Date Archive Filter

## Problem

The `/news` page only has a category filter. As articles accumulate, there is no way to find articles from a specific date. All articles are shown newest-first across all time.

## Goal

Add a date navigator to `/news` so users can browse articles by day. The date is persisted in the URL query parameter (`date=YYYY-MM-DD`) for shareability and navigation.

## Scope

**In scope:**
- Date navigator UI (previous/next day arrows + date label with article count)
- "전체 기간" button to clear date filter
- Supabase query filtering by KST day range
- `agent_type` exclusion filter (`daily_card`, `external`)
- URL query param `date` for state persistence

**Out of scope:**
- Calendar picker / date range selection
- "Auto jump to nearest non-empty day" (mentioned as optional; skipped for simplicity)
- Pagination

## Architecture

Three files change. No new files are needed.

### `src/lib/api/news.functions.ts`

Add two optional parameters to the input validator:
- `dateFrom: string` — ISO8601 with KST offset, e.g. `2026-05-31T00:00:00+09:00`
- `dateTo: string` — ISO8601 with KST offset, e.g. `2026-05-31T23:59:59+09:00`

Add to Supabase query builder:
```ts
if (data.dateFrom) q = q.gte("published_at", data.dateFrom);
if (data.dateTo)   q = q.lte("published_at", data.dateTo);
q = q.not("agent_type", "in", '("daily_card","external")');
```

### `src/lib/api/news.ts`

Add `date?: string` (YYYY-MM-DD) to `latestNewsQueryOptions` input. When present, derive `dateFrom`/`dateTo` and pass them to `getLatestNews`. Include `date` in the `queryKey` so React Query caches per day.

```ts
const dateFrom = date ? `${date}T00:00:00+09:00` : undefined;
const dateTo   = date ? `${date}T23:59:59+09:00` : undefined;
```

### `src/routes/news.tsx`

**Search schema** — add `date` field:
```ts
const newsSearchSchema = z.object({
  cat:  z.string().min(1).max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

**Default date** — when `date` is absent from the URL, the query has no date filter ("전체 기간" mode). The date navigator displays today's KST date as the selected value so the user can click ← to navigate backwards, but no `date` param appears in the URL until the user navigates to a specific day. The navigator shows "[전체 기간]" as the active state when `date` is absent.

**`DateNavigator` component:**
```
[←]  2026년 5월 31일 (12건)  [→]   [전체 기간]
```
- Left arrow: `navigate({ search: { ...search, date: prevDay } })`
- Right arrow: disabled when `date` is today or absent (already showing today)
- "전체 기간": `navigate({ search: { cat: search.cat } })` — removes `date` from URL
- Article count: derived from `items.length` already fetched

**Section header label** — when date filter is active, change "오늘의 헤드라인" to the selected date string. When no filter, keep "오늘의 헤드라인".

## Data Flow

```
User clicks ← arrow
  → Link/navigate updates URL: /news?date=2026-05-30
  → Route loaderDeps extracts { cat, date }
  → latestNewsQueryOptions({ date: "2026-05-30", ... })
  → getLatestNews server fn: dateFrom=2026-05-30T00:00:00+09:00, dateTo=2026-05-30T23:59:59+09:00
  → Supabase: .gte("published_at", dateFrom).lte("published_at", dateTo)
  → Results returned, DateNavigator shows count
```

## Empty State

When a date has zero articles, the existing empty state message is shown:
> "해당 카테고리의 기사가 수집되는 대로 게재합니다."

No auto-navigation to the previous day.

## KST Date Helper

```ts
function todayKST(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  // returns "YYYY-MM-DD" (Swedish locale produces ISO date format)
}
```

## Testing Checklist

- [ ] `/news` (no params) shows today's KST articles, date navigator shows today
- [ ] `/news?date=2026-05-30` shows May 30 articles only
- [ ] Left arrow navigates to previous day
- [ ] Right arrow is disabled when showing today
- [ ] "전체 기간" removes date param, shows all articles
- [ ] Category + date combined: `/news?cat=해상&date=2026-05-31` works
- [ ] `agent_type` filter excludes `daily_card` and `external`
- [ ] Article count (N건) is accurate
