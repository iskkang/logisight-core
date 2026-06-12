# Data Contract — `delay_index_weekly_v2` (segment-level delay aggregate)

**Status:** Proposal · **Owner (producer):** `iskkang/logisight` pipeline · **Consumer:** `logisight-core` `/eurasia` 지연 혼잡 지도
**Date:** 2026-06-13

## 0. Why

`/eurasia` currently shows **cumulative observed delay** from `delay_index_weekly.median_delay_d` (= `actual_at − planned_at` at each milestone). That tells us *where lateness is observed*, **not where the delay was caused** — a milestone can show +30d simply because every prior segment was late.

To switch the map from a **"누적 지연 관측 지도"** to a true **"구간별 지연 발생 지도"**, the pipeline must expose **incremental (segment-attributed) delay** plus baseline/actual so the UI can honestly show `기준 / 실제 / 지연율`.

**Hard rules (unchanged):**
- Compute in the **pipeline**, not the frontend. No UI-side inference.
- **Never expose raw `shipment_legs`** publicly. v2 is an **aggregate-safe** view/table only (same exposure model as v1).
- Until v2 ships, the frontend keeps the cumulative map + disclaimer and does **not** display baseline/actual/delay-rate.

## 1. v2 schema (aggregate-safe, public-readable)

One row per `(lane_id, milestone, week_iso)` — same grain as v1, with new segment fields.

```sql
-- delay_index_weekly_v2 (TABLE materialized by pipeline, or MATERIALIZED VIEW refreshed weekly)
lane_id                         text      not null references lanes(id)
milestone                       milestone_code not null
week_iso                        text      not null            -- ISO week, e.g. 2026-W24
sample_count                    int       not null            -- shipments with BOTH this & previous milestone actuals

-- existing v1 metrics (carry over)
on_time_rate                    numeric                       -- 0..1
otp_pct                         numeric                       -- 0..100
p90_delay_d                     numeric                       -- cumulative p90 (kept for continuity)

-- NEW segment-level fields (the point of v2)
baseline_segment_days_median    numeric                       -- median planned duration of THIS segment
actual_segment_days_median      numeric                       -- median actual duration of THIS segment
incremental_delay_days_median   numeric                       -- median segment-attributed delay  ← KEY
cumulative_delay_days_median    numeric                       -- = v1 median_delay_d (renamed; observed lateness)
delay_rate_pct                  numeric                       -- median of per-shipment segment delay ratios (%)

-- provenance / quality
destination                     text
route_pattern                   text
data_quality                    data_quality_level not null   -- confirmed | provisional | indicative
methodology_version             text      not null            -- e.g. 'seg-v2.0'
updated_at                      timestamptz not null default now()

primary key (lane_id, milestone, week_iso)
```

Grants (mirror v1 — read-only public, write service_role):
```sql
grant select on public.delay_index_weekly_v2 to anon, authenticated;
grant all    on public.delay_index_weekly_v2 to service_role;
-- raw shipment_legs stays RESTRICTIVE (no anon/authenticated) — DO NOT relax.
```

> Keep v1 `delay_index_weekly` intact during transition. Frontend migrates to v2 only after it is populated.

## 2. The eight required definitions

### 2.1 Milestone ordering per lane
A lane only contains a **subset** of `milestone_code`, and the order is route-dependent (FESCO sea: `ORIGIN_DEP → SEA_TS_ARR → DEST_ARR`; CN land-bridge: `ORIGIN_DEP → RAIL_DEP_CN → XIAN_HUB → KASHI_ARR → KASHI_BONDED → CN_BORDER → KG_UZ_BORDER → DEST_ARR`).

**Do not hard-order globally as the source of truth.** Order each **shipment's** legs by `planned_at ASC` (the scheduled timeline), with a canonical milestone ordinal only as a **tiebreaker** for equal/NULL `planned_at`:

```
milestone_ord: ORIGIN_DEP=10, SEA_TS_ARR=20, RAIL_DEP_CN=30, XIAN_HUB=40,
               TRUCK_DEP=45, KASHI_ARR=50, KASHI_BONDED=55, CN_BORDER=60,
               KG_UZ_BORDER=70, DEST_ARR=100
```
This makes "previous milestone" correct even when lanes skip milestones.

### 2.2 Previous milestone identification
Per **shipment** (`shipment_ref`), the previous milestone is the immediately preceding leg in that shipment's ordered sequence:
```sql
lag(planned_at) over (partition by shipment_ref order by planned_at asc, milestone_ord asc)
lag(actual_at)  over (partition by shipment_ref order by planned_at asc, milestone_ord asc)
```
`ORIGIN_DEP` (sequence start) has **no previous** → it has no segment; treat its incremental delay as 0 and exclude it from segment-delay stats (it still reports cumulative=0 baseline).

