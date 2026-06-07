import type { Forecast } from "@/lib/api/forecasts";

// 방향 — 서구식: 상승=녹·하락=적·보합=회. 색은 항상 글리프(▲▼▬) 동반.
export const DIR_META: Record<string, { glyph: string; label: string }> = {
  up: { glyph: "▲", label: "상승" },
  down: { glyph: "▼", label: "하락" },
  flat: { glyph: "▬", label: "보합권" },
};
// 방향 토큰 클래스(리터럴 — Tailwind JIT 스캔 대상). text=글리프/수치, badge=배지, spark=스파크라인 currentColor.
export const DIR_CLS: Record<string, { text: string; badge: string; spark: string }> = {
  up: { text: "text-direction-up", badge: "bg-direction-up/10 text-direction-up", spark: "text-direction-up" },
  down: { text: "text-direction-down", badge: "bg-direction-down/10 text-direction-down", spark: "text-direction-down" },
  flat: { text: "text-direction-flat", badge: "bg-direction-flat/10 text-direction-flat", spark: "text-direction-flat" },
};
export const dirCls = (dir: string | null | undefined) => DIR_CLS[dir ?? "flat"] ?? DIR_CLS.flat;

// 표시 라벨·순서 단일 소스(보드·카드·상세·admin 공통). metric_ref 불변 — 표시 레이어만.
// baseLabel 있는 권역 라벨 카드만 "기준 지표:" 캡션 의무(권역 일반화 근거 공개).
export type TargetMeta = { metric_ref: string; displayLabel: string; displayOrder: number; baseLabel?: string };
export const TARGET_META: TargetMeta[] = [
  { metric_ref: "WCI", displayLabel: "WCI", displayOrder: 1 },
  { metric_ref: "SCFI", displayLabel: "SCFI", displayOrder: 2 },
  { metric_ref: "KCCI", displayLabel: "KCCI", displayOrder: 3 },
  { metric_ref: "kita_sea_rates:부산-뉴욕", displayLabel: "부산 → 미동부", displayOrder: 4, baseLabel: "KITA 부산–뉴욕 (USD/FEU)" },
  { metric_ref: "kita_sea_rates:부산-로테르담", displayLabel: "부산 → 유럽", displayOrder: 5, baseLabel: "KITA 부산–로테르담 (USD/FEU)" },
  { metric_ref: "WCI_SHA_RTM", displayLabel: "상해 → 유럽", displayOrder: 6, baseLabel: "Drewry WCI 상하이–로테르담" },
  { metric_ref: "kita_sea_rates:부산-로스앤젤레스", displayLabel: "부산 → 미서부", displayOrder: 7, baseLabel: "KITA 부산–로스앤젤레스 (USD/FEU)" },
  { metric_ref: "WCI_SHA_LAX", displayLabel: "상해 → 미서부", displayOrder: 8, baseLabel: "Drewry WCI 상하이–로스앤젤레스" },
  { metric_ref: "kita_sea_rates:부산-함부르크", displayLabel: "부산 → 함부르크", displayOrder: 9, baseLabel: "KITA 부산–함부르크 (USD/FEU)" },
];
const META_BY_REF = new Map(TARGET_META.map((m) => [m.metric_ref, m]));

export const FACTOR_LABEL: Record<string, string> = {
  momentum: "모멘텀",
  supply: "공급(선복)",
  demand: "수요",
  cost: "비용(연료/운임)",
  pricing: "가격(운임 수준)",
};
export const MISSING_LABEL: Record<string, string> = {
  cost: "유가",
  pricing: "운임공시",
  demand: "수요",
  supply: "공급",
  momentum: "모멘텀",
};

// 지표 계열 — 시안의 '출처' 필터 대체(출처별 건수는 모호해 부정확).
export type SeriesClass = "KITA" | "KCCI" | "SCFI" | "WCI";
export const SERIES_LABEL: Record<SeriesClass, string> = {
  KITA: "KITA 노선",
  KCCI: "KCCI",
  SCFI: "SCFI",
  WCI: "WCI",
};
export function seriesClassOf(f: Forecast): SeriesClass | null {
  const ref = f.metric_ref ?? "";
  if (ref.startsWith("kita_sea_rates:")) return "KITA";
  if (ref === "KCCI") return "KCCI";
  if (ref === "SCFI") return "SCFI";
  if (ref.startsWith("WCI")) return "WCI";
  return null;
}

// 노선명 — kita면 "부산 → 도착지", 지수면 metric_ref.
export function routeName(f: Forecast): string {
  const ref = f.metric_ref ?? "";
  if (ref.startsWith("kita_sea_rates:")) {
    const lane = ref.slice("kita_sea_rates:".length);
    const i = lane.indexOf("-");
    return i >= 0 ? `${lane.slice(0, i)} → ${lane.slice(i + 1)}` : lane;
  }
  return ref || f.module;
}

// 표시 라벨(단일 소스). 미등록 metric_ref는 routeName 폴백.
export function displayLabelOf(f: Forecast): string {
  return META_BY_REF.get(f.metric_ref ?? "")?.displayLabel ?? routeName(f);
}
export function displayOrderOf(f: Forecast): number {
  return META_BY_REF.get(f.metric_ref ?? "")?.displayOrder ?? 999;
}
// 권역 라벨 카드 기준지표 캡션(지수 자체 WCI/SCFI/KCCI는 라벨=지표라 null).
export function baseIndexCaption(f: Forecast): string | null {
  const b = META_BY_REF.get(f.metric_ref ?? "")?.baseLabel;
  return b ? `기준 지표: ${b}` : null;
}

