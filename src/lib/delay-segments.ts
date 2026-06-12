// 계산 지연(calculated_from_tracking) 변환 레이어.
// 소스: delay_index_weekly (lane_id + milestone + week_iso) — shipment_legs(planned_at vs actual_at)
// 에서 파이프라인이 집계한 값. median_delay_d = 해당 milestone에서 관측된 "누적" 지연(중앙값)이며,
// 그 milestone이 지연을 '유발'했다는 의미가 아니다(이전 구간 누적일 수 있음).
//
// (lane_id, milestone) → 위치/세그먼트/좌표 매핑은 lanes.border_points + milestone enum으로 도출.
// 신뢰 가능한 좌표가 없으면 좌표를 지어내지 않고 unmapped(좌표 확인 필요)로 분류한다.
import { cityMeta } from "@/lib/eurasia-geo";
import { congestionSeverity, SEVERITY_META, type Severity } from "@/lib/congestion";
import type { DelayWeeklyRow, LaneRow } from "@/lib/api/eurasia";

export type SegmentType = "port" | "border" | "hub" | "destination" | "corridor";

// milestone_code enum → 라벨 + 세그먼트 유형.
const MILESTONE_META: Record<string, { label: string; type: SegmentType }> = {
  ORIGIN_DEP: { label: "출발지 항만", type: "port" },
  SEA_TS_ARR: { label: "해상 환적 도착", type: "port" },
  RAIL_DEP_CN: { label: "중국 철도 출발", type: "hub" },
  XIAN_HUB: { label: "시안 허브", type: "hub" },
  KASHI_ARR: { label: "카슈가르 도착", type: "hub" },
  KASHI_BONDED: { label: "카슈가르 보세", type: "hub" },
  TRUCK_DEP: { label: "트럭 출발", type: "hub" },
  CN_BORDER: { label: "중국 국경", type: "border" },
  KG_UZ_BORDER: { label: "키르기스·우즈벡 국경", type: "border" },
  DEST_ARR: { label: "도착지", type: "destination" },
};

export function milestoneMeta(m: string): { label: string; type: SegmentType } {
  return MILESTONE_META[m] ?? { label: m, type: "hub" };
}

// 카테고리 매칭 — border_points 중 알려진 도시를 좌표키로 비교(별칭/언어 무관).
function coordKey(name: string): string | null {
  const m = cityMeta(name);
  return m ? `${m.coords[0]},${m.coords[1]}` : null;
}
function keySet(names: string[]): Set<string> {
  return new Set(names.map(coordKey).filter((k): k is string => k != null));
}
const SEA_TS_KEYS = keySet(["Vladivostok", "Vostochny", "Nakhodka"]);
const CN_BORDER_KEYS = keySet(["Khorgos", "Dostyk", "Altynkol", "Alashankou", "Erlian"]);
const KG_UZ_KEYS = keySet(["Saryagash", "Osh", "Andijan", "Tashkent"]);
const CN_RAIL_KEYS = keySet(["Xian", "Chengdu", "Zhengzhou", "Yiwu", "Urumqi", "Qingdao"]);

function findInCategory(bp: string[], keys: Set<string>): string | null {
  for (const b of bp) {
    const k = coordKey(b);
    if (k && keys.has(k)) return b;
  }
  return null;
}

// 명칭이 곧 위치인 milestone(국경/허브 도시가 enum에 박혀 있는 경우)만 고정 매핑.
const FIXED_CITY: Record<string, string> = {
  XIAN_HUB: "Xian",
  KASHI_ARR: "Kashgar",
  KASHI_BONDED: "Kashgar",
};

type LaneLite = Pick<LaneRow, "id" | "name_ko" | "name_en" | "border_points">;

// (lane, milestone) → 좌표. 신뢰 불가 시 null(→ 좌표 확인 필요).
function resolveMilestoneLocation(
  lane: LaneLite,
  milestone: string,
  destinationHint: string | null,
): { location_name: string; lat: number; lng: number } | null {
  const bp = (lane.border_points ?? []).map((s) => s.trim()).filter(Boolean);
  let name: string | null = null;

  if (FIXED_CITY[milestone]) name = FIXED_CITY[milestone];
  else if (milestone === "ORIGIN_DEP") name = bp[0] ?? null;
  else if (milestone === "DEST_ARR") name = bp[bp.length - 1] ?? destinationHint ?? null;
  else if (milestone === "SEA_TS_ARR") name = findInCategory(bp, SEA_TS_KEYS);
  else if (milestone === "CN_BORDER") name = findInCategory(bp, CN_BORDER_KEYS);
  else if (milestone === "KG_UZ_BORDER") name = findInCategory(bp, KG_UZ_KEYS);
  else if (milestone === "RAIL_DEP_CN") name = findInCategory(bp, CN_RAIL_KEYS);
  // TRUCK_DEP 등 신뢰 위치 없는 milestone → null

  if (!name) return null;
  const meta = cityMeta(name);
  if (!meta) return null;
  return { location_name: name, lat: meta.coords[1], lng: meta.coords[0] };
}