### 2.3 Planned segment time
Per shipment, per segment ending at the current milestone:
```
planned_segment_days = (planned_at[current] − planned_at[previous]) / 1 day
```

### 2.4 Actual segment time
```
actual_segment_days = (actual_at[current] − actual_at[previous]) / 1 day
```

### 2.5 Incremental (segment-attributed) delay — the key field
Per shipment:
```
incremental_delay_days = max(0, actual_segment_days − planned_segment_days)
```
This isolates the delay **caused within this segment**, independent of inherited lateness. Aggregate = median over shipments at `(lane, milestone, week)`.

(Identity check: `incremental ≈ cumulative[current] − cumulative[previous]`, clamped at 0. Compute from segment durations to avoid sign/clamp drift.)

`cumulative_delay_days_median` = `median(max(0, actual_at[current] − planned_at[current]))` = the existing v1 metric, retained so the UI can show both.

### 2.6 Missing-timestamp handling
A shipment contributes to a segment's aggregate **only if all four timestamps exist**: `planned_at` & `actual_at` for **both** current and previous milestone.
- Missing **current** `actual_at` (not yet arrived) → exclude from that segment (do **not** treat NULL as 0).
- Missing **previous** `actual_at` (gap in tracking) → exclude (cannot attribute segment).
- Missing `planned_at` → exclude from baseline/rate (no schedule to compare).
- A shipment may be included for some segments and excluded for others. `sample_count` reflects only included shipments **per segment**.

### 2.7 Minimum sample count
Suppress/flag low-confidence aggregates rather than publishing noisy medians:
```
sample_count ≥ 5  → publish, data_quality = 'confirmed' (or carry source quality)
3 ≤ sample_count < 5 → publish, data_quality = 'provisional'
sample_count < 3  → DO NOT publish the row (or publish with 'indicative' and NULL medians)
```
Threshold (`5`) should be a pipeline constant, easy to tune. The frontend already de-emphasizes non-`confirmed` quality.

### 2.8 Delay-rate method (recommended)
Use **per-shipment ratios, then median** (robust to outliers; avoids ratio-of-medians bias):
```
per shipment:  rate_i = incremental_delay_days_i / planned_segment_days_i   (only if planned_segment_days_i > 0)
delay_rate_pct = median(rate_i) × 100
```
Document the alternative (ratio of medians: `incremental_median / baseline_median`) but **do not** use it as primary. Guard `planned_segment_days = 0` (same-day milestones) by excluding from the rate (not div-by-zero).

## 3. Reference SQL (pipeline, over `shipment_legs`)

```sql
create materialized view public.delay_index_weekly_v2 as
with ord as (
  select
    sl.lane_id, sl.milestone, sl.week_iso, sl.shipment_ref,
    sl.planned_at, sl.actual_at, sl.destination, sl.route_pattern, sl.data_source,
    lag(sl.planned_at) over w as prev_planned_at,
    lag(sl.actual_at)  over w as prev_actual_at
  from public.shipment_legs sl
  window w as (
    partition by sl.shipment_ref
    order by sl.planned_at asc nulls last, milestone_ord(sl.milestone) asc
  )
),
seg as (
  select
    lane_id, milestone, week_iso, destination, route_pattern,
    extract(epoch from (planned_at - prev_planned_at)) / 86400.0 as planned_seg_d,
    extract(epoch from (actual_at  - prev_actual_at )) / 86400.0 as actual_seg_d,
    greatest(0, extract(epoch from (actual_at - planned_at)) / 86400.0) as cumulative_d
  from ord
  where planned_at is not null and actual_at is not null
    and prev_planned_at is not null and prev_actual_at is not null   -- §2.6
)
select
  lane_id,
  milestone,
  week_iso,
  count(*)                                                           as sample_count,
  percentile_cont(0.5) within group (order by planned_seg_d)         as baseline_segment_days_median,
  percentile_cont(0.5) within group (order by actual_seg_d)          as actual_segment_days_median,
  percentile_cont(0.5) within group (order by greatest(0, actual_seg_d - planned_seg_d))
                                                                      as incremental_delay_days_median,  -- §2.5 KEY
  percentile_cont(0.5) within group (order by cumulative_d)          as cumulative_delay_days_median,    -- = v1
  percentile_cont(0.5) within group (
    order by (greatest(0, actual_seg_d - planned_seg_d) / nullif(planned_seg_d, 0)) * 100
  )                                                                   as delay_rate_pct,                  -- §2.8
  max(destination)                                                   as destination,
  max(route_pattern)                                                 as route_pattern,
  case when count(*) >= 5 then 'confirmed'
       when count(*) >= 3 then 'provisional'
       else 'indicative' end::data_quality_level                     as data_quality,
  'seg-v2.0'                                                          as methodology_version,
  now()                                                              as updated_at
from seg
group by lane_id, milestone, week_iso
having count(*) >= 3;   -- §2.7 (rows <3 excluded; tune as needed)

-- milestone_ord helper
create or replace function milestone_ord(m milestone_code) returns int language sql immutable as $$
  select case m
    when 'ORIGIN_DEP' then 10 when 'SEA_TS_ARR' then 20 when 'RAIL_DEP_CN' then 30
    when 'XIAN_HUB' then 40 when 'TRUCK_DEP' then 45 when 'KASHI_ARR' then 50
    when 'KASHI_BONDED' then 55 when 'CN_BORDER' then 60 when 'KG_UZ_BORDER' then 70
    when 'DEST_ARR' then 100 else 999 end
$$;
```
Refresh weekly (cron) after `shipment_legs` ingest: `refresh materialized view concurrently public.delay_index_weekly_v2;` (needs a unique index on the PK).

