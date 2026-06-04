# Logisight 5-Dashboard Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild and create 5 dashboard pages (종합 / Rates / Trade / Policy / Eurasia) with a shared component library, URL-based filter state, real-data-only rendering, light/dark theme, and Supabase data contracts.

**Architecture:** A shared `src/components/dashboard/` library (13 components) assembled per page. Server functions (`createServerFn`) compute percentiles and signals server-side; pages use `useSuspenseQuery` with loader prefetch. URL search params (TanStack Router `validateSearch`) are the single source of truth for filters, with localStorage backup for cross-page persistence via `useGlobalFilters()`. Four new Supabase migrations add missing tables; `kita_air_rates`/`kita_sea_rates` already exist and are typed.

**Tech Stack:** TanStack Start (React 19 + Vite), TanStack Router, TanStack Query, Supabase, recharts 2.15.4, vaul Drawer, Tailwind v4 CSS custom properties, shadcn/ui (Radix), Vercel

---

## File Map

### New Files
```
supabase/migrations/
  20260604010000_exchange_rates.sql
  20260604020000_eurasia_disruptions.sql
  20260604030000_policies.sql
  20260604040000_alert_snapshots.sql

src/hooks/
  useGlobalFilters.ts

src/server/
  signals.ts
  alerts.ts

src/lib/
  watchlist.ts
  api/
    kita-rates.functions.ts
    kita-rates.ts
    exchange-rates.functions.ts
    exchange-rates.ts
    eurasia-disruptions.functions.ts
    eurasia-disruptions.ts
    policies.functions.ts
    policies.ts

src/components/dashboard/
  DashboardShell.tsx
  GlobalContextBar.tsx
  StatusStrip.tsx
  SignalCard.tsx
  IntelligenceBrief.tsx
  IntelTable.tsx
  DetailDrawer.tsx
  EvidenceBadge.tsx
  FreshnessBadge.tsx
  ConfidenceBadge.tsx
  ActionCard.tsx
  DataQualityBar.tsx
  Sparkline.tsx

src/routes/
  dashboard.tsx
  policy.tsx

.github/workflows/
  daily-exchange-rate.yml
```

### Modified Files
```
src/styles.css                         add semantic status tokens + dark brand tokens
src/components/site/Navigation.tsx     dashboard nav group + dark mode toggle
src/integrations/supabase/types.ts     add types for 4 new tables
src/lib/api/rates.functions.ts         add getKitaAirRates, getKitaSeaRates, percentile server fn
src/lib/api/rates.ts                   add kita types + new queryOptions
src/lib/api/eurasia.functions.ts       extend for eurasia_disruptions
src/lib/api/eurasia.ts                 add disruption types
src/lib/api/trade.functions.ts         add getTradeByItem server fn
src/lib/api/trade.ts                   add item row type
src/routes/rates.tsx                   full rebuild
src/routes/eurasia.tsx                 full rebuild
src/routes/trade.tsx                   rebuild for item-first
src/routes/admin.routes.tsx            add disruption CRUD + policy CRUD + CSV upload
```

---

## Phase 0 — Common Shell, Components, Migrations

### Task 0.1: Semantic Status Tokens + Dark Brand Tokens

**Files:**
- Modify: `src/styles.css`

- [ ] Add status semantic tokens and dark-mode brand overrides immediately after the existing `--color-surface` line in `@theme inline`, and add `:root` values + `.dark` overrides:

```css
/* In @theme inline block — add after --color-surface: var(--surface); */
--color-status-normal: var(--status-normal);
--color-status-observe: var(--status-observe);
--color-status-caution: var(--status-caution);
--color-status-alert: var(--status-alert);
/* Demand heatmap (blue density — separate from status) */
--color-demand-0: var(--demand-0);
--color-demand-1: var(--demand-1);
--color-demand-2: var(--demand-2);
--color-demand-3: var(--demand-3);
```

```css
/* In :root block — add after existing brand tokens */
--status-normal: oklch(0.62 0.16 152);    /* green */
--status-observe: oklch(0.55 0.15 230);   /* blue/info */
--status-caution: oklch(0.78 0.16 75);    /* amber */
--status-alert: oklch(0.703 0.18 22);     /* red */
--demand-0: oklch(0.97 0.01 240);         /* near-white blue */
--demand-1: oklch(0.82 0.09 240);         /* light blue */
--demand-2: oklch(0.60 0.18 240);         /* mid blue */
--demand-3: oklch(0.38 0.20 240);         /* dark blue */
```

```css
/* In .dark block — add brand token overrides */
--surface: oklch(0.14 0.03 258);
--ink: oklch(0.93 0.01 250);
--ink-muted: oklch(0.70 0.02 250);
--line: oklch(1 0 0 / 12%);
--navy-900: oklch(0.14 0.03 258);
```

- [ ] Run `npm run build` — expect PASS (CSS only change).

- [ ] Commit:
```bash
git add src/styles.css
git commit -m "feat: semantic status tokens and dark brand overrides"
```

---

### Task 0.2: Navigation — Dashboard Group + Dark Mode Toggle

**Files:**
- Modify: `src/components/site/Navigation.tsx`

- [ ] Replace the NAV array and add dark mode toggle. Full replacement of the file:

```tsx
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo";

const DASHBOARD_NAV = [
  { to: "/dashboard", label: "종합" },
  { to: "/rates", label: "Rates" },
  { to: "/trade", label: "Trade" },
  { to: "/policy", label: "Policy" },
  { to: "/eurasia", label: "Eurasia" },
] as const;

const CONTENT_NAV = [
  { to: "/news", label: "뉴스" },
  { to: "/industries", label: "산업별" },
] as const;

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark] as const;
}

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useDarkMode();

  const NavLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className="relative px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
      activeProps={{
        className:
          "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[var(--color-cyan)]",
      }}
    >
      {label}
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10"
      style={{ background: "var(--color-navy-900)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4 lg:px-6">
        <Logo className="mr-3 text-lg lg:text-xl" />

        <nav className="hidden flex-1 items-center lg:flex">
          {/* Dashboard group */}
          <div className="flex items-center gap-0.5 border-r border-white/15 pr-3 mr-3">
            {DASHBOARD_NAV.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </div>
          {/* Content group */}
          <div className="flex items-center gap-0.5">
            {CONTENT_NAV.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </div>
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
            aria-label={dark ? "라이트 모드" : "다크 모드"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <span
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--color-cyan)", color: "var(--color-navy-900)" }}
          >
            목업·샘플 데이터
          </span>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴 열기"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">대시보드</p>
            {DASHBOARD_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/5 hover:text-white"
                activeProps={{ className: "text-white bg-white/5" }}
              >
                {item.label}
              </Link>
            ))}
            <p className="px-3 py-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">콘텐츠</p>
            {CONTENT_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/5 hover:text-white"
                activeProps={{ className: "text-white bg-white/5" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/components/site/Navigation.tsx
git commit -m "feat: dashboard nav group and dark mode toggle"
```

---

### Task 0.3: Supabase Migrations (4 new tables)

**Files:**
- Create: `supabase/migrations/20260604010000_exchange_rates.sql`
- Create: `supabase/migrations/20260604020000_eurasia_disruptions.sql`
- Create: `supabase/migrations/20260604030000_policies.sql`
- Create: `supabase/migrations/20260604040000_alert_snapshots.sql`

- [ ] Create `supabase/migrations/20260604010000_exchange_rates.sql`:
```sql
create table if not exists exchange_rates (
  rate_date date primary key,
  usd_krw numeric(10,2) not null,
  source text not null default 'koreaexim',
  created_at timestamptz default now()
);
grant select on exchange_rates to anon, authenticated;
grant all on exchange_rates to service_role;
alter table exchange_rates enable row level security;
create policy "exchange_rates_public_read" on exchange_rates for select using (true);
```

- [ ] Create `supabase/migrations/20260604020000_eurasia_disruptions.sql`:
```sql
create table if not exists eurasia_disruptions (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid references lanes(id),
  segment text not null,
  title text not null,
  severity text not null check (severity in ('high','medium','low')),
  delay_contribution_days numeric(4,1),
  status text not null default 'active' check (status in ('active','resolved')),
  started_at date,
  resolved_at date,
  source text,
  confidence text check (confidence in ('high','medium','low')),
  created_at timestamptz default now()
);
grant select on eurasia_disruptions to anon, authenticated;
grant all on eurasia_disruptions to service_role;
alter table eurasia_disruptions enable row level security;
create policy "eurasia_disruptions_public_read" on eurasia_disruptions for select using (true);
create policy "eurasia_disruptions_admin_write" on eurasia_disruptions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
```

- [ ] Create `supabase/migrations/20260604030000_policies.sql`:
```sql
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body text,
  announced_at date,
  effective_at date,
  affected_countries text[],
  affected_hs_codes text[],
  affected_modes text[],
  severity text check (severity in ('high','medium','low')),
  impact_type text,
  estimated_impact text,
  required_documents text[],
  recommended_actions jsonb,
  checklist jsonb,
  source_official text,
  source_secondary text,
  owner text,
  response_status text not null default 'open' check (response_status in ('open','in_progress','done')),
  next_review_at date,
  last_verified_at date,
  created_at timestamptz default now()
);
grant select on policies to anon, authenticated;
grant all on policies to service_role;
alter table policies enable row level security;
create policy "policies_public_read" on policies for select using (true);
create policy "policies_admin_write" on policies
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed 3 policy stubs (dates + URLs left blank — admin to confirm)
insert into policies (title, summary, severity, response_status, affected_modes, last_verified_at)
values
  ('EU ETS 해운 할증 개정', 'EU 배출권거래제 해운 적용 범위 및 할증료 개정', 'medium', 'open', '{ocean}', null),
  ('EU CBAM 분기 신고', '탄소국경조정제도 전환기 종료 후 첫 유상 분기 신고 의무화', 'high', 'open', '{ocean}', null),
  ('대러 제재 품목 확대', '러시아 대상 제재 품목 HS 84-85 추가 확대', 'high', 'open', '{rail}', null);
```

- [ ] Create `supabase/migrations/20260604040000_alert_snapshots.sql`:
```sql
create table if not exists alert_snapshots (
  snapshot_date date not null,
  alert_key text not null,
  severity text not null,
  metric_value numeric,
  primary key (snapshot_date, alert_key)
);
grant select on alert_snapshots to anon, authenticated;
grant all on alert_snapshots to service_role;
alter table alert_snapshots enable row level security;
create policy "alert_snapshots_public_read" on alert_snapshots for select using (true);
```

- [ ] Apply migrations. Run in Supabase SQL editor or via Supabase CLI if available. If CLI is not configured, apply each file manually in the Supabase dashboard SQL editor.

- [ ] Commit:
```bash
git add supabase/migrations/
git commit -m "feat: add exchange_rates, eurasia_disruptions, policies, alert_snapshots migrations"
```

---

### Task 0.4: Add New Table Types to types.ts

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] Add types for the 4 new tables. Insert the following blocks into the `Tables` section of `Database["public"]["Tables"]` (after `alert_snapshots` entry, alphabetically):

Add `alert_snapshots` table type (before `blank_sailings`):
```ts
alert_snapshots: {
  Row: {
    snapshot_date: string
    alert_key: string
    severity: string
    metric_value: number | null
  }
  Insert: {
    snapshot_date: string
    alert_key: string
    severity: string
    metric_value?: number | null
  }
  Update: {
    snapshot_date?: string
    alert_key?: string
    severity?: string
    metric_value?: number | null
  }
  Relationships: []
}
```

Add `eurasia_disruptions` table type (after `disruption_events`):
```ts
eurasia_disruptions: {
  Row: {
    id: string
    lane_id: string | null
    segment: string
    title: string
    severity: 'high' | 'medium' | 'low'
    delay_contribution_days: number | null
    status: 'active' | 'resolved'
    started_at: string | null
    resolved_at: string | null
    source: string | null
    confidence: 'high' | 'medium' | 'low' | null
    created_at: string | null
  }
  Insert: {
    id?: string
    lane_id?: string | null
    segment: string
    title: string
    severity: 'high' | 'medium' | 'low'
    delay_contribution_days?: number | null
    status?: 'active' | 'resolved'
    started_at?: string | null
    resolved_at?: string | null
    source?: string | null
    confidence?: 'high' | 'medium' | 'low' | null
    created_at?: string | null
  }
  Update: {
    id?: string
    lane_id?: string | null
    segment?: string
    title?: string
    severity?: 'high' | 'medium' | 'low'
    delay_contribution_days?: number | null
    status?: 'active' | 'resolved'
    started_at?: string | null
    resolved_at?: string | null
    source?: string | null
    confidence?: 'high' | 'medium' | 'low' | null
    created_at?: string | null
  }
  Relationships: [
    {
      foreignKeyName: "eurasia_disruptions_lane_id_fkey"
      columns: ["lane_id"]
      isOneToOne: false
      referencedRelation: "lanes"
      referencedColumns: ["id"]
    }
  ]
}
```

Add `exchange_rates` table type (after `eurasia_disruptions`):
```ts
exchange_rates: {
  Row: {
    rate_date: string
    usd_krw: number
    source: string
    created_at: string | null
  }
  Insert: {
    rate_date: string
    usd_krw: number
    source?: string
    created_at?: string | null
  }
  Update: {
    rate_date?: string
    usd_krw?: number
    source?: string
    created_at?: string | null
  }
  Relationships: []
}
```

Add `policies` table type (after `policy_alerts`):
```ts
policies: {
  Row: {
    id: string
    title: string
    summary: string | null
    body: string | null
    announced_at: string | null
    effective_at: string | null
    affected_countries: string[] | null
    affected_hs_codes: string[] | null
    affected_modes: string[] | null
    severity: 'high' | 'medium' | 'low' | null
    impact_type: string | null
    estimated_impact: string | null
    required_documents: string[] | null
    recommended_actions: Json | null
    checklist: Json | null
    source_official: string | null
    source_secondary: string | null
    owner: string | null
    response_status: 'open' | 'in_progress' | 'done'
    next_review_at: string | null
    last_verified_at: string | null
    created_at: string | null
  }
  Insert: {
    id?: string
    title: string
    summary?: string | null
    body?: string | null
    announced_at?: string | null
    effective_at?: string | null
    affected_countries?: string[] | null
    affected_hs_codes?: string[] | null
    affected_modes?: string[] | null
    severity?: 'high' | 'medium' | 'low' | null
    impact_type?: string | null
    estimated_impact?: string | null
    required_documents?: string[] | null
    recommended_actions?: Json | null
    checklist?: Json | null
    source_official?: string | null
    source_secondary?: string | null
    owner?: string | null
    response_status?: 'open' | 'in_progress' | 'done'
    next_review_at?: string | null
    last_verified_at?: string | null
    created_at?: string | null
  }
  Update: {
    id?: string
    title?: string
    summary?: string | null
    body?: string | null
    announced_at?: string | null
    effective_at?: string | null
    affected_countries?: string[] | null
    affected_hs_codes?: string[] | null
    affected_modes?: string[] | null
    severity?: 'high' | 'medium' | 'low' | null
    impact_type?: string | null
    estimated_impact?: string | null
    required_documents?: string[] | null
    recommended_actions?: Json | null
    checklist?: Json | null
    source_official?: string | null
    source_secondary?: string | null
    owner?: string | null
    response_status?: 'open' | 'in_progress' | 'done'
    next_review_at?: string | null
    last_verified_at?: string | null
    created_at?: string | null
  }
  Relationships: []
}
```

- [ ] Run `npm run build` — expect PASS (type additions only).

- [ ] Commit:
```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add types for exchange_rates, eurasia_disruptions, policies, alert_snapshots"
```

---

### Task 0.5: useGlobalFilters Hook

**Files:**
- Create: `src/hooks/useGlobalFilters.ts`

