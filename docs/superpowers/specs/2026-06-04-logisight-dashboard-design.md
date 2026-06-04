# Logisight 5-Dashboard Overhaul — Design Spec

- **Date**: 2026-06-04
- **Version**: 1.0 (confirmed by client)
- **Stack**: TanStack Start (React 19 + Vite) · Supabase · Vercel
- **Source of truth**: Client-provided 작업 지시문 v1.0 + Phase 0 investigation findings

---

## Phase 0 Investigation Findings

### Repo Structure (Confirmed)
- **Routing**: TanStack Router file-based routes (`src/routes/`)
- **Server functions**: `createServerFn` pattern — `.functions.ts` + `.ts` pairs, loader uses `context.queryClient.ensureQueryData`, components use `useSuspenseQuery`
- **Styles**: Tailwind v4 + CSS custom properties + shadcn/ui (Radix primitives) — `src/styles.css`
- **Charts**: recharts 2.15.4 already installed ✓; vaul (Drawer) installed ✓; d3-scale installed ✓
- **Dark mode**: `.dark` CSS class tokens already defined in `styles.css`; no UI toggle yet
- **Existing routes to keep**: `/news`, `/article.$slug`, `/industries`, `/admin.login`, `/admin.routes`
- **Routes to create**: `/dashboard`
- **Routes to rebuild**: `/rates`, `/eurasia`, `/trade`, `/policy`
- **GitHub Actions**: No `.github/workflows/` directory — all workflows are new

### Supabase Schema Mapping

| Table | Spec Requirement | Status | Notes |
|---|---|---|---|
| `freight_indices` | SCFI·KCCI·CCFI·WCI·BDI | ✅ 있음 | SCFI/KCCI/CCFI/FBX confirmed. WCI/BDI may exist but not in code constants |
| `freight_rates` | Ocean rates (USD/FEU) | ✅ 있음 | Sea-only; no `mode` column, no KRW/kg |
| `air_freight_rates` (NEW) | Air rates (KRW/kg) | ❌ 없음 | Create new — `freight_rates` is incompatible (container-type, USD-only) |
| `bunker_prices` | VLSFO | ✅ 있음 | `grade`, `price_usd`, `obs_date` |
| `exchange_rates` (NEW) | Daily USD/KRW | ❌ 없음 | Migration required |
| `lanes` | transit_min/max, border_points | ✅ 있음 | |
| `delay_index_weekly` | Eurasia aggregated delays | ✅ 있음 | `median_delay_d`, `otp_pct`, `week_iso` |
| `disruption_events` | (kept, separate from new table) | ✅ 있음 | Different schema; not extended |
| `eurasia_disruptions` (NEW) | Admin-entered disruptions | ❌ 없음 | Per spec 6.2 — new table with `segment`, `delay_contribution_days`, `confidence` |
| `trade_statistics` | `stat_type='item'` | ✅ 있음 | Has `stat_type` column; 'item' data presence to be verified at runtime |
| `maritime_news` | Alert source | ✅ 있음 | `content`, `category`, `tags` |
| `policy_alerts` | (kept as-is, minimal) | ⚠️ 부분 | Too minimal for new spec; new `policies` table created instead |
| `policies` (NEW) | Full policy intelligence | ❌ 없음 | Migration required |
| `alert_snapshots` (NEW) | Dashboard alert state | ❌ 없음 | Migration required |
| `data_updates` | DataQualityBar source | ✅ 있음 | `dataset`, `updated_at`, `status` |

### Data Availability Decisions
- **SCFI/KCCI/CCFI/FBX**: Present in `freight_indices` ✓
- **WCI/BDI**: Unknown — render as "데이터 수집 중" until confirmed
- **KITA air rates (KRW/kg)**: Not present — gate as "데이터 수집 중"; admin CSV upload as fallback
- **Bunker/VLSFO**: Present in `bunker_prices` ✓
- **Exchange rates**: Not present — create table + GitHub Actions workflow
- **Trade stats (item-level)**: Table exists; gate on `stat_type='item'` data at runtime

---

## Architecture Decisions

### 1. New Tables (Migrations)
Four new migrations in order:
1. `exchange_rates` — daily USD/KRW
2. `air_freight_rates` — KITA air rates, KRW/kg native
3. `eurasia_disruptions` — admin-entered corridor disruptions
4. `policies` — full policy intelligence
5. `alert_snapshots` — dashboard alert state tracking