`p90_delay_d` / `on_time_rate` / `otp_pct` carry over from existing v1 logic — append to the select as you already compute them.

## 4. Frontend migration path (after v2 is populated — not now)

When v2 exists, `logisight-core` switches the map from cumulative-observation to **segment-occurrence**:
1. `getEurasiaDelays` → query `delay_index_weekly_v2` (add new columns).
2. In `lib/delay-segments.ts`, use **`incremental_delay_days_median`** as the primary `delay_days` (where delay *occurred*), and surface `cumulative_delay_days_median` secondarily.
3. Popup gains the now-real fields: `기준: {baseline_segment_days_median}일 / 실제: {actual_segment_days_median}일 / 지연율: {delay_rate_pct}%`.
4. Change the map caption/disclaimer from *"milestone 관측 누적 지연"* → *"구간 발생 지연(증분)"*; drop the "원인은 이전 구간일 수 있음" caveat for incremental values.
5. Manual `eurasia_disruptions` stays a tagged overlay; raw `shipment_legs` stays hidden.

No frontend change happens until v2 returns these fields — guard with presence checks so the UI never shows fake baseline/actual/rate.

## 5. Priority 2 — configurable severity thresholds

Replace the temporary hardcoded absolute-day rule (`≥1/3/7일` in `lib/congestion.ts`) with a config table, supporting **per-segment-type** and **delay-rate-based** rules:

```sql
create table public.delay_severity_thresholds (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null default 'default',     -- 'default' | 'segment_type' | 'lane'
  segment_type    text,                                 -- port|border|hub|destination|corridor (when scope='segment_type')
  lane_id         text references lanes(id),            -- when scope='lane'
  -- absolute-day thresholds (on incremental_delay_days_median)
  warning_days    numeric not null default 1,
  moderate_days   numeric not null default 3,
  severe_days     numeric not null default 7,
  -- optional delay-rate thresholds (on delay_rate_pct); when set, take the WORSE of day/rate
  warning_rate_pct  numeric,
  moderate_rate_pct numeric,
  severe_rate_pct   numeric,
  valid_from      date,
  valid_to        date,
  updated_at      timestamptz not null default now()
);
grant select on public.delay_severity_thresholds to anon, authenticated;
```
Resolution order at read time: `lane` → `segment_type` → `default` (first match wins). Severity = worst of the day-based and rate-based classification. Frontend reads the config (cached) and applies it instead of the hardcoded constants; until the table exists, keep documenting the absolute-day rule as temporary (already shown in the UI).

## 6. Open decisions (need owner/pipeline call)
1. **Segment vs leg model:** confirm `shipment_legs` rows are per-milestone events (assumed) so `LAG` gives true previous-leg. If a shipment can have duplicate milestones, add dedupe (`distinct on (shipment_ref, milestone)` keep latest `actual_at`).
2. **Week assignment:** v2 `week_iso` should follow the **current** milestone's `week_iso` (when the delay was observed), matching v1 — confirm.
3. **Min sample threshold** (`3`/`5`) and whether `<3` rows are omitted vs `indicative`.
4. **Delay-rate definition** confirmed as per-shipment-ratio-median (§2.8).
5. Should v2 **replace** v1 or run alongside during transition (recommended: alongside, deprecate v1 after FE switch).

---

## 7. ADDENDUM (2026-06-13) — data lineage reconciliation findings

Live read-only audit (anon = frontend view; service = raw legs, audit only) of why `/eurasia` shows **Moscow/Kaliningrad** as top delay while operations show **Vladivostok→Chukursay +64d**.