// ── 출력 타입(존재하는 필드만. baseline_days/actual_days/delay_rate는 공개 집계에 없어 미포함) ──
type CalcBase = {
  id: string;
  lane_id: string;
  milestone: string;
  laneName: string;
  segment_type: SegmentType;
  delay_days: number; // 누적 관측 지연(중앙값)
  severity: Severity;
  sample_count: number | null;
  on_time_rate: number | null;
  otp_pct: number | null;
  destination: string | null;
  route_pattern: string | null;
  data_quality: string | null;
  week_iso: string | null;
  // 신뢰도: 표본 부족(sample<3)·indicative는 저신뢰 → 상위 랭킹/기본 강조에서 제외(de-prioritize).
  confident: boolean;
  source: "calculated_from_tracking";
};

// 저신뢰 판정 기준(임시 상수 — 추후 설정화). 1-샘플 indicative 이상치가 1위로 오르는 것 방지.
const MIN_CONFIDENT_SAMPLE = 3;
function isConfident(sampleCount: number | null, dataQuality: string | null): boolean {
  return (sampleCount ?? 0) >= MIN_CONFIDENT_SAMPLE && dataQuality !== "indicative";
}
export type CalcDelayRecord = CalcBase & { location_name: string; lat: number; lng: number };
export type CalcUnmapped = CalcBase & { reason: string };
export type CalcBuild = { calculated: CalcDelayRecord[]; unmapped: CalcUnmapped[] };

const round1 = (v: number) => Math.round(v * 10) / 10;

// delay_index_weekly → (lane, milestone)별 최신 주 기준 계산 지연 레코드.
export function buildCalculatedDelays(lanes: LaneLite[], delays: DelayWeeklyRow[]): CalcBuild {
  const laneById = new Map(lanes.map((l) => [l.id, l]));

  // (lane_id, milestone)별 최신 week_iso 행만 유지.
  const latest = new Map<string, DelayWeeklyRow>();
  for (const d of delays) {
    if (!d.milestone || d.median_delay_d == null) continue;
    const key = `${d.lane_id}|${d.milestone}`;
    const cur = latest.get(key);
    if (!cur || (d.week_iso ?? "") > (cur.week_iso ?? "")) latest.set(key, d);
  }

  const calculated: CalcDelayRecord[] = [];
  const unmapped: CalcUnmapped[] = [];

  for (const [key, d] of latest) {
    const lane = laneById.get(d.lane_id);
    const milestone = d.milestone as string;
    const meta = milestoneMeta(milestone);
    const delay_days = Math.max(0, round1(d.median_delay_d ?? 0));
    const severity = congestionSeverity(delay_days) ?? "normal";
    const base: CalcBase = {
      id: key,
      lane_id: d.lane_id,
      milestone,
      laneName: lane ? (lane.name_ko ?? lane.name_en ?? lane.id) : d.lane_id,
      segment_type: meta.type,
      delay_days,
      severity,
      sample_count: d.sample_count,
      on_time_rate: d.on_time_rate,
      otp_pct: d.otp_pct,
      destination: d.destination,
      route_pattern: d.route_pattern,
      data_quality: d.data_quality,
      week_iso: d.week_iso,
      confident: isConfident(d.sample_count, d.data_quality),
      source: "calculated_from_tracking",
    };
    const loc = lane ? resolveMilestoneLocation(lane, milestone, d.destination) : null;
    if (loc) calculated.push({ ...base, location_name: loc.location_name, lat: loc.lat, lng: loc.lng });
    else unmapped.push({ ...base, reason: `${milestone} 위치 매핑 불가 (lane border_points 부족)` });
  }

  // 신뢰 항목 우선 → 그 안에서 지연 내림차순. 저신뢰(1-샘플 indicative 등)는 절대 1위로 오지 않음.
  const byConf = (a: CalcBase, b: CalcBase) =>
    Number(b.confident) - Number(a.confident) ||
    b.delay_days - a.delay_days ||
    SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank;
  calculated.sort(byConf);
  unmapped.sort(byConf);
  return { calculated, unmapped };
}
