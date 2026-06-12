-- 현재 운영 지연 — TCR 스냅샷 뷰 (프론트 프로젝트 hmgbvqczmyjixkqbruzp 전용).
--
-- 아키텍처(2026-06-13, Option B 채택): FESCO와 TCR은 서로 다른 Supabase 프로젝트에 있다.
--   • 이 프로젝트(hmg…)        = TCR(tcr_*), delay_index_weekly, lanes, eurasia_disruptions
--   • FESCO 프로젝트(zidk…)    = public.fesco_container_tracking_current  ← 여기 마이그레이션 대상 아님
-- 프론트엔드가 2nd Supabase client로 zidk…의 fesco_delay_current_snapshot를 직접 읽고,
-- 이 프로젝트의 tcr_delay_current_snapshot와 앱 레이어에서 union(source_system 보존).
-- 따라서 여기엔 통합 뷰를 두지 않는다. (zidk…용 FESCO 뷰 SQL은 contract 스펙 §10 참고)
--
-- 원본 컨테이너 행은 grant하지 않는다(raw 비노출). 뷰는 소유자 권한 실행(security_invoker 미사용).
-- TCR 상세 테이블이 비어 있으면 0행을 반환한다(데이터 적재 시 자동 채워짐).

create or replace view public.tcr_delay_current_snapshot as
with seg as (
  select s.from_location, s.to_location, s.eta, s.ata,
    greatest(0, (coalesce(s.ata, current_date::timestamptz)::date - s.eta::date)) as d,
    c.origin, c.destination, c.eta_final, c.updated_at,
    (case when c.load_type ilike '%truck%' or s.segment_name ilike '%truck%' then 'CHINA_RAIL_TRUCK' else 'CHINA_RAIL' end) as mode
  from public.tcr_route_segments s
  join public.tcr_containers_current c on c.container_no = s.container_no
  where s.is_current_segment = true and coalesce(c.arrived_yn, false) = false and s.eta is not null
)
select
  'TCR'::text                                                   as source_system,
  max(mode)::text                                               as transport_mode,
  (case when max(mode)='CHINA_RAIL_TRUCK' then 'china_rail_truck' else 'china_rail' end)::text as route_family,
  (coalesce(from_location,'?')||' → '||coalesce(to_location,'?'))::text as route_label,
  from_location::text                                           as current_from,
  to_location::text                                             as current_to,
  max(origin)::text                                             as origin,
  max(destination)::text                                        as destination,
  to_location::text                                             as location_name,
  (case when to_location ilike '%border%' then 'border' else 'rail_hub' end)::text as segment_type,
  count(*)::bigint                                              as container_count,
  count(*) filter (where d>0)::bigint                           as active_delayed_count,
  max(d)::numeric                                               as max_delay_days,
  percentile_cont(0.5) within group (order by d)::numeric       as median_delay_days,
  percentile_cont(0.9) within group (order by d)::numeric       as p90_delay_days,
  null::int                                                     as alert_delay_days,
  null::date                                                    as original_expected_arrival_date,
  max(eta_final)::text                                          as current_eta,
  max(updated_at)::timestamptz                                  as last_checked_at,
  (case when count(*)>=5 then 'confirmed' when count(*)>=3 then 'provisional' else 'indicative' end)::text as data_quality,
  'tcr_route_segments'::text                                    as source_table
from seg where d>0 group by from_location, to_location;

grant select on public.tcr_delay_current_snapshot to anon, authenticated;

notify pgrst, 'reload schema';