// 필터 적용(URL 쿼리 상태 → 카드 필터). 순수 함수.
export type ForecastFilter = { cadence?: "weekly" | "monthly"; dir: string[]; series: string[] };
export function applyFilter(fs: Forecast[], f: ForecastFilter): Forecast[] {
  return fs.filter((x) => {
    if (f.cadence && x.cadence !== f.cadence) return false;
    if (f.dir.length && !(x.direction && f.dir.includes(x.direction))) return false;
    if (f.series.length) {
      const sc = seriesClassOf(x);
      if (!sc || !f.series.includes(sc)) return false;
    }
    return true;
  });
}

// statement → 문장 배열(소수점·천단위 쉼표 오분할 방지: 종결부호 뒤 공백/끝만).
export function sentences(s: string): string[] {
  return (s || "").split(/(?<=[.!?。])\s+/).map((x) => x.trim()).filter(Boolean);
}

export function dDay(horizon: string | null | undefined): string | null {
  if (!horizon) return null;
  const d = Math.round((Date.parse(`${horizon}T00:00:00Z`) - Date.now()) / 86400000);
  return d >= 0 ? `D-${d}` : `D+${-d}`;
}
export const mdLabel = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

// 근거 N/5 — non-missing 팩터 수.
export function evidenceCount(f: Forecast): { present: number; total: number } {
  const fs = f.factor_scores ?? [];
  return { present: fs.filter((x) => !x.missing && x.score != null).length, total: fs.length || 5 };
}
export function missingNames(f: Forecast): string[] {
  return (f.factor_scores ?? []).filter((x) => x.missing).map((x) => MISSING_LABEL[x.factor] ?? x.factor);
}

// 가장 가까운 다음 확인(due) 라벨.
export function nearestWatch(f: Forecast): { due: string; source: string } | null {
  const ws = (f.watch_points ?? []).filter((w) => w.due).sort((a, b) => a.due.localeCompare(b.due));
  return ws[0] ? { due: ws[0].due, source: ws[0].source } : null;
}

// 방향 강도(확률 아님) — composite |점수|/2 → 0~100%, 부호로 방향. 더미 금지·방법론 준수.
export function directionStrength(
  score: number | null | undefined,
  direction?: string | null,
): { dir: "up" | "down" | "flat"; pct: number; label: string } {
  const s = score ?? 0;
  const dir = (direction as "up" | "down" | "flat" | null) ?? (s >= 0.4 ? "up" : s <= -0.4 ? "down" : "flat");
  const pct = Math.round(Math.min(Math.abs(s) / 2, 1) * 100);
  return { dir, pct, label: dir === "up" ? "상승" : dir === "down" ? "하락" : "보합" };
}

// 전 전망 watch_points 통합 → 다가오는 이벤트 캘린더(실 일정만, 중복 제거).
export function upcomingEvents(
  forecasts: Forecast[],
  now = Date.now(),
  limit = 6,
): { due: string; source: string; label: string }[] {
  const today = new Date(now).toISOString().slice(0, 10);
  const seen = new Set<string>();
  const out: { due: string; source: string; label: string }[] = [];
  for (const f of forecasts) {
    for (const w of f.watch_points ?? []) {
      if (!w.due || w.due < today) continue;
      const k = `${w.due}|${w.source}|${w.label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(w);
    }
  }
  out.sort((a, b) => a.due.localeCompare(b.due));
  return out.slice(0, limit);
}

// ─── KPI 산출(전부 실데이터, 더미 0) ───
const DAY = 86400000;
const weekStartMonday = (now = Date.now()) => {
  const d = new Date(now);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
};

export type Kpis = {
  hitRate: { rate: number | null; sample: number; gate: boolean }; // gate=표본<10
  publishedThisWeek: number;
  awaitingJudgment: number; // published & horizon 미도래
  avgEvidence: number | null; // N/5
  leadTimeDays: number | null;
};

export function computeKpis(forecasts: Forecast[], now = Date.now()): Kpis {
  const todayIso = new Date(now).toISOString().slice(0, 10);
  // 적중률 — 최근 12주 resolved
  const resolved12 = forecasts.filter(
    (f) => f.status === "resolved" && f.resolved_at && Date.parse(f.resolved_at) >= now - 12 * 7 * DAY,
  );
  const hit = resolved12.filter((f) => f.outcome === "hit").length;
  const partial = resolved12.filter((f) => f.outcome === "partial").length;
  const sample = resolved12.length;
  const rate = sample > 0 ? Math.round(((hit + partial * 0.5) / sample) * 100) : null;

  const published = forecasts.filter((f) => f.status === "published" || f.status === "resolved");
  const ws = weekStartMonday(now);
  const publishedThisWeek = forecasts.filter((f) => f.published_at && Date.parse(f.published_at) >= ws).length;
  const awaitingJudgment = forecasts.filter(
    (f) => f.status === "published" && f.horizon_date && f.horizon_date > todayIso,
  ).length;

  const evs = published.map((f) => evidenceCount(f).present);
  const avgEvidence = evs.length ? Math.round((evs.reduce((a, b) => a + b, 0) / evs.length) * 10) / 10 : null;

  const leads = forecasts
    .filter((f) => f.published_at && f.created_at)
    .map((f) => (Date.parse(f.published_at as string) - Date.parse(f.created_at)) / DAY)
    .filter((d) => d >= 0);
  const leadTimeDays = leads.length ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 : null;

  return {
    hitRate: { rate, sample, gate: sample < 10 },
    publishedThisWeek,
    awaitingJudgment,
    avgEvidence,
    leadTimeDays,
  };
}