### Findings
- **`delay_index_weekly` is stale / out of sync with `shipment_legs`:**
  - Aggregate `week_iso` values are **monthly** (`2025-12 … 2026-06`, 7 values) while `shipment_legs.week_iso` is **ISO-week** (`2026-W19/W21/W27`). **Different format & granularity — cannot join.** Table named "weekly" actually holds month-labeled rows.
  - Aggregate contains **Vladivostok lanes** (`KR-VLADIVOSTOK-MOSCOW/SILIKATNAJA/CHUKURSAY`) but **`shipment_legs` has ZERO legs for any Vladivostok lane** (legs only cover 7 lanes: KR-ANDIJAN, KR-MALASZEWICZE, KR-BISHKEK, CN-ANDIJAN, CN-CHUKURSAY, KR-ALMATY, KR-CHUKURSAY; 361 legs total). The aggregate rows for Vladivostok are **orphaned / from a prior or separate source.**
  - Aggregate has **only `milestone = DEST_ARR`** (no segment breakdown), `destination`/`route_pattern` all NULL.
- **The map's "worst" is a 1-sample outlier:** top calc row = `KR-VLADIVOSTOK-MOSCOW · DEST_ARR · week "2026-06" · median_delay_d=28.875 · sample_count=1 · data_quality='indicative'`. The map sorts by `median_delay_d` with **no sample/quality filter**, so one indicative shipment dominates.
- **Median hides the operational tail:** `KR-VLADIVOSTOK-CHUKURSAY` aggregate = `median_delay_d=0.83, p90=9.72, sample=38` → looks fine on median even if individual containers are +64. Operations show **max/active**, the aggregate shows **median**.
- **The +64 Chukursay containers are NOT in this DB:** raw `shipment_legs` Chukursay legs max out at `delay_days≈3` (lane `KR-CHUKURSAY`, dest `"Chukursaj"`). The `+64` Vladivostok→Chukursay shipments exist only in the **separate operational tracking source**, not synced here.
- **Spelling variance** present but not the main cause: lane id `…CHUKURSAY`, legs/disruptions use `Chukursaj`, frontend dict also handles `Chukursay/Chukursaj/Chukursai`.
- **Kaliningrad** = manual `eurasia_disruptions` overlay (`Kaliningrad → Saint Petersburg +36d`, lane KR-VLADIVOSTOK-SILIKATNAJA), not calculated.

### Root cause
`delay_index_weekly` is a **stale, monthly, median, DEST_ARR-only** aggregate that is **not derived from the current `shipment_legs`** and is unsuitable for a "current blockage" view. The map therefore disagrees with the live operational dashboard.

### Required pipeline fixes (block v2)
1. **Single source of truth:** regenerate `delay_index_weekly` (and v2) **from the same `shipment_legs`** every run. Drop orphaned lanes not present in legs.
2. **Fix `week_iso` to true ISO-week** everywhere (or rename the monthly column to `month` and add a real weekly grain). Producer/consumer must agree.
3. Publish **`sample_count` + `data_quality`**, and the frontend must **filter/penalize** `sample_count < N` / `indicative` so a 1-sample row never ranks first.
4. Carry **`p90_delay_d` and `max_delay_days`** so a "current blockage" view can use the tail, not just the median.

## 8. Task 2 — `delay_current_snapshot` (current active-delay view)

A weekly median is the wrong tool for "what is blocked **now**". Add an **aggregate-safe current snapshot** of active/in-transit delayed shipments (no raw `shipment_legs` exposure):

```sql
create view public.delay_current_snapshot as
with active as (
  -- "current" = latest leg per shipment still in transit OR arrived within recency window,
  -- where actual_at is null (ETA exceeded) OR delay_days > 0.
  select distinct on (shipment_ref)
    shipment_ref, lane_id, milestone, destination, route_pattern,
    planned_at, actual_at,
    -- delay even when not yet arrived: now() - planned_at if overdue and not arrived
    case when actual_at is not null then delay_days
         when planned_at < now() then extract(epoch from (now() - planned_at))/86400.0
         else 0 end as eff_delay_days
  from public.shipment_legs
  where actual_at is null or actual_at >= now() - interval '21 days'   -- active/recent
  order by shipment_ref, planned_at desc
)
select
  lane_id, milestone, destination, route_pattern,
  count(*)                                                   as active_delayed_count,
  max(eff_delay_days)                                        as max_delay_days,      -- ← surfaces +64
  percentile_cont(0.5) within group (order by eff_delay_days) as median_delay_days,
  percentile_cont(0.9) within group (order by eff_delay_days) as p90_delay_days,
  count(*)                                                   as sample_count,
  max(planned_at)                                            as latest_planned_at,
  max(now())                                                 as last_updated,
  case when count(*) >= 5 then 'confirmed' when count(*) >= 3 then 'provisional' else 'indicative' end::data_quality_level as data_quality
from active
where eff_delay_days > 0
group by lane_id, milestone, destination, route_pattern;

grant select on public.delay_current_snapshot to anon, authenticated;
```
Fields per your spec: `lane_id, destination, route_pattern, milestone, active_delayed_count, max_delay_days, median_delay_days, p90_delay_days, sample_count, latest_planned_at, last_updated, data_quality` (+ `location_name/segment_type` derived frontend-side via the existing `(lane,milestone)` mapping). **`max_delay_days` is the field that makes Chukursay +64 surface.**

