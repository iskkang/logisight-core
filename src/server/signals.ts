export type SignalState = "normal" | "observe" | "caution" | "alert";

export type ComputedSignal = {
  label: string;
  state: SignalState;
  basis: string;
  sources: string[];
  asOf: string | null;
  confidence: "high" | "medium" | "low";
};

type KcciPoint = { week_iso: string; value: number | null };
type IndexPoint = { period: string; value: number | null };

function percentile52w(series: number[], current: number): number {
  if (series.length === 0) return 0;
  const below = series.filter((v) => v <= current).length;
  return Math.round((below / series.length) * 100);
}

function momChange(series: IndexPoint[]): number | null {
  if (series.length < 2) return null;
  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (latest.value === null || prev.value === null || prev.value === 0) return null;
  return ((latest.value - prev.value) / prev.value) * 100;
}

// KCCI 3-week WoW average + 52w percentile ≥70 → caution/alert
export function computeOceanPressureSignal(
  kcciSeries: KcciPoint[],
  asOf: string | null,
): ComputedSignal | null {
  const valid = kcciSeries
    .filter((p): p is { week_iso: string; value: number } => p.value !== null)
    .sort((a, b) => a.week_iso.localeCompare(b.week_iso));

  if (valid.length < 4) return null;

  const last3 = valid.slice(-3).map((p) => p.value);
  const prev3 = valid.slice(-6, -3).map((p) => p.value);
  if (last3.length < 3 || prev3.length < 3) return null;

  const avgLast = last3.reduce((s, v) => s + v, 0) / 3;
  const avgPrev = prev3.reduce((s, v) => s + v, 0) / 3;
  const wow = avgPrev === 0 ? 0 : ((avgLast - avgPrev) / avgPrev) * 100;

  const allValues = valid.map((p) => p.value);
  const pct = percentile52w(allValues, avgLast);

  let state: SignalState = "normal";
  if (pct >= 80 && wow > 0) state = "alert";
  else if (pct >= 70 && wow > 0) state = "caution";
  else if (pct >= 60) state = "observe";

  return {
    label: "해상 운임 압력",
    state,
    basis: `KCCI 3주 평균 ${Math.round(avgLast).toLocaleString()} — 52주 백분위 ${pct}%, WoW ${wow >= 0 ? "+" : ""}${wow.toFixed(1)}%`,
    sources: ["KCCI"],
    asOf,
    confidence: valid.length >= 12 ? "high" : "medium",
  };
}

// SCFI MoM ±5% + WCI 정합 여부 (인과 단정 금지 — 상관 표현만)
export function computeGlobalMomentumSignal(
  scfiSeries: IndexPoint[],
  wciSeries: IndexPoint[],
  asOf: string | null,
): ComputedSignal | null {
  const scfiMoM = momChange(scfiSeries);
  const wciMoM = momChange(wciSeries);
  if (scfiMoM === null) return null;

  const aligned = wciMoM !== null && Math.sign(scfiMoM) === Math.sign(wciMoM);
  const magnitude = Math.abs(scfiMoM);

  let state: SignalState = "normal";
  if (magnitude >= 10) state = aligned ? "alert" : "caution";
  else if (magnitude >= 5) state = aligned ? "caution" : "observe";

  const alignText = wciMoM !== null
    ? `WCI MoM ${wciMoM >= 0 ? "+" : ""}${wciMoM.toFixed(1)}%와 ${aligned ? "방향 정합" : "방향 비정합"}`
    : "WCI 데이터 없음";

  return {
    label: "글로벌 운임 모멘텀",
    state,
    basis: `SCFI MoM ${scfiMoM >= 0 ? "+" : ""}${scfiMoM.toFixed(1)}% — ${alignText}`,
    sources: ["SCFI", ...(wciMoM !== null ? ["WCI"] : [])],
    asOf,
    confidence: aligned ? "high" : "medium",
  };
}

// Air MoM ≥10% + ocean percentile ≥70 → modal shift 가능성 (추정 표현)
export function computeAirModalShiftSignal(
  airMoM: number | null,
  routeLabel: string,
  oceanPct: number | null,
  asOf: string | null,
): ComputedSignal | null {
  if (airMoM === null) return null;

  const highOcean = oceanPct !== null && oceanPct >= 70;
  let state: SignalState = "normal";
  if (Math.abs(airMoM) >= 10 && highOcean) state = "caution";
  else if (Math.abs(airMoM) >= 10) state = "observe";

  return {
    label: `항공 운임 변동 (${routeLabel})`,
    state,
    basis: `MoM ${airMoM >= 0 ? "+" : ""}${airMoM.toFixed(1)}%${highOcean ? " — 해상 압력 높음, 모달 전환 가능성 추정" : ""}`,
    sources: ["KITA 항공"],
    asOf,
    confidence: highOcean ? "medium" : "low",
  };
}

// VLSFO MoM ≥5% → 벙커 비용 영향 추정
export function computeBunkerSignal(
  vlsfoMoM: number | null,
  asOf: string | null,
): ComputedSignal | null {
  if (vlsfoMoM === null) return null;

  let state: SignalState = "normal";
  if (Math.abs(vlsfoMoM) >= 10) state = "caution";
  else if (Math.abs(vlsfoMoM) >= 5) state = "observe";

  return {
    label: "벙커 비용",
    state,
    basis: `VLSFO MoM ${vlsfoMoM >= 0 ? "+" : ""}${vlsfoMoM.toFixed(1)}% — 부대비용 영향 추정`,
    sources: ["VLSFO"],
    asOf,
    confidence: "medium",
  };
}