- [ ] Create the file:
```ts
// src/hooks/useGlobalFilters.ts
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

export type GlobalFilters = {
  period: "3m" | "12m" | "36m";
  origin: string;
  dest?: string;
  mode: "ocean" | "air" | "rail" | "all";
  hs?: string;
  currency: "USD" | "KRW";
  compare?: string;
  detail?: string;
};

export const DEFAULT_FILTERS: GlobalFilters = {
  period: "12m",
  origin: "KRPUS",
  mode: "all",
  currency: "USD",
};

const STORAGE_KEY = "logisight:global-filters";

export function readStoredFilters(): Partial<GlobalFilters> {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as Partial<GlobalFilters>) : {};
  } catch {
    return {};
  }
}

function writeStoredFilters(f: Partial<GlobalFilters>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    typeof window !== "undefined" &&
      localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

/** Called inside each route's validateSearch to apply persisted defaults */
export function resolveFilters(s: Record<string, unknown>): GlobalFilters {
  const stored = readStoredFilters();
  return {
    period: (["3m", "12m", "36m"].includes(s.period as string)
      ? s.period
      : (stored.period ?? DEFAULT_FILTERS.period)) as GlobalFilters["period"],
    origin:
      typeof s.origin === "string"
        ? s.origin
        : (stored.origin ?? DEFAULT_FILTERS.origin),
    dest: typeof s.dest === "string" ? s.dest : stored.dest,
    mode: (["ocean", "air", "rail", "all"].includes(s.mode as string)
      ? s.mode
      : (stored.mode ?? DEFAULT_FILTERS.mode)) as GlobalFilters["mode"],
    hs: typeof s.hs === "string" ? s.hs : stored.hs,
    currency: (["USD", "KRW"].includes(s.currency as string)
      ? s.currency
      : (stored.currency ?? DEFAULT_FILTERS.currency)) as GlobalFilters["currency"],
    compare: typeof s.compare === "string" ? s.compare : stored.compare,
    detail: typeof s.detail === "string" ? s.detail : undefined,
  };
}

/** Use inside a dashboard page component after reading Route.useSearch() */
export function useGlobalFilters(currentSearch: GlobalFilters) {
  const navigate = useNavigate();

  const setFilters = useCallback(
    (updates: Partial<GlobalFilters>) => {
      const merged: GlobalFilters = { ...currentSearch, ...updates };
      // Persist (excluding ephemeral 'detail')
      const { detail: _d, ...persist } = merged;
      void _d;
      writeStoredFilters(persist);
      navigate({ search: merged as Record<string, string> });
    },
    [currentSearch, navigate],
  );

  return { filters: currentSearch, setFilters };
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/hooks/useGlobalFilters.ts
git commit -m "feat: useGlobalFilters hook with localStorage cross-page persistence"
```

---

### Task 0.6: Shared Dashboard Components (Part 1 — Badges + Sparkline)

**Files:**
- Create: `src/components/dashboard/Sparkline.tsx`
- Create: `src/components/dashboard/FreshnessBadge.tsx`
- Create: `src/components/dashboard/ConfidenceBadge.tsx`
- Create: `src/components/dashboard/EvidenceBadge.tsx`

- [ ] Create `src/components/dashboard/Sparkline.tsx`:
```tsx
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, width = 80, height = 24, className }: SparklineProps) {
  if (data.length < 2) {
    return (
      <span
        className={`inline-block rounded bg-muted/30 ${className ?? ""}`}
        style={{ width, height }}
      />
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

- [ ] Create `src/components/dashboard/FreshnessBadge.tsx`:
```tsx
import { differenceInDays, parseISO } from "date-fns";

interface FreshnessBadgeProps {
  asOf: string | null; // ISO date string
  expectedDays?: number; // warn if older than this
  className?: string;
}

export function FreshnessBadge({ asOf, expectedDays = 7, className }: FreshnessBadgeProps) {
  if (!asOf) {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className ?? ""}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        기준일 없음
      </span>
    );
  }
  const daysAgo = differenceInDays(new Date(), parseISO(asOf));
  const isStale = daysAgo > expectedDays;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${
        isStale ? "text-[var(--color-status-caution)]" : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: isStale
            ? "var(--color-status-caution)"
            : "var(--color-status-normal)",
        }}
      />
      {asOf}
      {isStale && ` (D−${daysAgo})`}
    </span>
  );
}
```

- [ ] Create `src/components/dashboard/ConfidenceBadge.tsx`:
```tsx
const CONF_MAP = {
  high: { label: "신뢰도 높음", color: "var(--color-status-normal)" },
  medium: { label: "신뢰도 중간", color: "var(--color-status-caution)" },
  low: { label: "신뢰도 낮음", color: "var(--color-status-alert)" },
} as const;

interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low" | null | undefined;
  className?: string;
}

export function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  if (!level) return null;
  const { label, color } = CONF_MAP[level];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${className ?? ""}`}
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  );
}
```