### Frontend: two explicit, labeled modes
- **`현재 지연`** (default for "blockage") ← `delay_current_snapshot`, ranked by `max_delay_days` (or `p90`). Shows Chukursay +64 if that's reality.
- **`주간 지연 지수`** (trend/analytics) ← `delay_index_weekly` (median). Clearly labeled as weekly historical median, **not** current.
Never mix the two without a mode label. Both require the **legs↔aggregate sync** above to be true.

---

## 9. ADDENDUM (2026-06-13b) — operational tracking source discovery + BLOCKER

Investigated the live DB (service-role, read-only) to locate the operational container table behind Supabase editor OID `43479`.

### What exists
- A **`tcr_*` family** is the operational tracking home: `tcr_containers_current` (container_no, origin, destination, current_location, eta_final, ata_final, arrived_yn, transit_time_days), `tcr_route_segments` (container_no, segment_name, from_location, to_location, etd/atd/eta/ata, is_current_segment), `tcr_risk_alerts` (container_no, alert_type, severity, status), `tcr_locations` (location_name, lat, lng — a geocoding table!), `tcr_snapshots`.
- **BUT every `tcr_*` detail table is currently EMPTY (0 rows)** except `tcr_snapshots` (2 rows). Latest `tcr_snapshots` (2026-06-11): `total=1000, in_transit=23, arrived=977, alert_count=0`, `by_destination={Andijan:290, Małaszewicze:405, Bishkek:238, Chukursay:20+CHUKURSAY:1, Almaty:18+5, …}`, `by_segment={OSH:1, Aksu:2, Orsha:3, "Xi'an":1, Zhengzhou:2}`. **Counts only — no delay days, no alert_reason.** (These counts match `delay_index_weekly` sample sizes, e.g. Małaszewicze 405 — so the snapshot feeds the weekly aggregate.)

### BLOCKER (cannot complete acceptance #1–#6 with current access)
- **The table behind OID `43479` is NOT reachable**: none of the 40 REST-exposed relations has `container_number` / `current_from` / `current_to` / `alert_reason` / `planned_destination_date` columns; probing ~30 candidate names returned nothing.
- **Cannot map OID→name**: no Postgres connection string/password in env (only REST API keys), `pg` not installed, and the service key grants REST only (no raw SQL / `pg_class`). So the `select … from pg_class where c.oid = 43479` query **cannot be run from here**.
- **`BMOU2303862` is not in any reachable table** (`tcr_containers_current` is empty), and `Chukursay` exists only as a **count** in `tcr_snapshots.by_destination`, with no delay.