### 2. Navigation Restructure
Split top nav into two groups:
- **Dashboard group**: 종합 | Rates | Trade | Policy | Eurasia (with `/dashboard` as new home)
- **Content group**: 뉴스 | 인사이트

### 3. Shared Components (`src/components/dashboard/`)
All 5 dashboard pages assembled from these components only:
- `DashboardShell` — top nav + GlobalContextBar + content grid
- `GlobalContextBar` — sticky collapsible filter bar
- `StatusStrip` — 4-cell metric strip
- `SignalCard` — market posture signal card
- `IntelligenceBrief` — what changed / why / outlook / action
- `IntelTable` — dense table wrapper (fixed layout, mono numbers, row click)
- `DetailDrawer` — row/signal detail (vaul Drawer)
- `EvidenceBadge` — data-gated evidence indicator
- `FreshnessBadge` — date + staleness warning (D-n)
- `ConfidenceBadge` — high/medium/low confidence
- `ActionCard` — recommended action highlight box
- `DataQualityBar` — per-source freshness/status strip
- `Sparkline` — 8-12pt inline SVG trendline

### 4. URL as Single Source of Truth
Shared search params via `useGlobalFilters()` hook:
```
period, origin, dest, mode, hs, currency, compare, detail
```
Params persist across dashboard page navigations.

### 5. Signal Computation (`src/server/signals.ts`)
Rule-based, server-side, returns `{ label, state, basis, sources[], asOf, confidence }`.
Gate on missing data — never estimate.

### 6. Semantic Status Tokens (added to `styles.css`)
```css
--status-normal: (green)
--status-observe: (blue/info)
--status-caution: (amber)
--status-alert: (red)
```
Separate from demand heatmap blue-density scale.

---

## Implementation Phases

| Phase | Route | Content | Key Deliverables |
|---|---|---|---|
| 0 | — | Common shell + components + migrations | DashboardShell, 13 components, useGlobalFilters, semantic tokens, 5 migrations |
| 1 | `/rates` | Rates Intelligence rebuild | Mode-split table, KRW/kg air group, percentile calc, exchange_rates workflow |
| 2 | `/eurasia` | Eurasia Control Tower rebuild | Corridor board, SVG concept map, lane drawer, admin disruption CRUD |
| 3 | `/dashboard` | Control Tower (종합) new | Alert snapshots, watchlist, top-3 rates, DataQualityBar |
| 4 | `/trade` | Trade Intelligence new | Item-first table, sufficiency-gated heatmap, trade-rate signal |
| 5 | `/policy` | Policy & Risk new | Timeline, exposure matrix, policy drawer, admin CRUD, 3 seed records |

### Commit Pattern (each phase)
```
npm run build  # must pass
git add [specific files]
git commit -m "<phase message>"
git push
```

---

## Constraints (Hard Rules from Spec)

1. No dummy data — missing data = "데이터 수집 중" gate
2. `shipment_legs` never exposed (any screen, API, or log)
3. Air freight: 4-element display mandatory (KRW/kg + USD equiv + rate + rate date)
4. Ocean/air never in single sorted table — mode-group separation
5. SCFI lead/lag comparison disabled until methodology confirmed
6. No causal language — correlation/alignment/estimated only
7. GitHub Actions workflows never merged — one file per responsibility
8. No refactoring outside task scope — propose first if needed
9. `/news`, `/article`, `/industries` must not regress

---

## GitHub Actions (New Workflows)

| File | Trigger | Source | Target |
|---|---|---|---|
| `daily-exchange-rate.yml` | cron daily | 한국수출입은행 OpenAPI (`KOREAEXIM_API_KEY` secret) | `exchange_rates` upsert |
| `monthly-trade-stats.yml` | (existing pattern) | 관세청 | `trade_statistics` |
| `monthly-freight-rates.yml` | (existing pattern) | 해양수산부 | `freight_rates` |

KITA air rates: public API investigation required before automation. Fallback: `/admin` CSV upload.

---

## Open Items / Gates

| Item | Status | Unblock Condition |
|---|---|---|
| WCI/BDI data in DB | Unknown | Query `freight_indices` for these codes |
| KITA air freight automation | Not started | Investigate data.kita.or.kr API docs |
| `trade_statistics` 'item' stat_type | Unconfirmed | Runtime check at Phase 4 |
| MTL Link `total_tt_days` | Deferred | Separate project — not in scope |
| Dark mode UI toggle | Not implemented | Add theme toggle to Navigation |