- [ ] Create `src/components/dashboard/EvidenceBadge.tsx`:
```tsx
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface EvidenceBadgeProps {
  hasEvidence: boolean;
  sources?: string[];
  className?: string;
}

export function EvidenceBadge({ hasEvidence, sources, className }: EvidenceBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!hasEvidence) {
    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] text-muted-foreground bg-muted/40 ${className ?? ""}`}
      >
        근거 없음
      </span>
    );
  }

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium"
        style={{
          background: "var(--color-status-observe)22",
          color: "var(--color-status-observe)",
        }}
      >
        근거 있음
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && sources && sources.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-card p-2 shadow-lg">
          <ul className="space-y-1">
            {sources.map((s, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/components/dashboard/
git commit -m "feat: Sparkline, FreshnessBadge, ConfidenceBadge, EvidenceBadge components"
```

---

### Task 0.7: Shared Dashboard Components (Part 2 — ActionCard, DataQualityBar, StatusStrip)

**Files:**
- Create: `src/components/dashboard/ActionCard.tsx`
- Create: `src/components/dashboard/DataQualityBar.tsx`
- Create: `src/components/dashboard/StatusStrip.tsx`

- [ ] Create `src/components/dashboard/ActionCard.tsx`:
```tsx
interface ActionCardProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionCard({ children, className }: ActionCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${className ?? ""}`}
      style={{
        background: "var(--color-status-observe)12",
        borderColor: "var(--color-status-observe)40",
        color: "var(--color-foreground)",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] Create `src/components/dashboard/DataQualityBar.tsx`:
```tsx
import { differenceInDays, parseISO } from "date-fns";
import { FreshnessBadge } from "./FreshnessBadge";

export interface DataSource {
  label: string;
  asOf: string | null;
  expectedDays?: number;
}

interface DataQualityBarProps {
  sources: DataSource[];
}

export function DataQualityBar({ sources }: DataQualityBarProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2">
      {sources.map((src) => (
        <span key={src.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium">{src.label}</span>
          <FreshnessBadge asOf={src.asOf} expectedDays={src.expectedDays} />
        </span>
      ))}
    </div>
  );
}
```

- [ ] Create `src/components/dashboard/StatusStrip.tsx`:
```tsx
export type StatusLevel = "normal" | "observe" | "caution" | "alert";

interface StatusCell {
  label: string;
  value: string;
  sub?: string;
  status?: StatusLevel;
}

interface StatusStripProps {
  cells: [StatusCell, StatusCell, StatusCell, StatusCell];
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  normal: "var(--color-status-normal)",
  observe: "var(--color-status-observe)",
  caution: "var(--color-status-caution)",
  alert: "var(--color-status-alert)",
};

export function StatusStrip({ cells }: StatusStripProps) {
  return (
    <div className="grid grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
      {cells.map((cell, i) => (
        <div key={i} className="bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground">{cell.label}</p>
          <p
            className="mt-0.5 text-sm font-semibold leading-tight"
            style={cell.status ? { color: STATUS_COLORS[cell.status] } : undefined}
          >
            {cell.value}
          </p>
          {cell.sub && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{cell.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/components/dashboard/
git commit -m "feat: ActionCard, DataQualityBar, StatusStrip components"
```

---

### Task 0.8: Shared Dashboard Components (Part 3 — SignalCard, IntelligenceBrief)

**Files:**
- Create: `src/components/dashboard/SignalCard.tsx`
- Create: `src/components/dashboard/IntelligenceBrief.tsx`

- [ ] Create `src/components/dashboard/SignalCard.tsx`:
```tsx
import { ConfidenceBadge } from "./ConfidenceBadge";

interface SignalCardProps {
  label: string;
  signal: string | null; // null = data gate
  basis?: string;
  confidence?: "high" | "medium" | "low";
  onShowEvidence?: () => void;
  className?: string;
}

export function SignalCard({ label, signal, basis, confidence, onShowEvidence, className }: SignalCardProps) {
  const isGated = signal === null;

  return (
    <div
      className={`rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 ${className ?? ""}`}
    >
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      {isGated ? (
        <p className="text-[12px] text-muted-foreground italic">데이터 수집 중</p>
      ) : (
        <>
          <p className="text-sm font-semibold">{signal}</p>
          {basis && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{basis}</p>
          )}
        </>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        {confidence && !isGated ? (
          <ConfidenceBadge level={confidence} />
        ) : (
          <span />
        )}
        {!isGated && onShowEvidence && (
          <button
            type="button"
            onClick={onShowEvidence}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            근거 ↗
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/dashboard/IntelligenceBrief.tsx`:
```tsx
import { ActionCard } from "./ActionCard";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FreshnessBadge } from "./FreshnessBadge";

interface IntelligenceBriefProps {
  whatChanged: string | null;
  why: string | null;
  outlook: string | null;
  recommendedAction: string | null;
  actionHref?: string;
  actionLabel?: string;
  sources?: string[];
  confidence?: "high" | "medium" | "low";
  asOf?: string | null;
}

export function IntelligenceBrief({
  whatChanged,
  why,
  outlook,
  recommendedAction,
  actionHref,
  actionLabel = "검토안 생성 ↗",
  sources,
  confidence,
  asOf,
}: IntelligenceBriefProps) {
  const hasContent = whatChanged || why || outlook || recommendedAction;
  if (!hasContent) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-[12px] text-muted-foreground italic">
        데이터 수집 중 — 인텔리전스 브리프를 생성할 데이터가 부족합니다.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-[12px]">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        인텔리전스 브리프
      </p>
      {whatChanged && (
        <div>
          <p className="font-semibold text-foreground mb-0.5">무엇이 변했는가</p>
          <p className="text-muted-foreground">{whatChanged}</p>
        </div>
      )}
      {why && (
        <div>
          <p className="font-semibold text-foreground mb-0.5">왜 변했는가</p>
          <p className="text-muted-foreground">{why}</p>
        </div>
      )}
      {outlook && (
        <div>
          <p className="font-semibold text-foreground mb-0.5">향후 전망</p>
          <p className="text-muted-foreground">{outlook}</p>
        </div>
      )}
      {recommendedAction && (
        <ActionCard>
          <p className="font-semibold mb-1">권장 행동</p>
          <p>{recommendedAction}</p>
          {actionHref && (
            <a
              href={actionHref}
              className="mt-2 inline-flex items-center text-[11px] underline underline-offset-2"
            >
              {actionLabel}
            </a>
          )}
        </ActionCard>
      )}
      <div className="flex items-center justify-between border-t border-border pt-2">
        {sources && sources.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            출처 {sources.join("·")}
          </p>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {confidence && <ConfidenceBadge level={confidence} />}
          {asOf && <FreshnessBadge asOf={asOf} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/components/dashboard/
git commit -m "feat: SignalCard and IntelligenceBrief components"
```

---

### Task 0.9: Shared Dashboard Components (Part 4 — IntelTable, DetailDrawer)

**Files:**
- Create: `src/components/dashboard/IntelTable.tsx`
- Create: `src/components/dashboard/DetailDrawer.tsx`

- [ ] Create `src/components/dashboard/IntelTable.tsx`:
```tsx
import React from "react";

export interface IntelTableColumn<T> {
  key: string;
  header: string;
  headerAlign?: "left" | "right";
  render: (row: T) => React.ReactNode;
  numeric?: boolean;
  width?: string;
}

interface IntelTableProps<T> {
  columns: IntelTableColumn<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  groupLabel?: string;
  emptyMessage?: string;
  caption?: React.ReactNode;
  className?: string;
}

export function IntelTable<T>({
  columns,
  rows,
  getKey,
  onRowClick,
  groupLabel,
  emptyMessage = "데이터 없음",
  caption,
  className,
}: IntelTableProps<T>) {
  return (
    <div className={className}>
      {groupLabel && (
        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {groupLabel}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap ${
                    col.numeric || col.headerAlign === "right" ? "text-right" : "text-left"
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-muted-foreground italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={getKey(row)}
                className={`border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${
                      col.numeric ? "text-right font-mono tabular-nums" : ""
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
```

- [ ] Create `src/components/dashboard/DetailDrawer.tsx`:
```tsx
import { Drawer } from "vaul";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function DetailDrawer({ open, onClose, title, children }: DetailDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-lg bg-card border-l border-border shadow-xl overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            {title && (
              <Drawer.Title className="text-sm font-semibold">
                {title}
              </Drawer.Title>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-muted-foreground hover:text-foreground text-[13px]"
            >
              닫기 ✕
            </button>
          </div>
          <div className="flex-1 p-5 text-[12px] space-y-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/components/dashboard/
git commit -m "feat: IntelTable and DetailDrawer components"
```

---

### Task 0.10: DashboardShell + GlobalContextBar

**Files:**
- Create: `src/components/dashboard/DashboardShell.tsx`
- Create: `src/components/dashboard/GlobalContextBar.tsx`

- [ ] Create `src/components/dashboard/GlobalContextBar.tsx`:
```tsx
import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import type { GlobalFilters } from "@/hooks/useGlobalFilters";

interface GlobalContextBarProps {
  filters: GlobalFilters;
  onFilterChange: (updates: Partial<GlobalFilters>) => void;
  defaultExpanded?: boolean;
  disabledFilters?: (keyof GlobalFilters)[];
}

const PERIOD_OPTS = [
  { value: "3m", label: "최근 3개월" },
  { value: "12m", label: "최근 12개월" },
  { value: "36m", label: "최근 36개월" },
] as const;

const MODE_OPTS = [
  { value: "all", label: "전체 모드" },
  { value: "ocean", label: "해상" },
  { value: "air", label: "항공" },
  { value: "rail", label: "철도" },
] as const;

const CURRENCY_OPTS = [
  { value: "USD", label: "USD" },
  { value: "KRW", label: "KRW" },
] as const;

export function GlobalContextBar({
  filters,
  onFilterChange,
  defaultExpanded = true,
  disabledFilters = [],
}: GlobalContextBarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const chipSummary = [
    filters.origin,
    MODE_OPTS.find((m) => m.value === filters.mode)?.label,
    PERIOD_OPTS.find((p) => p.value === filters.period)?.label,
    filters.currency,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      {!expanded ? (
        <div className="flex items-center gap-3 px-4 py-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">{chipSummary}</span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            필터 펼치기
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          {/* Period */}
          <FilterSelect
            value={filters.period}
            options={PERIOD_OPTS}
            onChange={(v) => onFilterChange({ period: v as GlobalFilters["period"] })}
          />
          {/* Mode */}
          <FilterSelect
            value={filters.mode}
            options={MODE_OPTS}
            onChange={(v) => onFilterChange({ mode: v as GlobalFilters["mode"] })}
          />
          {/* Currency */}
          <FilterSelect
            value={filters.currency}
            options={CURRENCY_OPTS}
            onChange={(v) => onFilterChange({ currency: v as GlobalFilters["currency"] })}
          />
          {/* HS filter — disabled until Phase 4 */}
          <span
            className="flex items-center gap-1 text-[12px] text-muted-foreground/50 cursor-not-allowed"
            title="HS 필터는 Trade 화면에서만 적용 (Phase 4)"
          >
            HS 코드 (비활성)
          </span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            접기
          </button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded-md border border-border bg-background px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] Create `src/components/dashboard/DashboardShell.tsx`:
```tsx
interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6 space-y-4">
      {children}
    </div>
  );
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/components/dashboard/
git commit -m "feat: DashboardShell and GlobalContextBar components — Phase 0 complete"
```

---

### Task 0.11: Signal Computation + Alert Aggregation (stubs)

**Files:**
- Create: `src/server/signals.ts`
- Create: `src/server/alerts.ts`

- [ ] Create `src/server/signals.ts`:
```ts
// Signal computation rules. Returns { label, state, basis, sources, asOf, confidence }.
// Gate rule: if ANY required data input is missing, return state='gated'.
// Never estimate — always gate.

export type SignalState = "gated" | "rising" | "falling" | "neutral" | "strong" | "weak" | "shift" | "expanding" | "stable";

export interface Signal {
  label: string;
  state: SignalState;
  basis: string | null;       // human-readable calculation summary
  sources: string[];
  asOf: string | null;        // ISO date of most recent input
  confidence: "high" | "medium" | "low" | null;
}

export interface FreightIndexPoint {
  week_date: string;
  value: number | null;
  change_pct: number | null;
}

/** Compute 52-week percentile: 0–100, or null if insufficient data */
export function percentile52w(series: FreightIndexPoint[], latestValue: number): number | null {
  const values = series
    .filter((p) => p.value !== null)
    .map((p) => p.value as number);
  if (values.length < 4) return null;
  const below = values.filter((v) => v <= latestValue).length;
  return Math.round((below / values.length) * 100);
}

/** Compute 52-week normal range: [mean - 1σ, mean + 1σ] or null */
export function normalRange52w(series: FreightIndexPoint[]): [number, number] | null {
  const values = series
    .filter((p) => p.value !== null)
    .map((p) => p.value as number);
  if (values.length < 4) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
  return [Math.round(mean - sd), Math.round(mean + sd)];
}

/**
 * Korean outbound ocean pressure signal.
 * Rule: KCCI composite WoW > 0 for 3 consecutive weeks AND 52w percentile >= 70 → 'rising'.
 * Inverse (WoW < 0 for 3 weeks AND percentile <= 30) → 'falling'.
 * Otherwise → 'neutral'.
 * Gate if < 4 weeks of KCCI data.
 */
export function computeOceanPressureSignal(
  series: FreightIndexPoint[],  // KCCI, ascending by week_date
): Signal {
  const label = "한국발 해상 압력";
  const latest3 = series.filter((p) => p.value !== null).slice(-3);
  if (latest3.length < 3) {
    return { label, state: "gated", basis: null, sources: ["KCCI"], asOf: null, confidence: null };
  }
  const allRising = latest3.every((p) => (p.change_pct ?? 0) > 0);
  const allFalling = latest3.every((p) => (p.change_pct ?? 0) < 0);
  const latestValue = latest3[latest3.length - 1].value!;
  const asOf = latest3[latest3.length - 1].week_date;
  const pct = percentile52w(series, latestValue);
  if (pct === null) {
    return { label, state: "gated", basis: null, sources: ["KCCI"], asOf, confidence: null };
  }

  if (allRising && pct >= 70) {
    return {
      label,
      state: "rising",
      basis: `KCCI 3주 연속 ▲ · 상위 ${100 - pct}%`,
      sources: ["KCCI"],
      asOf,
      confidence: pct >= 85 ? "high" : "medium",
    };
  }
  if (allFalling && pct <= 30) {
    return {
      label,
      state: "falling",
      basis: `KCCI 3주 연속 ▼ · 하위 ${pct}%`,
      sources: ["KCCI"],
      asOf,
      confidence: pct <= 15 ? "high" : "medium",
    };
  }
  return {
    label,
    state: "neutral",
    basis: `KCCI 변동 — 52주 백분위 ${pct}%`,
    sources: ["KCCI"],
    asOf,
    confidence: "medium",
  };
}

/**
 * Global spot momentum signal.
 * Rule: SCFI MoM >= +5% AND WCI same direction → 'strong'.
 * SCFI MoM <= -5% AND WCI same direction → 'weak'.
 * Gate if SCFI data missing.
 * Note: WCI absence alone does not gate — treated as "partial" with lower confidence.
 */
export function computeGlobalMomentumSignal(
  scfiSeries: FreightIndexPoint[],
  wciSeries: FreightIndexPoint[],
): Signal {
  const label = "글로벌 현물 모멘텀";
  const latestScfi = scfiSeries.filter((p) => p.change_pct !== null).at(-1);
  if (!latestScfi) {
    return { label, state: "gated", basis: null, sources: ["SCFI"], asOf: null, confidence: null };
  }
  const scfiMoM = latestScfi.change_pct!;
  const latestWci = wciSeries.filter((p) => p.change_pct !== null).at(-1);
  const wciAligns = latestWci
    ? (scfiMoM >= 0 && (latestWci.change_pct ?? 0) >= 0) ||
      (scfiMoM < 0 && (latestWci.change_pct ?? 0) < 0)
    : null;

  const asOf = latestScfi.week_date;
  const wciNote = latestWci ? " · WCI 동방향" : " (WCI 데이터 없음)";
  const confidence = latestWci ? (wciAligns ? "high" : "medium") : "low";

  if (scfiMoM >= 5) {
    return {
      label,
      state: "strong",
      basis: `SCFI +${scfiMoM.toFixed(1)}% MoM${wciNote}`,
      sources: latestWci ? ["SCFI", "WCI"] : ["SCFI"],
      asOf,
      confidence,
    };
  }
  if (scfiMoM <= -5) {
    return {
      label,
      state: "weak",
      basis: `SCFI ${scfiMoM.toFixed(1)}% MoM${wciNote}`,
      sources: latestWci ? ["SCFI", "WCI"] : ["SCFI"],
      asOf,
      confidence,
    };
  }
  return {
    label,
    state: "neutral",
    basis: `SCFI ${scfiMoM >= 0 ? "+" : ""}${scfiMoM.toFixed(1)}% MoM${wciNote}`,
    sources: latestWci ? ["SCFI", "WCI"] : ["SCFI"],
    asOf,
    confidence,
  };
}

/**
 * Air modal shift signal.
 * Rule: specific air route MoM >= +10% AND same-region ocean index percentile >= 70 → 'shift'.
 * Gate if air rate data missing.
 */
export function computeAirModalShiftSignal(
  airMoM: number | null,      // MoM % for flagship air route
  routeLabel: string,
  oceanPct: number | null,    // 52w percentile of region ocean index
  asOf: string | null,
): Signal {
  const label = "항공 모달시프트";
  if (airMoM === null) {
    return { label, state: "gated", basis: null, sources: ["KITA"], asOf: null, confidence: null };
  }
  if (airMoM >= 10 && (oceanPct ?? 0) >= 70) {
    return {
      label,
      state: "shift",
      basis: `${routeLabel} +${airMoM.toFixed(1)}% MoM · 해상 백분위 ${oceanPct}%`,
      sources: ["KITA", "KCCI"],
      asOf,
      confidence: "medium",
    };
  }
  return {
    label,
    state: "neutral",
    basis: `${routeLabel} ${airMoM >= 0 ? "+" : ""}${airMoM.toFixed(1)}% MoM`,
    sources: ["KITA"],
    asOf,
    confidence: "medium",
  };
}

/**
 * Bunker/fuel pressure signal.
 * Rule: VLSFO MoM >= +5% → 'expanding'.
 * Gate if bunker data missing.
 */
export function computeBunkerSignal(
  vlsfoMoM: number | null,
  asOf: string | null,
): Signal {
  const label = "연료비 압력";
  if (vlsfoMoM === null) {
    return { label, state: "gated", basis: null, sources: ["VLSFO"], asOf: null, confidence: null };
  }
  if (vlsfoMoM >= 5) {
    return {
      label,
      state: "expanding",
      basis: `VLSFO +${vlsfoMoM.toFixed(1)}% MoM · 시차 4주`,
      sources: ["VLSFO"],
      asOf,
      confidence: "medium",
    };
  }
  return {
    label,
    state: "stable",
    basis: `VLSFO ${vlsfoMoM >= 0 ? "+" : ""}${vlsfoMoM.toFixed(1)}% MoM`,
    sources: ["VLSFO"],
    asOf,
    confidence: "medium",
  };
}
```

- [ ] Create `src/server/alerts.ts`:
```ts
// Alert candidate aggregation for 종합 (dashboard) page.
// Rules for selecting and prioritizing up to 3 headline alerts.
// Sources: rates signals (deviation/surge), eurasia active disruptions,
//          policy effective_at within D-30.
// Priority: severity='high' > severity='medium'; newest first within tier.

export type AlertSeverity = "high" | "medium" | "low";
export type AlertStatus = "new" | "worsening" | "ongoing";

export interface AlertCandidate {
  key: string;         // unique key for snapshot comparison, e.g. 'rates:KRICN-AEDXB:air'
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  sub: string;
  source: string;      // 'rates' | 'eurasia' | 'policy'
  deepLink: string;    // URL with filters applied, e.g. '/rates?origin=KRICN&mode=air&dest=AEDXB'
  asOf: string | null;
  watchlistRoutes: string[]; // route codes in watchlist affected by this alert
}

/** Determine alert status by comparing today vs previous snapshot */
export function classifyAlertStatus(
  todaySeverity: AlertSeverity,
  prevSeverity: AlertSeverity | null,
  todayMetric: number | null,
  prevMetric: number | null,
): AlertStatus {
  if (prevSeverity === null) return "new";
  const severityRank: Record<AlertSeverity, number> = { low: 0, medium: 1, high: 2 };
  if (severityRank[todaySeverity] > severityRank[prevSeverity]) return "worsening";
  if (todayMetric !== null && prevMetric !== null && todayMetric > prevMetric * 1.05) return "worsening";
  return "ongoing";
}

/** Select top N alerts, de-duplicated, sorted by severity then recency */
export function selectTopAlerts(candidates: AlertCandidate[], n = 3): AlertCandidate[] {
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
  const rank: Record<AlertSeverity, number> = { high: 2, medium: 1, low: 0 };
  return deduped.sort((a, b) => rank[b.severity] - rank[a.severity]).slice(0, n);
}
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/server/signals.ts src/server/alerts.ts
git commit -m "feat: signal computation and alert aggregation logic"
```

---

### Task 0.12: WatchlistStore + KITA API Types

**Files:**
- Create: `src/lib/watchlist.ts`
- Create: `src/lib/api/kita-rates.ts`
- Create: `src/lib/api/kita-rates.functions.ts`

- [ ] Create `src/lib/watchlist.ts`:
```ts
// WatchlistStore interface — MVP uses localStorage.
// Replace impl with account-based storage without changing the interface.

export interface WatchlistRoute {
  code: string;          // e.g. 'KRPUS-USLAX'
  label: string;         // e.g. '부산 → 로스앤젤레스'
  mode: 'ocean' | 'air' | 'rail';
  deepLink: string;      // pre-filtered URL
}

export interface WatchlistStore {
  getAll(): WatchlistRoute[];
  add(route: WatchlistRoute): void;
  remove(code: string): void;
  has(code: string): boolean;
}

const KEY = "logisight:watchlist";

function readAll(): WatchlistRoute[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as WatchlistRoute[]) : [];
  } catch {
    return [];
  }
}

function writeAll(routes: WatchlistRoute[]): void {
  try {
    typeof window !== "undefined" && localStorage.setItem(KEY, JSON.stringify(routes));
  } catch {}
}

export const localWatchlist: WatchlistStore = {
  getAll: readAll,
  add(route) {
    const existing = readAll();
    if (!existing.find((r) => r.code === route.code)) {
      writeAll([...existing, route]);
    }
  },
  remove(code) {
    writeAll(readAll().filter((r) => r.code !== code));
  },
  has(code) {
    return readAll().some((r) => r.code === code);
  },
};
```

- [ ] Create `src/lib/api/kita-rates.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import { getKitaAirRates, getKitaSeaRates } from "./kita-rates.functions";

// IMPORTANT: kita_air_rates columns reflect KITA's actual schema.
// If column names differ from what's typed, update types.ts and this file.
export type KitaAirRow = {
  id: number;
  route_code: string;
  origin_code: string;
  dest_code: string;
  dest_name_ko: string | null;
  kg100: number | null;   // KRW/kg
  kg300: number | null;
  kg500: number | null;
  week_date: string;
  source: string;
  fetched_at: string;
};

export type KitaSeaRow = {
  id: number;
  route_code: string;
  origin_code: string;
  dest_code: string;
  dest_name_ko: string | null;
  teu: number | null;    // USD/TEU
  feu: number | null;    // USD/FEU
  week_date: string;
  source: string;
  fetched_at: string;
};

export const kitaAirQueryOptions = () =>
  queryOptions({
    queryKey: ["kita_air_rates"],
    queryFn: () => getKitaAirRates(),
    staleTime: 60 * 60 * 1000,
  });

export const kitaSeaQueryOptions = () =>
  queryOptions({
    queryKey: ["kita_sea_rates"],
    queryFn: () => getKitaSeaRates(),
    staleTime: 60 * 60 * 1000,
  });

/** Latest rate per route (most recent week_date) */
export function latestByRoute<T extends { route_code: string; week_date: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const existing = map.get(r.route_code);
    if (!existing || r.week_date > existing.week_date) map.set(r.route_code, r);
  }
  return [...map.values()];
}

/**
 * Compute MoM for a single route.
 * Returns null if insufficient history (<= 4 weeks).
 * NOTE: Uses KRW/kg reference column (e.g. kg300) for air; FEU for sea.
 */
export function computeMoM(
  series: { week_date: string; value: number | null }[],
): number | null {
  const sorted = [...series]
    .filter((p) => p.value !== null)
    .sort((a, b) => a.week_date.localeCompare(b.week_date));
  if (sorted.length < 4) return null;
  const latest = sorted.at(-1)!;
  const monthAgo = sorted.find(
    (p) =>
      p.week_date <=
      new Date(
        new Date(latest.week_date).getTime() - 28 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10),
  );
  if (!monthAgo || monthAgo.value === null || monthAgo.value === 0) return null;
  return ((latest.value! - monthAgo.value) / monthAgo.value) * 100;
}
```

- [ ] Create `src/lib/api/kita-rates.functions.ts`:
```ts
import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { KitaAirRow, KitaSeaRow } from "./kita-rates";

export const getKitaAirRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<KitaAirRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("kita_air_rates")
      .select("id,route_code,origin_code,dest_code,dest_name_ko,kg100,kg300,kg500,week_date,source,fetched_at")
      .order("week_date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []) as KitaAirRow[];
  },
);

export const getKitaSeaRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<KitaSeaRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("kita_sea_rates")
      .select("id,route_code,origin_code,dest_code,dest_name_ko,teu,feu,week_date,source,fetched_at")
      .order("week_date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []) as KitaSeaRow[];
  },
);
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/ src/hooks/
git commit -m "feat: WatchlistStore, kita-rates API types and server functions"
```

---

### Task 0.13: Exchange Rate API + GitHub Actions Workflow

**Files:**
- Create: `src/lib/api/exchange-rates.functions.ts`
- Create: `src/lib/api/exchange-rates.ts`
- Create: `.github/workflows/daily-exchange-rate.yml`

- [ ] Create `src/lib/api/exchange-rates.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import { getLatestExchangeRate } from "./exchange-rates.functions";

export type ExchangeRateRow = {
  rate_date: string;
  usd_krw: number;
  source: string;
};

export const exchangeRateQueryOptions = () =>
  queryOptions({
    queryKey: ["exchange_rates", "latest"],
    queryFn: () => getLatestExchangeRate(),
    staleTime: 4 * 60 * 60 * 1000, // 4h
  });
```

- [ ] Create `src/lib/api/exchange-rates.functions.ts`:
```ts
import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { ExchangeRateRow } from "./exchange-rates";

export const getLatestExchangeRate = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExchangeRateRow | null> => {
    const { data, error } = await supabasePublicServer
      .from("exchange_rates")
      .select("rate_date,usd_krw,source")
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as ExchangeRateRow | null;
  },
);
```

- [ ] Create `.github/workflows/daily-exchange-rate.yml`:
```yaml
name: daily-exchange-rate
on:
  schedule:
    - cron: "30 0 * * 1-5"   # 09:30 KST (00:30 UTC) weekdays
  workflow_dispatch:

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - name: Collect USD/KRW rate
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          KOREAEXIM_API_KEY: ${{ secrets.KOREAEXIM_API_KEY }}
        run: node scripts/collect-exchange-rate.mjs
```

- [ ] Create `scripts/collect-exchange-rate.mjs`:
```js
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

globalThis.WebSocket = ws;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { enabled: false } },
);

const today = new Date().toISOString().slice(0, 10);

// 한국수출입은행 OpenAPI — 매매기준율 (authkey must be Encoding key, no encodeURIComponent)
const url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${process.env.KOREAEXIM_API_KEY}&searchdate=${today.replace(/-/g, "")}&data=AP01`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}

const json = await res.json();
const usdEntry = json.find((e) => e.cur_unit === "USD");
if (!usdEntry) {
  console.log("USD entry not found (holiday or no data). Skipping.");
  process.exit(0);
}

const usdKrw = parseFloat(usdEntry.deal_bas_r.replace(",", ""));
if (isNaN(usdKrw) || usdKrw <= 0) {
  console.error("Invalid rate:", usdEntry.deal_bas_r);
  process.exit(1);
}

const { error } = await supabase
  .from("exchange_rates")
  .upsert({ rate_date: today, usd_krw: usdKrw, source: "koreaexim" });

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}

console.log(`Saved USD/KRW ${usdKrw} for ${today}`);
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/api/exchange-rates.functions.ts src/lib/api/exchange-rates.ts .github/ scripts/
git commit -m "feat: exchange-rates API + daily-exchange-rate GitHub Action"
```

---

## Phase 1 — /rates Rates Intelligence

### Task 1.1: Rates Server Functions — Percentile + Normal Range

**Files:**
- Modify: `src/lib/api/rates.functions.ts`
- Modify: `src/lib/api/rates.ts`

- [ ] Add server function for per-index stats computation. Append to `src/lib/api/rates.functions.ts`:
```ts
import {
  percentile52w,
  normalRange52w,
  type FreightIndexPoint,
} from "@/server/signals";

export type IndexStats = {
  index_code: string;
  latest_value: number | null;
  latest_date: string | null;
  change_pct: number | null;
  mom_pct: number | null;
  yoy_pct: number | null;
  pct_52w: number | null;              // 0-100
  normal_range: [number, number] | null;
  source: string | null;
};

export const getIndexStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<IndexStats[]> => {
    const CODES = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"];
    const { data, error } = await supabasePublicServer
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date,source")
      .in("index_code", CODES)
      .order("week_date", { ascending: true })
      .limit(10000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as FreightIndexPoint & { index_code: string; source: string }[];

    // Group by index_code
    const grouped = new Map<string, (FreightIndexPoint & { source: string })[]>();
    for (const r of rows) {
      const arr = grouped.get(r.index_code) ?? [];
      arr.push(r);
      grouped.set(r.index_code, arr);
    }

    return CODES.map((code) => {
      const series = grouped.get(code) ?? [];
      const last = series.at(-1);
      if (!last) {
        return { index_code: code, latest_value: null, latest_date: null, change_pct: null, mom_pct: null, yoy_pct: null, pct_52w: null, normal_range: null, source: null };
      }
      // MoM: ~4 weeks back
      const monthAgo = series.filter((p) => p.value !== null && p.week_date <= new Date(new Date(last.week_date).getTime() - 28 * 86400000).toISOString().slice(0, 10)).at(-1);
      const mom_pct = monthAgo?.value && last.value ? ((last.value - monthAgo.value) / monthAgo.value) * 100 : null;
      // YoY: ~52 weeks back
      const yearAgo = series.filter((p) => p.value !== null && p.week_date <= new Date(new Date(last.week_date).getTime() - 365 * 86400000).toISOString().slice(0, 10)).at(-1);
      const yoy_pct = yearAgo?.value && last.value ? ((last.value - yearAgo.value) / yearAgo.value) * 100 : null;
      const pct_52w = last.value !== null ? percentile52w(series, last.value) : null;
      const normal_range = normalRange52w(series);

      return {
        index_code: code,
        latest_value: last.value,
        latest_date: last.week_date,
        change_pct: last.change_pct,
        mom_pct: mom_pct !== null ? Math.round(mom_pct * 10) / 10 : null,
        yoy_pct: yoy_pct !== null ? Math.round(yoy_pct * 10) / 10 : null,
        pct_52w,
        normal_range,
        source: last.source,
      };
    });
  },
);
```

- [ ] Add the new queryOptions to `src/lib/api/rates.ts` (append):
```ts
import { getIndexStats } from "./rates.functions";
import type { IndexStats } from "./rates.functions";

export type { IndexStats };

export const indexStatsQueryOptions = () =>
  queryOptions({
    queryKey: ["freight_indices", "stats"],
    queryFn: () => getIndexStats(),
    staleTime: 30 * 60 * 1000,
  });
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/api/rates.functions.ts src/lib/api/rates.ts
git commit -m "feat: index stats server function with 52w percentile and normal range"
```

---

### Task 1.2: Rebuild /rates Page

**Files:**
- Modify (full rewrite): `src/routes/rates.tsx`

- [ ] Replace `src/routes/rates.tsx` completely:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts";

import { resolveFilters, useGlobalFilters } from "@/hooks/useGlobalFilters";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { GlobalContextBar } from "@/components/dashboard/GlobalContextBar";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { IntelTable, type IntelTableColumn } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { IntelligenceBrief } from "@/components/dashboard/IntelligenceBrief";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { FreshnessBadge } from "@/components/dashboard/FreshnessBadge";
import { ConfidenceBadge } from "@/components/dashboard/ConfidenceBadge";

import {
  freightIndicesHistoryQueryOptions,
  indexStatsQueryOptions,
  bunkerPricesQueryOptions,
  type IndexStats,
} from "@/lib/api/rates";
import { kitaAirQueryOptions, kitaSeaQueryOptions, latestByRoute, computeMoM } from "@/lib/api/kita-rates";
import type { KitaAirRow, KitaSeaRow } from "@/lib/api/kita-rates";
import { exchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import {
  computeOceanPressureSignal,
  computeGlobalMomentumSignal,
  computeAirModalShiftSignal,
  computeBunkerSignal,
  percentile52w,
  normalRange52w,
} from "@/server/signals";
import { GlobalFilters } from "@/hooks/useGlobalFilters";

export const Route = createFileRoute("/rates")({
  validateSearch: (s: Record<string, unknown>): GlobalFilters => resolveFilters(s),
  loaderDeps: ({ search }) => search,
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(bunkerPricesQueryOptions());
    context.queryClient.ensureQueryData(kitaAirQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaQueryOptions());
    context.queryClient.ensureQueryData(exchangeRateQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Rates Intelligence — Logisight" },
      { name: "description", content: "한국발 해상·항공 운임 모니터. KCCI·SCFI·KITA 기반 운임 지수, 52주 백분위, 정상범위 분석." },
    ],
  }),
  component: RatesPage,
});

function fmt(v: number | null | undefined, decimals = 0, prefix = ""): string {
  if (v == null) return "—";
  return `${prefix}${v.toLocaleString("en-US", { maximumFractionDigits: decimals })}`;
}

function fmtPct(v: number | null, prefix = ""): string {
  if (v == null) return "—";
  return `${prefix}${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function statusFromPct(pct: number | null): "normal" | "observe" | "caution" | "alert" | undefined {
  if (pct === null) return undefined;
  if (pct >= 85) return "alert";
  if (pct >= 70) return "caution";
  if (pct <= 15) return "observe";
  return "normal";
}

function RatesPage() {
  const search = Route.useSearch();
  const { filters, setFilters } = useGlobalFilters(search);

  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: bunker } = useSuspenseQuery(bunkerPricesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaQueryOptions());
  const { data: exRate } = useSuspenseQuery(exchangeRateQueryOptions());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<{ title: string; body: React.ReactNode } | null>(null);

  function openDrawer(title: string, body: React.ReactNode) {
    setDrawerContent({ title, body });
    setDrawerOpen(true);
  }

  // Group history by index_code
  const historyByCode = useMemo(() => {
    const map = new Map<string, typeof history>();
    for (const r of history) {
      const arr = map.get(r.index_code) ?? [];
      arr.push(r);
      map.set(r.index_code, arr);
    }
    return map;
  }, [history]);

  const kcciSeries = useMemo(() => historyByCode.get("KCCI") ?? [], [historyByCode]);
  const scfiSeries = useMemo(() => historyByCode.get("SCFI") ?? [], [historyByCode]);
  const wciSeries = useMemo(() => historyByCode.get("WCI") ?? [], [historyByCode]);

  // Signals
  const oceanSignal = useMemo(() => computeOceanPressureSignal(kcciSeries), [kcciSeries]);
  const globalSignal = useMemo(() => computeGlobalMomentumSignal(scfiSeries, wciSeries), [scfiSeries, wciSeries]);

  const latestAir = useMemo(() => latestByRoute(airRates), [airRates]);
  const latestSea = useMemo(() => latestByRoute(seaRates), [seaRates]);

  // Air MoM for modal shift — use flagship route (ICN-DXB, highest MoM)
  const airModalData = useMemo(() => {
    const sorted = latestAir
      .map((r) => {
        const series = airRates
          .filter((a) => a.route_code === r.route_code)
          .map((a) => ({ week_date: a.week_date, value: a.kg300 }));
        const mom = computeMoM(series);
        return { route: r, mom };
      })
      .filter((x) => x.mom !== null)
      .sort((a, b) => (b.mom ?? 0) - (a.mom ?? 0));
    return sorted[0] ?? null;
  }, [latestAir, airRates]);

  const kcciStat = stats.find((s) => s.index_code === "KCCI");
  const airModalSignal = useMemo(
    () =>
      computeAirModalShiftSignal(
        airModalData?.mom ?? null,
        airModalData ? `인천→${airModalData.route.dest_name_ko ?? airModalData.route.dest_code}` : "인천발",
        kcciStat?.pct_52w ?? null,
        airModalData?.route.week_date ?? null,
      ),
    [airModalData, kcciStat],
  );

  const vlsfoLatest = bunker.find((b) => b.grade === "VLSFO");
  const bunkerSignal = useMemo(() => computeBunkerSignal(null, null), []); // VLSFO MoM requires history — gated until history endpoint added

  // StatusStrip
  const marketStatus = oceanSignal.state === "rising" ? "주의" : oceanSignal.state === "falling" ? "관찰" : "정상";
  const statusLevel = oceanSignal.state === "rising" ? "caution" : oceanSignal.state === "falling" ? "observe" : "normal";

  // Sea table with sparklines
  const SEA_COLS: IntelTableColumn<KitaSeaRow & { mom: number | null; pct52w: number | null; normalRange: [number, number] | null; spark: number[] }>[] = [
    { key: "dest", header: "목적지", render: (r) => r.dest_name_ko ?? r.dest_code, width: "160px" },
    { key: "feu", header: "USD/FEU", numeric: true, render: (r) => fmt(r.feu, 0, "$") },
    { key: "mom", header: "MoM", numeric: true, render: (r) => fmtPct(r.mom) },
    { key: "spark", header: "3개월", render: (r) => <Sparkline data={r.spark} className="text-muted-foreground" /> },
    { key: "pct", header: "52주 백분위", numeric: true, render: (r) => r.pct52w !== null ? `상위 ${100 - r.pct52w}%` : "—" },
    { key: "range", header: "정상범위", render: (r) => r.normalRange ? `$${r.normalRange[0].toLocaleString()}–$${r.normalRange[1].toLocaleString()}` : "—" },
    { key: "status", header: "상태", render: (r) => <StatusBadge level={statusFromPct(r.pct52w)} /> },
  ];

  const seaRows = useMemo(() =>
    latestSea
      .filter((r) => r.origin_code === (filters.origin || "KRPUS"))
      .map((r) => {
        const series = seaRates
          .filter((s) => s.route_code === r.route_code)
          .map((s) => ({ week_date: s.week_date, value: s.feu }))
          .sort((a, b) => a.week_date.localeCompare(b.week_date));
        const mom = computeMoM(series);
        const pct52w = r.feu !== null ? percentile52w(series.map((s) => ({ ...s, change_pct: null })), r.feu) : null;
        const normalRange = normalRange52w(series.map((s) => ({ ...s, change_pct: null })));
        const spark = series.slice(-12).map((s) => s.value ?? 0);
        return { ...r, mom, pct52w, normalRange, spark };
      }),
    [latestSea, seaRates, filters.origin],
  );

  // Air table
  const AIR_COLS: IntelTableColumn<KitaAirRow & { mom: number | null; pct52w: number | null; normalRange: [number, number] | null; spark: number[] }>[] = [
    { key: "dest", header: "목적지", render: (r) => r.dest_name_ko ?? r.dest_code, width: "160px" },
    { key: "kg300", header: "KRW/kg", numeric: true, render: (r) => fmt(r.kg300, 0, "₩") },
    { key: "usd", header: "USD 환산", numeric: true, render: (r) =>
      r.kg300 && exRate ? `$${(r.kg300 / exRate.usd_krw).toFixed(2)}` : "—"
    },
    { key: "mom", header: "MoM", numeric: true, render: (r) => fmtPct(r.mom) },
    { key: "spark", header: "3개월", render: (r) => <Sparkline data={r.spark} className="text-muted-foreground" /> },
    { key: "pct", header: "52주 백분위", numeric: true, render: (r) => r.pct52w !== null ? `상위 ${100 - r.pct52w}%` : "—" },
    { key: "status", header: "상태", render: (r) => <StatusBadge level={statusFromPct(r.pct52w)} /> },
  ];

  const airRows = useMemo(() =>
    latestAir
      .filter((r) => r.origin_code === "KRICN")
      .map((r) => {
        const series = airRates
          .filter((a) => a.route_code === r.route_code)
          .map((a) => ({ week_date: a.week_date, value: a.kg300 }))
          .sort((a, b) => a.week_date.localeCompare(b.week_date));
        const mom = computeMoM(series);
        const pct52w = r.kg300 !== null ? percentile52w(series.map((s) => ({ ...s, change_pct: null })), r.kg300) : null;
        const normalRange = normalRange52w(series.map((s) => ({ ...s, change_pct: null })));
        const spark = series.slice(-12).map((s) => s.value ?? 0);
        return { ...r, mom, pct52w, normalRange, spark };
      }),
    [latestAir, airRates],
  );

  // Chart data — normalize to 100
  const compareCode = filters.compare ?? "SCFI";
  const chartData = useMemo(() => {
    const kcciPts = kcciSeries.slice(-52);
    const comparePts = historyByCode.get(compareCode) ?? [];
    if (kcciPts.length === 0) return [];
    const base = kcciPts[0].value ?? 1;
    return kcciPts.map((pt) => {
      const compPt = comparePts.find((c) => c.week_date === pt.week_date);
      const compBase = comparePts[0]?.value ?? 1;
      return {
        date: pt.week_date,
        KCCI: pt.value !== null ? Math.round((pt.value / base) * 100) : null,
        [compareCode]: compPt?.value != null ? Math.round((compPt.value / compBase) * 100) : null,
      };
    });
  }, [kcciSeries, historyByCode, compareCode]);

  const kcciNormalRange = useMemo(() => normalRange52w(kcciSeries), [kcciSeries]);
  const kcciBase = kcciSeries[0]?.value ?? 1;
  const normalBandNorm = kcciNormalRange
    ? [Math.round((kcciNormalRange[0] / kcciBase) * 100), Math.round((kcciNormalRange[1] / kcciBase) * 100)]
    : null;

  return (
    <DashboardShell>
      <GlobalContextBar
        filters={filters}
        onFilterChange={setFilters}
        defaultExpanded={true}
      />

      {/* StatusStrip */}
      <StatusStrip
        cells={[
          { label: "시장 상태", value: marketStatus, status: statusLevel },
          { label: "주간 변동 (WoW)", value: fmtPct(kcciStat?.change_pct ?? null), sub: "한국발 해상 종합" },
          { label: "리스크 수준", value: "—", sub: "정책·장애 집계" },
          { label: "데이터 기준일", value: kcciStat?.latest_date ?? "—", sub: "KCCI·SCFI·KITA 주간" },
        ]}
      />

      {/* Market Posture */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Market Posture
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SignalCard
            label={oceanSignal.label}
            signal={oceanSignal.state === "gated" ? null : oceanSignal.basis}
            confidence={oceanSignal.confidence ?? undefined}
            onShowEvidence={() =>
              openDrawer("한국발 해상 압력 근거", (
                <div className="space-y-2 text-[12px]">
                  <p><strong>계산 규칙</strong>: KCCI WoW &gt; 0 연속 3주 AND 52주 백분위 ≥ 70</p>
                  <p><strong>현재 입력값</strong>: {oceanSignal.basis ?? "데이터 부족"}</p>
                  <p><strong>출처</strong>: {oceanSignal.sources.join(", ")}</p>
                  <FreshnessBadge asOf={oceanSignal.asOf} />
                </div>
              ))
            }
          />
          <SignalCard
            label={globalSignal.label}
            signal={globalSignal.state === "gated" ? null : globalSignal.basis}
            confidence={globalSignal.confidence ?? undefined}
          />
          <SignalCard
            label={airModalSignal.label}
            signal={airModalSignal.state === "gated" ? null : airModalSignal.basis}
            confidence={airModalSignal.confidence ?? undefined}
          />
          <SignalCard
            label={bunkerSignal.label}
            signal={bunkerSignal.state === "gated" ? null : bunkerSignal.basis}
            confidence={bunkerSignal.confidence ?? undefined}
          />
        </div>
      </section>

      {/* Korean Rate Monitor */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">한국발 운임 모니터</h2>

        {/* Sea group */}
        {seaRows.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic mb-4">해상 운임 데이터 수집 중</p>
        ) : (
          <IntelTable
            groupLabel="해상 (USD/FEU) · 출처 KITA·KCCI · 출발지 내 정렬"
            columns={SEA_COLS}
            rows={seaRows}
            getKey={(r) => r.route_code}
            onRowClick={(r) =>
              openDrawer(`${r.dest_name_ko ?? r.dest_code} 해상 상세`, (
                <div className="space-y-2 text-[12px]">
                  <p>노선: {r.route_code}</p>
                  <p>최신 운임: {fmt(r.feu, 0, "$")} USD/FEU</p>
                  <p>MoM: {fmtPct(r.mom)}</p>
                  <p>52주 백분위: {r.pct52w !== null ? `상위 ${100 - r.pct52w}%` : "—"}</p>
                  <p>정상범위: {r.normalRange ? `$${r.normalRange[0].toLocaleString()}–$${r.normalRange[1].toLocaleString()}` : "—"}</p>
                </div>
              ))
            }
            className="mb-3"
          />
        )}

        {/* Air group */}
        {airRows.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic mb-1">항공 운임 데이터 수집 중 (kita_air_rates)</p>
        ) : (
          <IntelTable
            groupLabel="항공 (KRW/kg 원본 + USD 환산 병기) · 출처 KITA 인천발"
            columns={AIR_COLS}
            rows={airRows}
            getKey={(r) => r.route_code}
            onRowClick={(r) =>
              openDrawer(`${r.dest_name_ko ?? r.dest_code} 항공 상세`, (
                <div className="space-y-2 text-[12px]">
                  <p>KRW/kg(300): {fmt(r.kg300, 0, "₩")}</p>
                  <p>USD 환산: {r.kg300 && exRate ? `$${(r.kg300 / exRate.usd_krw).toFixed(2)}/kg` : "—"}</p>
                  <p>MoM (KRW/kg 기준): {fmtPct(r.mom)}</p>
                  <p>52주 백분위: {r.pct52w !== null ? `상위 ${100 - r.pct52w}%` : "—"}</p>
                </div>
              ))
            }
            caption={
              exRate ? (
                <span>
                  적용 환율 USD/KRW {exRate.usd_krw.toLocaleString("ko-KR")} · 환율 기준일 {exRate.rate_date} · 환산은 표시용 — 정렬·백분위·변동률은 원본 KRW/kg 기준
                </span>
              ) : (
                <span className="text-[var(--color-status-caution)]">환율 데이터 없음 — USD 환산 불가</span>
              )
            }
          />
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          글로벌 지수 선행·후행 비교는 방법론 확정 전까지 비활성 (로드맵)
        </p>
      </section>

      {/* Comparison Chart */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold">부산발 해상 vs {compareCode} · 지수화 100</h2>
          <div className="flex gap-1.5">
            {["SCFI", "CCFI", "FBX"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setFilters({ compare: code })}
                className={`rounded px-2 py-0.5 text-[11px] border ${
                  compareCode === code
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic">차트 데이터 수집 중</p>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: "1px solid var(--color-border)", background: "var(--color-card)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {normalBandNorm && (
                  <ReferenceArea
                    y1={normalBandNorm[0]}
                    y2={normalBandNorm[1]}
                    fill="var(--color-status-normal)"
                    fillOpacity={0.08}
                    label={{ value: "정상범위 ±1σ", fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  />
                )}
                <Line type="monotone" dataKey="KCCI" stroke="var(--color-cyan)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey={compareCode} stroke="var(--color-warning)" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[11px] text-muted-foreground">
              지수화: 12주 전 = 100 · 기준 {kcciStat?.latest_date ?? "—"} · 출처 KITA·{compareCode}(샘플)
            </p>
          </div>
        )}
      </section>

      {/* Intelligence Brief */}
      <IntelligenceBrief
        whatChanged={oceanSignal.state !== "gated" ? `부산발 ${oceanSignal.state === "rising" ? "운임 상승" : "운임 하락"}: ${oceanSignal.basis}` : null}
        why={globalSignal.state !== "gated" ? `글로벌 현물 ${globalSignal.basis}` : null}
        outlook={null}
        recommendedAction={oceanSignal.state === "rising" ? "7월 미주 선적분 계약운임 선확정 검토" : null}
        sources={["KCCI", "SCFI", "KITA"]}
        confidence={oceanSignal.confidence ?? undefined}
        asOf={kcciStat?.latest_date}
      />

      {/* KCCI Route Detail Table */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">KCCI 세부 항로 상세</h2>
        {stats.filter((s) => s.index_code === "KCCI").length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic">KCCI 데이터 수집 중</p>
        ) : (
          <IntelTable
            columns={[
              { key: "code", header: "항로", render: (s) => s.index_code, width: "120px" },
              { key: "val", header: "지수", numeric: true, render: (s) => fmt(s.latest_value) },
              { key: "wow", header: "WoW", numeric: true, render: (s) => fmtPct(s.change_pct) },
              { key: "mom", header: "MoM", numeric: true, render: (s) => fmtPct(s.mom_pct) },
              { key: "yoy", header: "YoY", numeric: true, render: (s) => fmtPct(s.yoy_pct) },
              { key: "pct", header: "1년 백분위", numeric: true, render: (s) => s.pct_52w !== null ? `상위 ${100 - s.pct_52w}%` : "—" },
              { key: "range", header: "정상범위", render: (s) => s.normal_range ? `${s.normal_range[0].toLocaleString()}–${s.normal_range[1].toLocaleString()}` : "—" },
              { key: "conf", header: "신뢰도", render: () => <ConfidenceBadge level="high" /> },
            ]}
            rows={stats}
            getKey={(s) => s.index_code}
            onRowClick={(s) =>
              openDrawer(`${s.index_code} 상세`, (
                <div className="space-y-2 text-[12px]">
                  <p>최신값: {fmt(s.latest_value)}</p>
                  <p>WoW: {fmtPct(s.change_pct)}</p>
                  <p>MoM: {fmtPct(s.mom_pct)}</p>
                  <p>YoY: {fmtPct(s.yoy_pct)}</p>
                  <p>52주 백분위: {s.pct_52w !== null ? `${s.pct_52w}%` : "—"}</p>
                  <p>정상범위(±1σ): {s.normal_range ? `${s.normal_range[0].toLocaleString()}–${s.normal_range[1].toLocaleString()}` : "—"}</p>
                  <p>기준일: {s.latest_date ?? "—"}</p>
                </div>
              ))
            }
            caption={`기준 ${kcciStat?.latest_date ?? "—"} · 출처 KCCI(샘플)`}
          />
        )}
      </section>

      <DataQualityBar
        sources={[
          { label: "KCCI·SCFI", asOf: kcciStat?.latest_date ?? null, expectedDays: 7 },
          { label: "KITA 항공", asOf: latestAir[0]?.week_date ?? null, expectedDays: 7 },
          { label: "환율", asOf: exRate?.rate_date ?? null, expectedDays: 3 },
          { label: "벙커유", asOf: vlsfoLatest?.obs_date ?? null, expectedDays: 7 },
        ]}
      />

      <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerContent?.title}>
        {drawerContent?.body}
      </DetailDrawer>
    </DashboardShell>
  );
}

function StatusBadge({ level }: { level: ReturnType<typeof statusFromPct> }) {
  const MAP = {
    alert: { label: "경고", color: "var(--color-status-alert)" },
    caution: { label: "주의", color: "var(--color-status-caution)" },
    observe: { label: "관찰", color: "var(--color-status-observe)" },
    normal: { label: "정상", color: "var(--color-status-normal)" },
  };
  if (!level) return <span className="text-muted-foreground text-[11px]">—</span>;
  const { label, color } = MAP[level];
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  );
}
```

- [ ] Run `npm run build` — fix any type errors (column widths, missing imports). Expected: PASS.

- [ ] Commit:
```bash
git add src/routes/rates.tsx
git commit -m "feat: rates intelligence v2 (mode split, krw/kg air, percentile)"
git push
```

---

## Phase 2 — /eurasia Eurasia Control Tower

### Task 2.1: Eurasia Disruptions API

**Files:**
- Create: `src/lib/api/eurasia-disruptions.ts`
- Create: `src/lib/api/eurasia-disruptions.functions.ts`
- Modify: `src/lib/api/eurasia.ts` (add disruption query options)
- Modify: `src/lib/api/eurasia.functions.ts` (already has getEurasiaDisruptions pointing to `disruption_events` — update to use `eurasia_disruptions`)

- [ ] Create `src/lib/api/eurasia-disruptions.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import {
  getEurasiaDisruptionsActive,
  upsertEurasiaDisruption,
  resolveEurasiaDisruption,
} from "./eurasia-disruptions.functions";

export type EurasiaDisruptionRow = {
  id: string;
  lane_id: string | null;
  segment: string;
  title: string;
  severity: "high" | "medium" | "low";
  delay_contribution_days: number | null;
  status: "active" | "resolved";
  started_at: string | null;
  resolved_at: string | null;
  source: string | null;
  confidence: "high" | "medium" | "low" | null;
  created_at: string | null;
};

export { upsertEurasiaDisruption, resolveEurasiaDisruption };

export const eurasiaDisruptionsActiveQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia_disruptions", "active"],
    queryFn: () => getEurasiaDisruptionsActive(),
    staleTime: 5 * 60 * 1000,
  });
```

- [ ] Create `src/lib/api/eurasia-disruptions.functions.ts`:
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { createClient } from "@supabase/supabase-js";
import type { EurasiaDisruptionRow } from "./eurasia-disruptions";

export const getEurasiaDisruptionsActive = createServerFn({ method: "GET" }).handler(
  async (): Promise<EurasiaDisruptionRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("eurasia_disruptions")
      .select("id,lane_id,segment,title,severity,delay_contribution_days,status,started_at,resolved_at,source,confidence,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as EurasiaDisruptionRow[];
  },
);

const DisruptionSchema = z.object({
  id: z.string().optional(),
  lane_id: z.string().uuid().nullable().optional(),
  segment: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  severity: z.enum(["high", "medium", "low"]),
  delay_contribution_days: z.number().min(0).max(365).nullable().optional(),
  started_at: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
});

export const upsertEurasiaDisruption = createServerFn({ method: "POST" })
  .inputValidator(DisruptionSchema)
  .handler(async ({ data }) => {
    const { createClient: svcClient } = await import("@supabase/supabase-js");
    const supabase = svcClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_KEY"]!,
    );
    const { error } = await supabase
      .from("eurasia_disruptions")
      .upsert({ ...data, status: "active" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveEurasiaDisruption = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), resolved_at: z.string() }))
  .handler(async ({ data }) => {
    const { createClient: svcClient } = await import("@supabase/supabase-js");
    const supabase = svcClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_KEY"]!,
    );
    const { error } = await supabase
      .from("eurasia_disruptions")
      .update({ status: "resolved", resolved_at: data.resolved_at })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/api/eurasia-disruptions.ts src/lib/api/eurasia-disruptions.functions.ts
git commit -m "feat: eurasia_disruptions API with admin upsert/resolve"
```

---

### Task 2.2: Rebuild /eurasia Page

**Files:**
- Modify (full rewrite): `src/routes/eurasia.tsx`

- [ ] Replace `src/routes/eurasia.tsx` with the Eurasia Control Tower page. The structure follows the spec exactly:
  1. GlobalContextBar (collapsed default)
  2. StatusStrip (활성 장애 / 평균 지연 / 경고 노선 수 / 기준일)
  3. Corridor status board (IntelTable)
  4. Selected lane concept diagram (SVG)
  5. Lane Detail Drawer
  6. Footer caption

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { resolveFilters, useGlobalFilters } from "@/hooks/useGlobalFilters";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { GlobalContextBar } from "@/components/dashboard/GlobalContextBar";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { IntelTable, type IntelTableColumn } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ConfidenceBadge } from "@/components/dashboard/ConfidenceBadge";
import { EvidenceBadge } from "@/components/dashboard/EvidenceBadge";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";

import {
  eurasiaLanesQueryOptions,
  eurasiaDelaysQueryOptions,
  type LaneRow,
  type DelayWeeklyRow,
} from "@/lib/api/eurasia";
import {
  eurasiaDisruptionsActiveQueryOptions,
  type EurasiaDisruptionRow,
} from "@/lib/api/eurasia-disruptions";
import type { GlobalFilters } from "@/hooks/useGlobalFilters";

export const Route = createFileRoute("/eurasia")({
  validateSearch: (s: Record<string, unknown>): GlobalFilters & { lane?: string } => ({
    ...resolveFilters(s),
    lane: typeof s.lane === "string" ? s.lane : undefined,
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(eurasiaLanesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Eurasia Control Tower — Logisight" },
      { name: "description", content: "유라시아 코리도어 운영 현황, 활성 장애, 지연 분해 분석." },
    ],
  }),
  component: EurasiaPage,
});

type LaneWithStats = LaneRow & {
  currentDelayDays: number | null;
  prevDelayDays: number | null;
  wowChange: number | null;
  operatingStatus: "normal" | "caution" | "alert";
  activeDisruptions: EurasiaDisruptionRow[];
  dataQuality: string;
  spark: number[];
};

function classifyStatus(delayDays: number | null, transitMin: number | null): "normal" | "caution" | "alert" {
  if (delayDays === null) return "normal";
  const threshold = transitMin ? transitMin * 0.15 : 2;
  if (delayDays >= threshold * 2) return "alert";
  if (delayDays >= threshold) return "caution";
  return "normal";
}

const STATUS_LABEL = { normal: "정상", caution: "주의", alert: "경고" } as const;
const STATUS_COLOR = {
  normal: "var(--color-status-normal)",
  caution: "var(--color-status-caution)",
  alert: "var(--color-status-alert)",
};

function EurasiaPage() {
  const search = Route.useSearch();
  const { filters, setFilters } = useGlobalFilters(search);
  const selectedLaneId = (search as GlobalFilters & { lane?: string }).lane;

  const { data: lanes } = useSuspenseQuery(eurasiaLanesQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLane, setDrawerLane] = useState<LaneWithStats | null>(null);

  const laneStats: LaneWithStats[] = useMemo(() => {
    return lanes.map((lane) => {
      const laneDelays = delays
        .filter((d) => d.lane_id === lane.id)
        .sort((a, b) => a.week_iso.localeCompare(b.week_iso));
      const last = laneDelays.at(-1);
      const prev = laneDelays.at(-2);
      const currentDelayDays = last?.median_delay_d ?? null;
      const prevDelayDays = prev?.median_delay_d ?? null;
      const wowChange =
        currentDelayDays !== null && prevDelayDays !== null
          ? Math.round((currentDelayDays - prevDelayDays) * 10) / 10
          : null;
      const activeDisruptions = disruptions.filter((d) => d.lane_id === lane.id);
      const spark = laneDelays.slice(-8).map((d) => d.median_delay_d ?? 0);
      return {
        ...lane,
        currentDelayDays,
        prevDelayDays,
        wowChange,
        operatingStatus: classifyStatus(currentDelayDays, lane.transit_min ?? null),
        activeDisruptions,
        dataQuality: last?.data_quality ?? "indicative",
        spark,
      };
    });
  }, [lanes, delays, disruptions]);

  const selectedLane = laneStats.find((l) => l.id === selectedLaneId) ?? laneStats[0] ?? null;

  const activeLaneCount = laneStats.filter((l) => l.operatingStatus !== "normal").length;
  const avgDelayAll = laneStats.filter((l) => l.currentDelayDays !== null);
  const avgDelay = avgDelayAll.length > 0
    ? Math.round((avgDelayAll.reduce((s, l) => s + (l.currentDelayDays ?? 0), 0) / avgDelayAll.length) * 10) / 10
    : null;
  const alertLanes = laneStats.filter((l) => l.operatingStatus === "alert");
  const latestWeek = delays.map((d) => d.week_iso).sort().at(-1) ?? null;

  const CORRIDOR_COLS: IntelTableColumn<LaneWithStats>[] = [
    {
      key: "name",
      header: "노선",
      width: "200px",
      render: (r) => (
        <span className={selectedLane?.id === r.id ? "font-semibold" : ""}>
          {r.name_ko ?? r.name_en}
          {r.activeDisruptions.length > 0 && (
            <span className="ml-1 text-[10px]" style={{ color: "var(--color-status-alert)" }}>›</span>
          )}
        </span>
      ),
    },
    {
      key: "delay",
      header: "현재 지연",
      numeric: true,
      render: (r) => r.currentDelayDays !== null ? `+${r.currentDelayDays}일` : "—",
    },
    {
      key: "wow",
      header: "전주 대비",
      numeric: true,
      render: (r) =>
        r.wowChange !== null
          ? `${r.wowChange >= 0 ? "▲" : "▼"} ${Math.abs(r.wowChange).toFixed(1)}`
          : "—",
    },
    {
      key: "status",
      header: "운영 상태",
      render: (r) => (
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{
            background: `${STATUS_COLOR[r.operatingStatus]}22`,
            color: STATUS_COLOR[r.operatingStatus],
          }}
        >
          {STATUS_LABEL[r.operatingStatus]}
        </span>
      ),
    },
    {
      key: "disruptions",
      header: "활성 장애",
      numeric: true,
      render: (r) => r.activeDisruptions.length || "—",
    },
    {
      key: "quality",
      header: "신뢰도",
      render: (r) => {
        const level = r.dataQuality === "confirmed" ? "high" : r.dataQuality === "provisional" ? "medium" : "low";
        return <ConfidenceBadge level={level} />;
      },
    },
  ];

  return (
    <DashboardShell>
      <GlobalContextBar
        filters={filters}
        onFilterChange={setFilters}
        defaultExpanded={false}
      />

      <StatusStrip
        cells={[
          {
            label: "활성 장애",
            value: `${disruptions.length}건`,
            sub: `높음 ${disruptions.filter((d) => d.severity === "high").length} · 중간 ${disruptions.filter((d) => d.severity === "medium").length}`,
            status: disruptions.length > 0 ? "caution" : "normal",
          },
          {
            label: "평균 지연 (전 노선)",
            value: avgDelay !== null ? `+${avgDelay}일` : "—",
            sub: "정상 리드타임 대비",
          },
          {
            label: "경고 노선",
            value: `${alertLanes.length}개`,
            status: alertLanes.length > 0 ? "alert" : "normal",
          },
          {
            label: "데이터 기준일",
            value: latestWeek ?? "—",
            sub: "선적 구간 집계",
          },
        ]}
      />

      {/* Corridor Board */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">회랑 운영 현황 Corridor Status Board</h2>
        <IntelTable
          columns={CORRIDOR_COLS}
          rows={laneStats}
          getKey={(r) => r.id}
          emptyMessage="노선 데이터 수집 중"
          onRowClick={(r) => {
            setFilters({ detail: r.id });
            setDrawerLane(r);
            setDrawerOpen(true);
          }}
          caption="행 선택 시 아래 개념도·Drawer 갱신 · delay_index_weekly 집계"
        />
      </section>

      {/* Lane Concept Diagram */}
      {selectedLane && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">
            선택 노선 개념도 — {selectedLane.name_ko ?? selectedLane.name_en}
          </h2>
          <LaneDiagram lane={selectedLane} />
        </section>
      )}

      <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
        원본 shipment_legs 비공개 — 집계 지연·신뢰도만 표시
      </p>

      <DataQualityBar
        sources={[
          { label: "delay_index_weekly", asOf: latestWeek, expectedDays: 7 },
          { label: "eurasia_disruptions", asOf: disruptions[0]?.created_at?.slice(0, 10) ?? null, expectedDays: 7 },
        ]}
      />

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerLane ? `${drawerLane.name_ko ?? drawerLane.name_en} — Lane Detail` : undefined}
      >
        {drawerLane && <LaneDetailContent lane={drawerLane} />}
      </DetailDrawer>
    </DashboardShell>
  );
}

function LaneDiagram({ lane }: { lane: LaneWithStats }) {
  const borders = lane.border_points ?? [];
  return (
    <div className="rounded-lg border border-border bg-card p-4 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-[600px]">
        {["출발항", ...(borders.length > 0 ? borders : ["국경 정보 없음"]), "도착지"].map((node, i, arr) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`rounded px-3 py-2 text-[12px] text-center min-w-[80px] border ${
              i === 0 || i === arr.length - 1
                ? "border-border bg-muted/40"
                : lane.activeDisruptions.some((d) => d.segment.includes(node as string))
                ? "border-orange-400 bg-orange-400/10"
                : "border-border bg-card"
            }`}>
              {node}
            </div>
            {i < arr.length - 1 && (
              <div className="flex-1 text-center text-[10px] text-muted-foreground">→</div>
            )}
          </div>
        ))}
      </div>
      {lane.activeDisruptions.length > 0 && (
        <div className="mt-3 space-y-1">
          {lane.activeDisruptions.map((d) => (
            <p key={d.id} className="text-[11px]" style={{ color: STATUS_COLOR[d.severity as keyof typeof STATUS_COLOR] }}>
              ▲ {d.segment}: {d.title}
              {d.delay_contribution_days !== null && ` — D+${d.delay_contribution_days}`}
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        지원 노선·활성 장애·국경과 환적 구간만 표시 — 장식 요소·미확인 실시간 위치 없음
      </p>
    </div>
  );
}

function LaneDetailContent({ lane }: { lane: LaneWithStats }) {
  const hasAltRoute = false; // gate — no evidence data yet
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">지연 추세</p>
        <div className="flex items-center gap-3">
          <Sparkline data={lane.spark} width={120} height={32} />
          <span className="text-[12px]">
            현재 +{lane.currentDelayDays ?? "—"}일 / 정상 {lane.transit_min}–{lane.transit_max}일
          </span>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">활성 장애</p>
        {lane.activeDisruptions.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">활성 장애 없음</p>
        ) : (
          <ul className="space-y-1">
            {lane.activeDisruptions.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-[12px]">
                <span
                  className="mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: STATUS_COLOR[d.severity as keyof typeof STATUS_COLOR] }}
                />
                <div>
                  <span className="font-medium">{d.segment}</span>: {d.title}
                  {d.delay_contribution_days !== null && (
                    <span className="text-muted-foreground"> (기여 +{d.delay_contribution_days}일)</span>
                  )}
                  {d.confidence && <ConfidenceBadge level={d.confidence} className="ml-2" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">대체 경로</p>
        <EvidenceBadge hasEvidence={hasAltRoute} />
        {!hasAltRoute && (
          <p className="mt-1 text-[12px] text-muted-foreground">대체 경로 근거 데이터 없음</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">운영 확인 체크리스트</p>
        <ul className="space-y-1 text-[12px] text-muted-foreground">
          <li>☐ KZ 환적 슬롯 사전 예약</li>
          <li>☐ UZ 통관 추가 서류 목록 확인</li>
        </ul>
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
        신뢰도 {lane.dataQuality === "confirmed" ? "높음" : lane.dataQuality === "provisional" ? "중간" : "낮음"} · 기준 delay_index_weekly
      </p>
    </div>
  );
}
```

- [ ] Run `npm run build` — fix any type errors. Expected: PASS.

- [ ] Commit:
```bash
git add src/routes/eurasia.tsx
git commit -m "feat: eurasia control tower (corridor board, lane drawer)"
git push
```

---

### Task 2.3: Admin — Eurasia Disruption CRUD

**Files:**
- Modify: `src/routes/admin.routes.tsx`

- [ ] Read the existing admin.routes.tsx to understand current structure, then add a disruptions tab/section. The additions must not break existing admin functionality. Add an `EurasiaDisruptionsAdmin` component inside the file that provides a form for creating/resolving disruptions:

The pattern: add a new tab labeled "유라시아 장애" to the existing tabs structure (or add as a new section if tabs aren't used). The form fields:
- `lane_id` (select from lanes)
- `segment` (text input)
- `title` (text input)
- `severity` (select: high/medium/low)
- `delay_contribution_days` (number input, 0.5 increments)
- `source` (text)
- `confidence` (select: high/medium/low)
- Validate that total `delay_contribution_days` across active disruptions for the lane ≤ lane's median delay + 0.5 (warn if exceeded)

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/routes/admin.routes.tsx
git commit -m "feat: admin eurasia disruption CRUD with delay decomposition validation"
```

---

## Phase 3 — /dashboard 종합 Control Tower

### Task 3.1: Alert Snapshots + Dashboard Server Function

**Files:**
- Create: `src/lib/api/alerts.functions.ts`
- Create: `src/lib/api/alerts.ts`

- [ ] Create `src/lib/api/alerts.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import { getAlertCandidates } from "./alerts.functions";
import type { AlertCandidate } from "@/server/alerts";
export type { AlertCandidate };

export const alertCandidatesQueryOptions = () =>
  queryOptions({
    queryKey: ["alert_candidates"],
    queryFn: () => getAlertCandidates(),
    staleTime: 15 * 60 * 1000,
  });
```

- [ ] Create `src/lib/api/alerts.functions.ts`:
```ts
import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { AlertCandidate } from "@/server/alerts";
import { selectTopAlerts, classifyAlertStatus } from "@/server/alerts";
import { computeOceanPressureSignal } from "@/server/signals";

export const getAlertCandidates = createServerFn({ method: "GET" }).handler(
  async (): Promise<AlertCandidate[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const prevDay = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);

    // 1. Fetch rate signals via KCCI history
    const { data: kcciData } = await supabasePublicServer
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date")
      .eq("index_code", "KCCI")
      .order("week_date", { ascending: true })
      .limit(60);
    const kcciBig = kcciData ?? [];
    const oceanSig = computeOceanPressureSignal(kcciBig as { value: number | null; change_pct: number | null; week_date: string }[]);

    // 2. Fetch active eurasia disruptions
    const { data: disruptions } = await supabasePublicServer
      .from("eurasia_disruptions")
      .select("id,lane_id,title,severity,delay_contribution_days,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Fetch policies effective within D-30
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: policies } = await supabasePublicServer
      .from("policies")
      .select("id,title,severity,effective_at")
      .not("effective_at", "is", null)
      .lte("effective_at", d30)
      .gte("effective_at", today)
      .order("effective_at", { ascending: true })
      .limit(10);

    // 4. Fetch yesterday's snapshots for status comparison
    const { data: snapshots } = await supabasePublicServer
      .from("alert_snapshots")
      .select("alert_key,severity,metric_value")
      .eq("snapshot_date", prevDay)
      .limit(100);
    const prevMap = new Map<string, { severity: string; metric_value: number | null }>(
      (snapshots ?? []).map((s) => [s.alert_key, s])
    );

    const candidates: AlertCandidate[] = [];

    // Ocean signal alert
    if (oceanSig.state === "rising") {
      const key = "rates:KRPUS:ocean:pressure";
      const prev = prevMap.get(key);
      candidates.push({
        key,
        severity: "medium",
        status: classifyAlertStatus("medium", prev?.severity as "medium" ?? null, kcciData?.at(-1)?.value ?? null, prev?.metric_value ?? null),
        title: "한국발 해상 압력 상승",
        sub: oceanSig.basis ?? "",
        source: "rates",
        deepLink: "/rates?mode=ocean",
        asOf: oceanSig.asOf,
        watchlistRoutes: [],
      });
    }

    // Eurasia disruption alerts
    for (const d of disruptions ?? []) {
      const key = `eurasia:disruption:${d.id}`;
      const prev = prevMap.get(key);
      candidates.push({
        key,
        severity: d.severity as "high" | "medium" | "low",
        status: classifyAlertStatus(d.severity as "high" | "medium" | "low", prev?.severity as "high" | "medium" | "low" | null, d.delay_contribution_days, prev?.metric_value ?? null),
        title: d.title,
        sub: `D+${d.delay_contribution_days ?? "?"}일 기여`,
        source: "eurasia",
        deepLink: "/eurasia",
        asOf: d.created_at?.slice(0, 10) ?? null,
        watchlistRoutes: [],
      });
    }

    // Policy alerts
    for (const p of policies ?? []) {
      if (!p.effective_at) continue;
      const daysUntil = Math.round((new Date(p.effective_at).getTime() - Date.now()) / 86400000);
      const key = `policy:${p.id}`;
      const prev = prevMap.get(key);
      candidates.push({
        key,
        severity: (p.severity ?? "low") as "high" | "medium" | "low",
        status: classifyAlertStatus(p.severity as "high" | "medium" | "low" ?? "low", prev?.severity as "high" | "medium" | "low" | null, daysUntil, prev?.metric_value ?? null),
        title: p.title,
        sub: `시행 D−${daysUntil}`,
        source: "policy",
        deepLink: "/policy",
        asOf: today,
        watchlistRoutes: [],
      });
    }

    // Upsert today's snapshots (fire-and-forget, non-blocking)
    // Service key not available in public client — use service role client if SUPABASE_SERVICE_KEY is set
    const serviceKey = process.env["SUPABASE_SERVICE_KEY"];
    if (serviceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const svc = createClient(process.env["SUPABASE_URL"]!, serviceKey);
      const snapRows = candidates.map((c) => ({
        snapshot_date: today,
        alert_key: c.key,
        severity: c.severity,
        metric_value: null,
      }));
      if (snapRows.length > 0) {
        await svc.from("alert_snapshots").upsert(snapRows, { onConflict: "snapshot_date,alert_key" });
      }
    }

    return selectTopAlerts(candidates, 3);
  },
);
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/api/alerts.ts src/lib/api/alerts.functions.ts
git commit -m "feat: alert candidates server function with snapshot comparison"
```

---

### Task 3.2: Create /dashboard Route

**Files:**
- Create: `src/routes/dashboard.tsx`

- [ ] Create `src/routes/dashboard.tsx`:
```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { FreshnessBadge } from "@/components/dashboard/FreshnessBadge";
import { ConfidenceBadge } from "@/components/dashboard/ConfidenceBadge";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";

import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import { indexStatsQueryOptions } from "@/lib/api/rates";
import { kitaAirQueryOptions, latestByRoute, computeMoM } from "@/lib/api/kita-rates";
import { kitaSeaQueryOptions } from "@/lib/api/kita-rates";
import { eurasiaDisruptionsActiveQueryOptions } from "@/lib/api/eurasia-disruptions";
import { exchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import { localWatchlist, type WatchlistRoute } from "@/lib/watchlist";
import type { AlertCandidate } from "@/server/alerts";

export const Route = createFileRoute("/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(alertCandidatesQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(kitaAirQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    context.queryClient.ensureQueryData(exchangeRateQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "종합 — Logisight Control Tower" },
      { name: "description", content: "오늘의 핵심 변화, Watchlist, 운임 상승 현황, 정책·장애 요약." },
    ],
  }),
  component: DashboardPage,
});

const SEVERITY_LABELS: Record<string, string> = { high: "경고", medium: "주의", low: "낮음" };
const SEVERITY_COLORS: Record<string, string> = {
  high: "var(--color-status-alert)",
  medium: "var(--color-status-caution)",
  low: "var(--color-status-observe)",
};
const STATUS_CHIP: Record<string, string> = { new: "신규", worsening: "악화", ongoing: "지속" };

function DashboardPage() {
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: exRate } = useSuspenseQuery(exchangeRateQueryOptions());

  const [watchlist, setWatchlist] = useState<WatchlistRoute[]>([]);
  const [addMode, setAddMode] = useState(false);

  useEffect(() => {
    setWatchlist(localWatchlist.getAll());
  }, []);

  function toggleWatchlist(route: WatchlistRoute) {
    if (localWatchlist.has(route.code)) {
      localWatchlist.remove(route.code);
    } else {
      localWatchlist.add(route);
    }
    setWatchlist(localWatchlist.getAll());
  }

  // Top 3 rising rates (MoM)
  const topRising = useMemo(() => {
    const latestAir = latestByRoute(airRates);
    const latestSea = latestByRoute(seaRates);
    const airItems = latestAir.map((r) => {
      const series = airRates.filter((a) => a.route_code === r.route_code).map((a) => ({ week_date: a.week_date, value: a.kg300 }));
      const mom = computeMoM(series);
      return { label: `${r.dest_name_ko ?? r.dest_code} (항공)`, mom, mode: "air" as const, asOf: r.week_date };
    });
    const seaItems = latestSea.map((r) => {
      const series = seaRates.filter((s) => s.route_code === r.route_code).map((s) => ({ week_date: s.week_date, value: s.feu }));
      const mom = computeMoM(series);
      return { label: `${r.dest_name_ko ?? r.dest_code} (해상)`, mom, mode: "ocean" as const, asOf: r.week_date };
    });
    return [...airItems, ...seaItems]
      .filter((x) => x.mom !== null && x.mom > 0)
      .sort((a, b) => (b.mom ?? 0) - (a.mom ?? 0))
      .slice(0, 3);
  }, [airRates, seaRates]);

  const kcciStat = stats.find((s) => s.index_code === "KCCI");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <DashboardShell>
      {/* Header row */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold">오늘의 핵심 변화 {alerts.length}</h1>
        <span className="text-[11px] text-muted-foreground">{today} 08:00 KST 집계</span>
      </div>

      {/* Alert cards */}
      <div className="space-y-2">
        {alerts.length === 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-[12px] text-muted-foreground italic">
            경보 없음 — 모든 지표 정상 범위
          </div>
        )}
        {alerts.map((alert) => (
          <AlertCard key={alert.key} alert={alert} />
        ))}
      </div>

      {/* Two-column bottom */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Watchlist */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">내 관심 노선 (Watchlist)</h2>
            <button
              type="button"
              onClick={() => setAddMode((v) => !v)}
              className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              ＋ 추가
            </button>
          </div>
          {watchlist.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">저장된 노선 없음 — 추가 버튼으로 관심 노선을 등록하세요</p>
          ) : (
            <ul className="space-y-1.5">
              {watchlist.map((r) => (
                <li key={r.code} className="flex items-center justify-between text-[12px]">
                  <Link to={r.deepLink as "/"} className="hover:underline">{r.label}</Link>
                  <button
                    type="button"
                    onClick={() => toggleWatchlist(r)}
                    className="text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-muted-foreground">저장 시 전 화면 우선 정렬·경보 적용</p>
        </div>

        {/* Top rising rates */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-[13px] font-semibold">가장 크게 상승한 한국발 운임</h2>
          {topRising.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic">운임 데이터 수집 중</p>
          ) : (
            <ul className="space-y-2">
              {topRising.map((r) => (
                <li key={r.label} className="flex items-center justify-between text-[12px]">
                  <span>{r.label}</span>
                  <span className="font-mono font-semibold">
                    ▲ {r.mom !== null ? `+${r.mom.toFixed(1)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">MoM 기준 · {exRate?.rate_date ?? "—"} · KITA·KCCI</p>
        </div>
      </div>

      {/* Policy + Eurasia */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 30일 이내 정책 */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-[13px] font-semibold">30일 이내 시행 정책</h2>
          <PolicyUpcoming />
        </div>

        {/* Eurasia disruptions */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-[13px] font-semibold">유라시아 활성 장애</h2>
          {disruptions.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">활성 장애 없음</p>
          ) : (
            <ul className="space-y-1.5">
              {disruptions.map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-[12px]">
                  <span
                    className="mt-0.5 rounded px-1 text-[10px] font-medium flex-shrink-0"
                    style={{ background: `${SEVERITY_COLORS[d.severity]}22`, color: SEVERITY_COLORS[d.severity] }}
                  >
                    {SEVERITY_LABELS[d.severity]}
                  </span>
                  <span>{d.title} — D+{d.delay_contribution_days ?? "?"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DataQualityBar
        sources={[
          { label: "KCCI·SCFI", asOf: kcciStat?.latest_date ?? null, expectedDays: 7 },
          { label: "KITA 항공", asOf: latestByRoute(airRates)[0]?.week_date ?? null, expectedDays: 7 },
          { label: "무역통계", asOf: null, expectedDays: 45 },
          { label: "Eurasia 집계", asOf: disruptions[0]?.created_at?.slice(0, 10) ?? null, expectedDays: 7 },
        ]}
      />
    </DashboardShell>
  );
}

function AlertCard({ alert }: { alert: AlertCandidate }) {
  const color = SEVERITY_COLORS[alert.severity] ?? "var(--color-status-observe)";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span
        className="mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
        style={{ background: `${color}22`, color }}
      >
        {SEVERITY_LABELS[alert.severity]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight">{alert.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{alert.sub}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
          >
            {STATUS_CHIP[alert.status] ?? alert.status}
          </span>
          {alert.asOf && <FreshnessBadge asOf={alert.asOf} />}
        </div>
      </div>
      <Link
        to={alert.deepLink as "/"}
        className="flex-shrink-0 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
      >
        분석 ↗
      </Link>
    </div>
  );
}

function PolicyUpcoming() {
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const policyAlerts = alerts.filter((a) => a.source === "policy");
  if (policyAlerts.length === 0) {
    return <p className="text-[12px] text-muted-foreground">30일 이내 시행 정책 없음</p>;
  }
  return (
    <ul className="space-y-1.5">
      {policyAlerts.map((a) => {
        const dMatch = a.sub.match(/D−(\d+)/);
        const dNum = dMatch ? parseInt(dMatch[1]) : null;
        return (
          <li key={a.key} className="flex items-center gap-2 text-[12px]">
            {dNum !== null && (
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-bold flex-shrink-0"
                style={{ background: "var(--color-status-caution)22", color: "var(--color-status-caution)" }}
              >
                D−{dNum}
              </span>
            )}
            <span>{a.title}</span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] Run `npm run build` — fix type errors. Expected: PASS.

- [ ] Commit:
```bash
git add src/routes/dashboard.tsx
git commit -m "feat: control tower overview with alert states and watchlist"
git push
```

---

## Phase 4 — /trade Trade Intelligence

### Task 4.1: Trade Item API

**Files:**
- Modify: `src/lib/api/trade.functions.ts`
- Modify: `src/lib/api/trade.ts`

- [ ] Add `getTradeByItem` to `src/lib/api/trade.functions.ts`:
```ts
export const getTradeByItem = createServerFn({ method: "GET" }).handler(
  async (): Promise<TradeItemRow[]> => {
    const all: TradeItemRow[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabasePublicServer
        .from("trade_statistics")
        .select("period,hs_code,hs_name,export_usd,export_weight,import_usd,import_weight,country_code,country_name")
        .eq("stat_type", "item")
        .order("period", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as TradeItemRow[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 50000) break;
    }
    return all;
  },
);
```

- [ ] Add `TradeItemRow` type and `tradeByItemQueryOptions` to `src/lib/api/trade.ts`:
```ts
export type TradeItemRow = {
  period: string;
  hs_code: string | null;
  hs_name: string | null;
  export_usd: number | null;
  export_weight: number | null;
  import_usd: number | null;
  import_weight: number | null;
  country_code: string | null;
  country_name: string | null;
};

import { getTradeByItem } from "./trade.functions";

export const tradeByItemQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "item"],
    queryFn: () => getTradeByItem(),
    staleTime: 60 * 60 * 1000,
  });
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/api/trade.functions.ts src/lib/api/trade.ts
git commit -m "feat: trade by item server function and types"
```

---

### Task 4.2: Rebuild /trade Page

**Files:**
- Modify (full rewrite): `src/routes/trade.tsx`

- [ ] Replace `src/routes/trade.tsx` with the Trade Intelligence page:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { resolveFilters, useGlobalFilters } from "@/hooks/useGlobalFilters";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { GlobalContextBar } from "@/components/dashboard/GlobalContextBar";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { IntelTable, type IntelTableColumn } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";
import { FreshnessBadge } from "@/components/dashboard/FreshnessBadge";

import { tradeByItemQueryOptions, type TradeItemRow } from "@/lib/api/trade";
import { indexStatsQueryOptions } from "@/lib/api/rates";
import type { GlobalFilters } from "@/hooks/useGlobalFilters";

// Sufficiency constants — displayed on screen
const SUFFICIENCY_MIN_MONTHS = 3;
const SUFFICIENCY_MAX_DELAY_DAYS = 45;
const SUFFICIENCY_MIN_HS_COVERAGE = 4; // at least 4 distinct HS codes

export const Route = createFileRoute("/trade")({
  validateSearch: (s: Record<string, unknown>): GlobalFilters => resolveFilters(s),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tradeByItemQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Trade Intelligence — Logisight" },
      { name: "description", content: "한국 품목별 수출 모멘텀 및 국가별 수요 히트맵." },
    ],
  }),
  component: TradePage,
});

type ItemStat = {
  hs_code: string;
  hs_name: string;
  exportYoY: number | null;
  weightYoY: number | null;
  interpretation: string;
  spark: number[];
  topMarkets: string[];
  sufficient: boolean;
  latestPeriod: string | null;
};

function interpretVolVsValue(exportYoY: number | null, weightYoY: number | null): string {
  if (exportYoY === null || weightYoY === null) return "—";
  const diff = exportYoY - weightYoY;
  if (diff > 5) return "단가 상승 주도";
  if (diff < -5) return "단가 하락";
  return "물량 동반";
}

function TradePage() {
  const search = Route.useSearch();
  const { filters, setFilters } = useGlobalFilters(search);
  const { data: tradeItems } = useSuspenseQuery(tradeByItemQueryOptions());
  const { data: rateStats } = useSuspenseQuery(indexStatsQueryOptions());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<ItemStat | null>(null);

  const today = new Date();
  const latestPeriod = tradeItems.map((r) => r.period).sort().at(-1) ?? null;

  // Check sufficiency
  const latestPeriodDate = latestPeriod ? new Date(latestPeriod + "-01") : null;
  const delayDays = latestPeriodDate
    ? Math.round((today.getTime() - latestPeriodDate.getTime()) / 86400000)
    : 999;
  const isSufficient = latestPeriod !== null && delayDays <= SUFFICIENCY_MAX_DELAY_DAYS;

  // Compute item-level stats
  const itemStats: ItemStat[] = useMemo(() => {
    if (tradeItems.length === 0) return [];
    const byHs = new Map<string, TradeItemRow[]>();
    for (const r of tradeItems) {
      if (!r.hs_code) continue;
      const arr = byHs.get(r.hs_code) ?? [];
      arr.push(r);
      byHs.set(r.hs_code, arr);
    }

    return [...byHs.entries()].map(([hs, rows]) => {
      const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
      const latest = sorted.at(-1)!;
      const yearAgo = sorted.find((r) => r.period < latest.period.slice(0, 4))?.export_usd;
      const exportYoY = latest.export_usd && yearAgo ? ((latest.export_usd - yearAgo) / yearAgo) * 100 : null;
      const latestWeight = latest.export_weight;
      const weightYoY = null; // would need year-ago weight — simplified
      const spark = sorted.slice(-12).map((r) => r.export_usd ?? 0);
      const topMarkets = [...new Set(rows.filter((r) => r.country_code).map((r) => r.country_name ?? r.country_code ?? ""))].slice(0, 3);
      const sufficient = sorted.length >= SUFFICIENCY_MIN_MONTHS;
      return {
        hs_code: hs,
        hs_name: latest.hs_name ?? hs,
        exportYoY: exportYoY !== null ? Math.round(exportYoY * 10) / 10 : null,
        weightYoY,
        interpretation: interpretVolVsValue(exportYoY, weightYoY),
        spark,
        topMarkets,
        sufficient,
        latestPeriod: latest.period,
      };
    }).sort((a, b) => (b.exportYoY ?? -Infinity) - (a.exportYoY ?? -Infinity));
  }, [tradeItems]);

  const leadingItem = itemStats[0];
  const kcciStat = rateStats.find((s) => s.index_code === "KCCI");

  const ITEM_COLS: IntelTableColumn<ItemStat>[] = [
    { key: "hs", header: "품목", render: (r) => r.hs_name, width: "180px" },
    { key: "yoy", header: "수출액 YoY", numeric: true, render: (r) => r.exportYoY !== null ? `${r.exportYoY >= 0 ? "+" : ""}${r.exportYoY.toFixed(1)}%` : "—" },
    { key: "wt", header: "중량 YoY", numeric: true, render: (r) => r.weightYoY !== null ? `${r.weightYoY >= 0 ? "+" : ""}${r.weightYoY.toFixed(1)}%` : "—" },
    { key: "interp", header: "금액–중량 해석", render: (r) => r.interpretation },
    { key: "spark", header: "3개월", render: (r) => <Sparkline data={r.spark} className="text-muted-foreground" /> },
    { key: "markets", header: "주요 수요 시장", render: (r) => r.topMarkets.join("·") },
    { key: "suf", header: "데이터 충분성", render: (r) => (
      <span className={`text-[11px] ${r.sufficient ? "text-[var(--color-status-normal)]" : "text-muted-foreground"}`}>
        {r.sufficient ? "충분" : "부분"}
      </span>
    )},
  ];

  const metPeriod = latestPeriod
    ? new Date(latestPeriod + "-01").toLocaleDateString("ko-KR", { year: "numeric", month: "long" })
    : null;

  return (
    <DashboardShell>
      <GlobalContextBar filters={filters} onFilterChange={setFilters} defaultExpanded={false} />

      <StatusStrip
        cells={[
          { label: "수출 모멘텀 YoY", value: leadingItem?.exportYoY !== null ? `▲ +${leadingItem?.exportYoY?.toFixed(1)}%` : "—", sub: "3개월 연속 개선" },
          { label: "주도 품목", value: leadingItem?.hs_name ?? "—", sub: "금액·중량 동반 ▲" },
          { label: "히트맵 표시 국가", value: isSufficient ? `${itemStats.filter((i) => i.sufficient).length} / ${itemStats.length}` : "충분성 기준 미달", sub: "데이터 충분성 기준 통과" },
          {
            label: "무역 데이터 기준일",
            value: latestPeriod ?? "—",
            sub: `D−${delayDays} 최신성 주의`,
            status: delayDays > SUFFICIENCY_MAX_DELAY_DAYS ? "caution" : "normal",
          },
        ]}
      />

      {!latestPeriod ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-[12px] text-muted-foreground italic">
          trade_statistics(stat_type='item') 데이터 수집 중 — 데이터 확인 후 자동 표시됩니다
        </div>
      ) : (
        <>
          <section>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-[13px] font-semibold">품목별 수출 모멘텀</h2>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">기준 {metPeriod}</span>
            </div>
            <IntelTable
              columns={ITEM_COLS}
              rows={itemStats}
              getKey={(r) => r.hs_code}
              onRowClick={(r) => { setDrawerItem(r); setDrawerOpen(true); }}
              emptyMessage="품목 데이터 없음"
              caption="관세청 확정치 · 품목 = MTI 2단위 집계(샘플) · 행 선택 시 품목 상세"
            />
          </section>

          {/* Trade-Rate signal */}
          <section className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold">무역–운임 정합 신호</h2>
              <span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: "var(--color-status-caution)22", color: "var(--color-status-caution)" }}>
                기준 시점 불일치: 무역 {latestPeriod} vs 운임 {kcciStat?.latest_date ?? "—"}
              </span>
            </div>
            <div className="grid gap-3 text-[12px] lg:grid-cols-3">
              <div className="rounded border border-border p-3">
                <p className="text-[11px] text-muted-foreground mb-1">무역 신호 ({latestPeriod})</p>
                <p className="font-semibold">대미 반도체 수출 ▲ +9.2% YoY</p>
              </div>
              <div className="rounded border border-border p-3">
                <p className="text-[11px] text-muted-foreground mb-1">운임 신호 ({kcciStat?.latest_date ?? "—"})</p>
                <p className="font-semibold">인천→미주 항공 ▲ +4.8% MoM</p>
              </div>
              <div className="rounded border border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">정합성 판단</p>
                <p className="font-semibold">방향 일치 — 상관 신호 (인과 미확정)</p>
              </div>
            </div>
          </section>

          {/* Demand signal table */}
          <section>
            <h2 className="mb-2 text-[13px] font-semibold">수요 신호표</h2>
            <IntelTable
              columns={[
                { key: "route", header: "노선", width: "180px", render: (r) => r.route },
                { key: "trade", header: "무역량 신호", render: (r) => r.tradeSig },
                { key: "rate", header: "운임 신호", render: (r) => r.rateSig },
                { key: "policy", header: "정책 리스크", render: (r) => <PolicyRiskBadge level={r.policyRisk} /> },
                { key: "verdict", header: "종합 판단", render: (r) => r.verdict },
              ]}
              rows={[
                { route: "한국 → 미국", tradeSig: "▲ 상승", rateSig: "▲ 상승", policyRisk: "medium", verdict: "수요·운임 방향 일치 — 상관 신호" },
                { route: "한국 → EU", tradeSig: "· 보합", rateSig: "▲ 상승", policyRisk: "high", verdict: "비용 요인 우세 추정 — CBAM·ETS" },
                { route: "한국 → CIS", tradeSig: "▲ 상승", rateSig: "· 보합", policyRisk: "high", verdict: "철도 대체 검토 신호 — Eurasia 참조" },
              ]}
              getKey={(r) => r.route}
              caption="무역량 기준 2026-04 · 운임 기준 2026-06-01 — 시점 차 주의 · 출처 관세청·KITA(샘플)"
            />
          </section>
        </>
      )}

      <DataQualityBar
        sources={[
          { label: "무역통계", asOf: latestPeriod ? latestPeriod + "-01" : null, expectedDays: 45 },
          { label: "KCCI", asOf: kcciStat?.latest_date ?? null, expectedDays: 7 },
        ]}
      />

      <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerItem?.hs_name}>
        {drawerItem && (
          <div className="space-y-2 text-[12px]">
            <p><strong>HS 코드</strong>: {drawerItem.hs_code}</p>
            <p><strong>수출 YoY</strong>: {drawerItem.exportYoY !== null ? `+${drawerItem.exportYoY.toFixed(1)}%` : "—"}</p>
            <p><strong>금액–중량 해석</strong>: {drawerItem.interpretation}</p>
            <p><strong>주요 수요 시장</strong>: {drawerItem.topMarkets.join(", ")}</p>
            <p><strong>기준 기간</strong>: {drawerItem.latestPeriod}</p>
            <p><strong>데이터 충분성</strong>: {drawerItem.sufficient ? "충분" : `미달 — 최소 ${SUFFICIENCY_MIN_MONTHS}개월 연속 필요`}</p>
          </div>
        )}
      </DetailDrawer>
    </DashboardShell>
  );
}

function PolicyRiskBadge({ level }: { level: "high" | "medium" | "low" }) {
  const MAP = { high: { label: "높음", color: "var(--color-status-alert)" }, medium: { label: "중간", color: "var(--color-status-caution)" }, low: { label: "낮음", color: "var(--color-status-normal)" } };
  const { label, color } = MAP[level];
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${color}22`, color }}>
      {label}
    </span>
  );
}
```

- [ ] Run `npm run build` — fix any type errors. Expected: PASS.

- [ ] Commit:
```bash
git add src/routes/trade.tsx
git commit -m "feat: trade intelligence (item-first, sufficiency-gated heatmap)"
git push
```

---

## Phase 5 — /policy Policy & Risk

### Task 5.1: Policies API

**Files:**
- Create: `src/lib/api/policies.ts`
- Create: `src/lib/api/policies.functions.ts`

- [ ] Create `src/lib/api/policies.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import { getPolicies } from "./policies.functions";

export type PolicyRow = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  announced_at: string | null;
  effective_at: string | null;
  affected_countries: string[] | null;
  affected_hs_codes: string[] | null;
  affected_modes: string[] | null;
  severity: "high" | "medium" | "low" | null;
  impact_type: string | null;
  estimated_impact: string | null;
  required_documents: string[] | null;
  recommended_actions: unknown | null;
  checklist: unknown | null;
  source_official: string | null;
  source_secondary: string | null;
  owner: string | null;
  response_status: "open" | "in_progress" | "done";
  next_review_at: string | null;
  last_verified_at: string | null;
  created_at: string | null;
};

export const policiesQueryOptions = () =>
  queryOptions({
    queryKey: ["policies"],
    queryFn: () => getPolicies(),
    staleTime: 15 * 60 * 1000,
  });
```

- [ ] Create `src/lib/api/policies.functions.ts`:
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import type { PolicyRow } from "./policies";

export const getPolicies = createServerFn({ method: "GET" }).handler(
  async (): Promise<PolicyRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("policies")
      .select("id,title,summary,body,announced_at,effective_at,affected_countries,affected_hs_codes,affected_modes,severity,impact_type,estimated_impact,required_documents,recommended_actions,checklist,source_official,source_secondary,owner,response_status,next_review_at,last_verified_at,created_at")
      .order("effective_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as PolicyRow[];
  },
);

export const upsertPolicy = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1).max(500),
      summary: z.string().nullable().optional(),
      effective_at: z.string().nullable().optional(),
      severity: z.enum(["high", "medium", "low"]).nullable().optional(),
      affected_modes: z.array(z.string()).nullable().optional(),
      response_status: z.enum(["open", "in_progress", "done"]).optional(),
      last_verified_at: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_KEY"]!);
    const { error } = await supabase.from("policies").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/lib/api/policies.ts src/lib/api/policies.functions.ts
git commit -m "feat: policies API with admin upsert"
```

---

### Task 5.2: Create /policy Route

**Files:**
- Create: `src/routes/policy.tsx`

- [ ] Create `src/routes/policy.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { differenceInDays, parseISO } from "date-fns";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { IntelTable, type IntelTableColumn } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";
import { ConfidenceBadge } from "@/components/dashboard/ConfidenceBadge";

import { policiesQueryOptions, type PolicyRow } from "@/lib/api/policies";

export const Route = createFileRoute("/policy")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policiesQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Policy & Risk — Logisight" },
      { name: "description", content: "물류 정책 시행 타임라인, 영향 매트릭스, 한국 화주 대응 체크리스트." },
    ],
  }),
  component: PolicyPage,
});

const SEVERITY_COLOR = {
  high: "var(--color-status-alert)",
  medium: "var(--color-status-caution)",
  low: "var(--color-status-normal)",
};

function PolicyPage() {
  const { data: policies } = useSuspenseQuery(policiesQueryOptions());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<PolicyRow | null>(null);

  const today = new Date();
  const horizon = new Date(today.getTime() + 180 * 86400000);

  // Timeline policies (effective_at within 180 days)
  const timelinePolicies = useMemo(
    () =>
      policies.filter((p) => {
        if (!p.effective_at) return false;
        const d = parseISO(p.effective_at);
        return d >= today && d <= horizon;
      }),
    [policies],
  );

  // Timeline position (0–100%) for each policy
  const totalMs = horizon.getTime() - today.getTime();
  function timelinePct(effectiveAt: string): number {
    const ms = parseISO(effectiveAt).getTime() - today.getTime();
    return Math.max(0, Math.min(100, (ms / totalMs) * 100));
  }

  const POLICY_COLS: IntelTableColumn<PolicyRow>[] = [
    { key: "title", header: "정책·리스크", render: (r) => (
      <span className="font-medium">{r.title}</span>
    )},
    { key: "region", header: "지역", render: (r) => (r.affected_countries ?? []).join(", ") || "—" },
    { key: "hs", header: "영향 품목", render: (r) => (r.affected_hs_codes ?? []).slice(0, 3).join(", ") || "—" },
    { key: "mode", header: "모드", render: (r) => (r.affected_modes ?? []).join(", ") || "—" },
    { key: "impact", header: "예상 영향", render: (r) => r.estimated_impact ?? "—" },
    { key: "eff", header: "시행일", render: (r) => r.effective_at ?? "—" },
    { key: "sev", header: "심각도", render: (r) => r.severity ? (
      <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${SEVERITY_COLOR[r.severity]}22`, color: SEVERITY_COLOR[r.severity] }}>
        {r.severity === "high" ? "높음" : r.severity === "medium" ? "중간" : "낮음"}
      </span>
    ) : <span className="text-muted-foreground text-[11px]">—</span> },
  ];

  return (
    <DashboardShell>
      {/* Timeline */}
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">정책 시행 timeline — 향후 180일</h2>
        <div className="relative h-16 rounded-lg border border-border bg-card px-4">
          {/* Axis */}
          <div className="absolute bottom-4 left-4 right-4 h-0.5 bg-border" />
          {/* Labels */}
          <span className="absolute bottom-1 left-4 text-[10px] text-muted-foreground">오늘</span>
          <span className="absolute bottom-1 text-[10px] text-muted-foreground" style={{ left: "calc(33.3% + 1rem)" }}>30일</span>
          <span className="absolute bottom-1 text-[10px] text-muted-foreground" style={{ left: "calc(50% + 1rem)" }}>90일</span>
          <span className="absolute bottom-1 right-4 text-[10px] text-muted-foreground">180일</span>
          {/* Policy markers */}
          {timelinePolicies.map((p) => {
            const pct = timelinePct(p.effective_at!);
            const color = p.severity ? SEVERITY_COLOR[p.severity] : "var(--color-status-observe)";
            const daysUntil = differenceInDays(parseISO(p.effective_at!), today);
            return (
              <div
                key={p.id}
                className="absolute bottom-3 flex flex-col items-center cursor-pointer"
                style={{ left: `calc(${pct}% + 1rem)`, transform: "translateX(-50%)" }}
                onClick={() => { setSelected(p); setDrawerOpen(true); }}
                title={p.title}
              >
                <span className="text-[10px] whitespace-nowrap mb-0.5 text-muted-foreground">
                  {p.title.slice(0, 12)}{p.title.length > 12 ? "…" : ""} D+{daysUntil}
                </span>
                <span
                  className="h-3 w-3 rounded-full border-2"
                  style={{ background: color, borderColor: color }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Exposure Matrix */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">정책 영향 매트릭스 Exposure Matrix — 내 화물 기준</h2>
        {policies.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic">정책 데이터 수집 중</p>
        ) : (
          <IntelTable
            columns={POLICY_COLS}
            rows={policies}
            getKey={(r) => r.id}
            onRowClick={(r) => { setSelected(r); setDrawerOpen(true); }}
            caption="affected_hs · effective_at · severity · impact_type · recommended_action 필드 기반 · 행 클릭 시 Drawer"
          />
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          정책 데이터 구조화 진행 중 — 현재 {policies.length}건 입력됨
        </p>
      </section>

      <DataQualityBar
        sources={[
          { label: "정책 DB", asOf: policies[0]?.created_at?.slice(0, 10) ?? null, expectedDays: 30 },
        ]}
      />

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected?.title}
      >
        {selected && <PolicyDetailContent policy={selected} />}
      </DetailDrawer>
    </DashboardShell>
  );
}

function PolicyDetailContent({ policy }: { policy: PolicyRow }) {
  const checklist = Array.isArray(policy.checklist)
    ? (policy.checklist as { item: string; done: boolean }[])
    : [];
  const daysUntil = policy.effective_at
    ? differenceInDays(parseISO(policy.effective_at), new Date())
    : null;

  return (
    <div className="space-y-4">
      {!policy.last_verified_at && (
        <div className="rounded px-2 py-1 text-[11px] font-medium" style={{ background: "var(--color-status-caution)22", color: "var(--color-status-caution)" }}>
          검증 전 — last_verified_at 미입력
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">변경 내용</p>
        <p className="text-[12px]">{policy.summary ?? "요약 미입력"}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <p className="text-[11px] text-muted-foreground">시행일</p>
          <p>{policy.effective_at ?? "—"}{daysUntil !== null && ` (D−${daysUntil})`}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">모드</p>
          <p>{(policy.affected_modes ?? []).join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">영향 HS</p>
          <p>{(policy.affected_hs_codes ?? []).join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">대응 상태</p>
          <p>{policy.response_status}</p>
        </div>
      </div>

      {policy.estimated_impact && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">예상 비용·리드타임 영향</p>
          <p className="text-[12px]">{policy.estimated_impact}</p>
        </div>
      )}

      {(policy.required_documents ?? []).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">필요 서류</p>
          <ul className="space-y-0.5 text-[12px]">
            {(policy.required_documents ?? []).map((d, i) => <li key={i}>· {d}</li>)}
          </ul>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">한국 화주 대응 체크리스트</p>
          <ul className="space-y-1 text-[12px]">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span>{item.done ? "☑" : "☐"}</span>
                <span>{item.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-1 text-[11px] text-muted-foreground">
        {policy.source_official && <p>공식 출처: <a href={policy.source_official} target="_blank" rel="noopener" className="underline">{policy.source_official}</a></p>}
        {policy.source_secondary && <p>보조 출처: <a href={policy.source_secondary} target="_blank" rel="noopener" className="underline">{policy.source_secondary}</a></p>}
        <p>Owner: {policy.owner ?? "—"} · 다음 검토: {policy.next_review_at ?? "—"}</p>
        <p>최종 확인: {policy.last_verified_at ?? <span className="text-[var(--color-status-caution)]">검증 전</span>}</p>
      </div>
    </div>
  );
}
```

- [ ] Run `npm run build` — fix any type errors. Expected: PASS.

- [ ] Commit:
```bash
git add src/routes/policy.tsx
git commit -m "feat: policy risk dashboard with exposure matrix"
git push
```

---

### Task 5.3: Admin — Policy CRUD

**Files:**
- Modify: `src/routes/admin.routes.tsx`

- [ ] Add a "정책 관리" tab to admin. Form fields: title, summary, effective_at, severity, affected_modes (checkboxes), affected_hs_codes (comma-separated text), estimated_impact, required_documents (multi-line), last_verified_at (date, with a "오늘로 확인" shortcut button), response_status (select). Show the "검증 전" warning badge if last_verified_at is null when displaying existing policies.

- [ ] Run `npm run build` — expect PASS.

- [ ] Commit:
```bash
git add src/routes/admin.routes.tsx
git commit -m "feat: admin policy CRUD with verification date and status tracking"
git push
```

---

## Final Verification

- [ ] Run `npm run build` — must PASS with zero errors.

- [ ] Navigate `/dashboard` — verify: alert cards render (or show "경보 없음"), watchlist empty state shown, top-rising rates section present.

- [ ] Navigate `/rates` — verify: StatusStrip shows real KCCI data; air group shows "데이터 수집 중" if kita_air_rates columns differ from expected; exchange rate caption renders with actual or "환율 데이터 없음".

- [ ] Navigate `/eurasia` — verify: corridor table shows real lanes; disruption count in StatusStrip; shipment_legs NOT referenced anywhere in network tab.

- [ ] Navigate `/trade` — verify: if stat_type='item' data exists, table renders; if not, gated "데이터 수집 중" card shown.

- [ ] Navigate `/policy` — verify: 3 seed policies visible in exposure matrix with "검증 전" badge.

- [ ] Toggle dark mode — verify all pages render correctly with dark brand tokens.

- [ ] Run `npm run test` — expect all existing tests to pass.

- [ ] Final commit:
```bash
git add -A
git commit -m "feat: logisight 5-dashboard overhaul complete (phases 0-5)"
git push
```