### What the user must provide (has dashboard access)
1. The **table name** behind editor `43479` (shown in the Supabase Table Editor header), or run the provided `pg_class` query in the **SQL Editor**.
2. Confirm it's in the **`public` schema** and **grant SELECT** (or expose a view) so PostgREST/anon can reach it — currently it is not exposed.
3. Confirm whether the `tcr_*` detail tables are intended to hold this data (they're empty now) vs. the `43479` table being the real source.

### Ready-to-apply artifact (parameterized on `<OPS_TABLE>` once confirmed)
Aggregate-safe view — **never exposes raw container rows**, parses `alert_reason`, and uses the **original expected date (not the refreshed `planned_destination_date`)**:

```sql
create or replace view public.delay_current_snapshot as
with parsed as (
  select
    current_from, current_to, alert_level, last_checked_at,
    destination_date, planned_destination_date,
    -- "Planned arrival date passed by 64 days (expected: 2026-04-09)"
    nullif(substring(alert_reason from 'passed by\s+(\d+)\s+day'),'')::int        as alert_delay_days,
    nullif(substring(alert_reason from 'expected:\s*(\d{4}-\d{2}-\d{2})'),'')::date as alert_expected_date
  from public.<OPS_TABLE>
  where destination_date is null          -- still in transit (not yet arrived)
),
eff as (
  select *,
    -- operational delay basis = parsed alert delay (from ORIGINAL expected), NOT refreshed planned_destination_date
    coalesce(alert_delay_days, greatest(0, current_date - alert_expected_date)) as op_delay_days
  from parsed
)
select
  coalesce(current_from,'?')||' → '||coalesce(current_to,'?')                    as route_key,
  current_from, current_to, max(current_to)                                      as destination,
  count(*)                                                                       as active_container_count,
  count(*) filter (where alert_level ilike 'red%')                              as red_count,
  count(*) filter (where alert_level ilike 'yellow%')                           as yellow_count,
  max(op_delay_days)                                                            as max_operational_delay_days,
  percentile_cont(0.5) within group (order by op_delay_days)                    as median_operational_delay_days,
  percentile_cont(0.9) within group (order by op_delay_days)                    as p90_operational_delay_days,
  max(alert_delay_days)                                                         as max_alert_delay_days,
  percentile_cont(0.5) within group (order by alert_delay_days)                 as median_alert_delay_days,
  count(*)                                                                      as sample_count,
  max(last_checked_at)                                                          as last_checked_at,
  case when count(*)>=5 then 'confirmed' when count(*)>=3 then 'provisional' else 'indicative' end as data_quality,
  'operational_tracking_current'                                                as source
from eff
where op_delay_days > 0
group by current_from, current_to;

grant select on public.delay_current_snapshot to anon, authenticated;  -- view only; base table stays restricted
```
Geocoding for the `현재 지연` map can use **`tcr_locations`** (location_name → lat/lng) once populated, instead of the frontend dictionary. `/eurasia` then gets two labeled modes (`현재 지연` ← this view; `집계 지연 지수` ← `delay_index_weekly`).

**Net:** acceptance #1–#6 are **blocked on identifying/exposing the `43479` table** — its data is not reachable via REST and I cannot run raw SQL from here. The view + parser above are ready to apply the moment the table name is confirmed.

## 10. ADDENDUM (2026-06-13c) — TWO operational sources (FESCO + TCR) → unified `delay_current_snapshot`

Correction to the product model: there are **two distinct operational sources**, both must feed `현재 지연`, never merged without labels.

| | **FESCO** (Source 1) | **TCR** (Source 2) |
|---|---|---|
| Route | TSR / Russia transit rail (Vladivostok) | China rail / rail+truck |
| Example | `Vladivostok → Chukursaj +64d` | `Qingdao→Xi'an`, `Kashgar→Andijan` |
| Table | `<FESCO_TABLE>` behind editor `43479` — **NOT REST-reachable** (cols: container_number, current_from, current_to, planned_destination_date, destination_date, alert_level, alert_reason, segments_json, events_json, last_checked_at) | `tcr_*` family — **detail tables EMPTY**; only `tcr_snapshots` has counts (no delay) |
| Delay basis | parse `alert_reason` → `original_expected_arrival_date` + `operational_delay_days` (NOT refreshed `planned_destination_date`) | segment `eta` vs `ata` / `eta_final` vs `ata_final` — **once detail rows exist** |
| `transport_mode` | `TSR_RUSSIA_RAIL` | `CHINA_RAIL` / `CHINA_RAIL_TRUCK` (from `transport_mode`/`load_type`) |

### Normalized output (both sources map into this)
```ts
type OperationalCurrentDelay = {
  id: string;
  source_system: "FESCO" | "TCR";
  transport_mode: "TSR_RUSSIA_RAIL" | "CHINA_RAIL" | "CHINA_RAIL_TRUCK" | "UNKNOWN";
  route_family: "russia_tsr" | "china_rail" | "china_rail_truck";
  container_count: number; active_delayed_count: number;
  current_from?: string; current_to?: string; origin?: string; destination?: string; route_label: string;
  location_name?: string; segment_type?: "port" | "rail_hub" | "border" | "destination" | "corridor";
  max_delay_days?: number; median_delay_days?: number; p90_delay_days?: number;
  alert_delay_days?: number; original_expected_arrival_date?: string; current_eta?: string;
  last_checked_at?: string; data_quality: "confirmed" | "provisional" | "indicative"; source_table: string;
};
```

### Source-specific views (identical column list so UNION works)
```sql
-- 1) FESCO  (parameterized on <FESCO_TABLE>; parses alert_reason; uses ORIGINAL expected date)
create or replace view public.fesco_delay_current_snapshot as
with p as (
  select current_from, current_to, alert_level, last_checked_at, planned_destination_date as current_eta,
    nullif(substring(alert_reason from 'passed by\s+(\d+)\s+day'),'')::int        as alert_delay_days,
    nullif(substring(alert_reason from 'expected:\s*(\d{4}-\d{2}-\d{2})'),'')::date as orig_expected
  from public.<FESCO_TABLE> where destination_date is null      -- still in transit
), e as (select *, coalesce(alert_delay_days, greatest(0, current_date - orig_expected)) d from p)
select 'FESCO' source_system, 'TSR_RUSSIA_RAIL' transport_mode, 'russia_tsr' route_family,
  coalesce(current_from,'?')||' → '||coalesce(current_to,'?') route_label,
  current_from, current_to, null::text origin, max(current_to) destination,
  current_to location_name, 'destination'::text segment_type,
  count(*) container_count, count(*) filter (where d>0) active_delayed_count,
  max(d) max_delay_days, percentile_cont(0.5) within group (order by d) median_delay_days,
  percentile_cont(0.9) within group (order by d) p90_delay_days,
  max(alert_delay_days) alert_delay_days, min(orig_expected) original_expected_arrival_date, max(current_eta)::text current_eta,
  max(last_checked_at) last_checked_at,
  case when count(*)>=5 then 'confirmed' when count(*)>=3 then 'provisional' else 'indicative' end data_quality,
  '<FESCO_TABLE>' source_table
from e where d>0 group by current_from, current_to;

-- 2) TCR  (from tcr_route_segments current segment + tcr_containers_current; EMPTY until detail rows land)
create or replace view public.tcr_delay_current_snapshot as
with seg as (
  select s.from_location, s.to_location, s.eta, s.ata,
         greatest(0, (coalesce(s.ata, current_date::timestamptz)::date - s.eta::date)) d,
         c.origin, c.destination, c.eta_final, c.updated_at,
         case when c.load_type ilike '%truck%' or s.segment_name ilike '%truck%' then 'CHINA_RAIL_TRUCK' else 'CHINA_RAIL' end mode
  from public.tcr_route_segments s
  join public.tcr_containers_current c on c.container_no = s.container_no
  where s.is_current_segment = true and c.arrived_yn = false
)
select 'TCR' source_system, max(mode) transport_mode,
  case when max(mode)='CHINA_RAIL_TRUCK' then 'china_rail_truck' else 'china_rail' end route_family,
  coalesce(from_location,'?')||' → '||coalesce(to_location,'?') route_label,
  from_location current_from, to_location current_to, max(origin) origin, max(destination) destination,
  to_location location_name,
  case when to_location ilike '%border%' then 'border' else 'rail_hub' end::text segment_type,
  count(*) container_count, count(*) filter (where d>0) active_delayed_count,
  max(d) max_delay_days, percentile_cont(0.5) within group (order by d) median_delay_days,
  percentile_cont(0.9) within group (order by d) p90_delay_days,
  null::int alert_delay_days, null::date original_expected_arrival_date, max(eta_final)::text current_eta,
  max(updated_at) last_checked_at,
  case when count(*)>=5 then 'confirmed' when count(*)>=3 then 'provisional' else 'indicative' end data_quality,
  'tcr_route_segments' source_table
from seg group by from_location, to_location;

-- 3) UNIFIED (preserves source_system + transport_mode)
create or replace view public.delay_current_snapshot as
  select * from public.fesco_delay_current_snapshot
  union all
  select * from public.tcr_delay_current_snapshot;

grant select on public.fesco_delay_current_snapshot, public.tcr_delay_current_snapshot, public.delay_current_snapshot to anon, authenticated;
```
- **Geocoding:** `location_name` → lat/lng via `tcr_locations` (once populated) or the frontend dict.
- **`segments_json`/`events_json`** (FESCO) can later refine `current_eta` / segment history; not required for v1.

### Frontend (build AFTER the views exist & return rows)
`/eurasia` modes: **`현재 지연`** (default ← `delay_current_snapshot`), **`집계 지연 지수`** (← `delay_index_weekly`, already shipped), **`수동 이슈`** (← `eurasia_disruptions`, overlay). Within `현재 지연`, source chips: **전체 / FESCO·TSR / TCR·중국 철도 / TCR·중국 철도+트럭** (filter on `source_system`+`transport_mode`). Every marker/row label carries the source, e.g. `FESCO · TSR · Vladivostok → Chukursaj · +64일`.

### HARD BLOCKER (why I stopped at design, not wiring)
1. **FESCO `<FESCO_TABLE>` (editor `43479`) is unreachable** — not in the 40 exposed relations, no `fesco_*`/`tsr_*` table answers REST, and I can't map the OID (no DB connection string/password; service key = REST only, no `pg_class`).
2. **TCR detail tables are empty** — `tcr_delay_current_snapshot` would return 0 rows until `tcr_route_segments`/`tcr_containers_current` are populated. `tcr_snapshots` has counts only (no per-container delay) — will not fabricate delay from it.

**To unblock (you have dashboard access), provide any one:** (a) the **FESCO table name** + a `GRANT SELECT` (or expose the views above), (b) a **Postgres connection string** so I can introspect/apply DDL, or (c) run the three `create view` statements yourself and tell me they exist. The moment `delay_current_snapshot` returns rows, I wire the `현재 지연` mode + source chips + normalized mapping.

## 11. ADDENDUM (2026-06-13d) — TWO-PROJECT reality + Option B (2nd client) — FINAL plan

**Confirmed:** FESCO and TCR live in **different Supabase projects** (token lists `hmg…`,`tsx…`; FESCO is in `zidk…`):
- **Frontend project `hmgbvqczmyjixkqbruzp`** (this repo `.env`): TCR `tcr_*`, `delay_index_weekly`, `lanes`, `eurasia_disruptions`.
- **FESCO project `zidkckbabtajpgkhxmfm`**: `public.fesco_container_tracking_current` (the +64 data). My credentials cannot reach `zidk…`.

**Decision = Option B:** frontend reads `zidk…` directly via a **second Supabase client** and unions in-app (no data duplication; FESCO raw stays in `zidk…`, only its aggregate view is exposed). So §10's single-project unified view is superseded — there is **no DB-level unified view**.

### Work split
**A) In `zidk…` (FESCO project) — you run this in its SQL editor:**
```sql
create or replace view public.fesco_delay_current_snapshot as
with p as (
  select current_from, current_to, alert_level, last_checked_at,
    planned_destination_date as current_eta,
    nullif(substring(alert_reason from 'passed by\s+(\d+)\s+day'),'')::int          as alert_delay_days,
    nullif(substring(alert_reason from 'expected:\s*(\d{4}-\d{2}-\d{2})'),'')::date as orig_expected
  from public.fesco_container_tracking_current
  where destination_date is null                       -- still in transit
),
e as (select *, coalesce(alert_delay_days, greatest(0, current_date - orig_expected)) as d from p)
select
  'FESCO'::text source_system, 'TSR_RUSSIA_RAIL'::text transport_mode, 'russia_tsr'::text route_family,
  (coalesce(current_from,'?')||' → '||coalesce(current_to,'?'))::text route_label,
  current_from::text current_from, current_to::text current_to, null::text origin, max(current_to)::text destination,
  current_to::text location_name, 'destination'::text segment_type,
  count(*)::bigint container_count, count(*) filter (where d>0)::bigint active_delayed_count,
  max(d)::numeric max_delay_days,
  percentile_cont(0.5) within group (order by d)::numeric median_delay_days,
  percentile_cont(0.9) within group (order by d)::numeric p90_delay_days,
  max(alert_delay_days)::int alert_delay_days, min(orig_expected)::date original_expected_arrival_date,
  max(current_eta)::text current_eta, max(last_checked_at)::timestamptz last_checked_at,
  (case when count(*)>=5 then 'confirmed' when count(*)>=3 then 'provisional' else 'indicative' end)::text data_quality,
  'fesco_container_tracking_current'::text source_table
from e where d>0 group by current_from, current_to;

grant select on public.fesco_delay_current_snapshot to anon, authenticated;  -- view only; raw table NOT granted
notify pgrst, 'reload schema';
```
(Same FESCO delay rule: baseline = `expected:` date parsed from `alert_reason`, **not** the refreshed `planned_destination_date`.)

**B) In `hmg…` (frontend project):** apply repo migration `20260613000000_delay_current_snapshot.sql` → creates `tcr_delay_current_snapshot` (TCR-only; empty until `tcr_*` detail populated).

**C) Frontend (after A+B + creds):** add a 2nd server client `fescoPublicServer` from new env `FESCO_SUPABASE_URL` + `FESCO_SUPABASE_PUBLISHABLE_KEY`; server fn reads `fesco_delay_current_snapshot` (zidk…) + `tcr_delay_current_snapshot` (hmg…), normalizes both into `OperationalCurrentDelay`, unions in-app. `/eurasia` modes: `현재 지연` (default, this union) · `집계 지연 지수` (delay_index_weekly, already shipped) · `수동 이슈` (eurasia_disruptions). Source chips: 전체 / FESCO·TSR / TCR·중국 철도 / TCR·중국 철도+트럭.

### What I need from you to finish C
1. Run **(A)** in the `zidk…` SQL editor (creates the FESCO aggregate view + grant).
2. Provide **`zidk…` project URL + anon (publishable) key** → I add them as `FESCO_SUPABASE_URL` / `FESCO_SUPABASE_PUBLISHABLE_KEY`.
3. Apply **(B)** in `hmg…` (or I can `supabase db push` if you give the hmg… DB password / a connection string).

Then I wire `현재 지연` and verify the Chukursaj +64 appears.
