export type SignalState = "normal" | "observe" | "caution" | "alert";

export type ComputedSignal = {
  label: string;
  state: SignalState;
  basis: string;
  sources: string[];
  asOf: string | null;
  confidence: "high" | "medium" | "low";
};

export type FreightIndexPoint = {
  week_date: string;
  value: number | null;
  change_pct: number | null;
};

type IndexPoint = { period: string; value: number | null };

// --- Exported statistical helpers ---

export function percentile52wSeries(series: FreightIndexPoint[], current: number): number {
  const values = series.filter((p) => p.value !== null).map((p) => p.value as number);
  if (values.length === 0) return 0;
  const below = values.filter((v) => v <= current).length;
  return Math.round((below / values.length) * 100);
}

export function normalRange52w(series: FreightIndexPoint[]): [number, number] | null {
  const values = series.filter((p) => p.value !== null).map((p) => p.value as number);
  if (values.length < 4) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const sigma = Math.sqrt(variance);
  return [Math.round(mean - sigma), Math.round(mean + sigma)];
}

// --- Internal helpers ---

function percentile52wValues(values: number[], current: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v <= current).length;
  return Math.round((below / values.length) * 100);
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
  kcciSeries: FreightIndexPoint[],
  asOf?: string | null,
): ComputedSignal | null {
  const valid = kcciSeries
    .filter((p): p is FreightIndexPoint & { value: number } => p.value !== null)
    .sort((a, b) => a.week_date.localeCompare(b.week_date));

  if (valid.length < 4) return null;

  const last3 = valid.slice(-3).map((p) => p.value);
  const prev3 = valid.slice(-6, -3).map((p) => p.value);
  if (last3.length < 3 || prev3.length < 3) return null;

  const avgLast = last3.reduce((s, v) => s + v, 0) / 3;
  const avgPrev = prev3.reduce((s, v) => s + v, 0) / 3;
  const wow = avgPrev === 0 ? 0 : ((avgLast - avgPrev) / avgPrev) * 100;

  const allValues = valid.map((p) => p.value);
  const pct = percentile52wValues(allValues, avgLast);

  let state: SignalState = "normal";
  if (pct >= 80 && wow > 0) state = "alert";
  else if (pct >= 70 && wow > 0) state = "caution";
  else if (pct >= 60) state = "observe";

  const resolvedAsOf = asOf ?? valid.at(-1)?.week_date ?? null;

  return {
    label: "해상 운임 압력",
    state,
    basis: `KCCI 3주 평균 ${Math.round(avgLast).toLocaleString()} — 52주 백분위 ${pct}%, WoW ${wow >= 0 ? "+" : ""}${wow.toFixed(1)}%`,
    sources: ["KCCI"],
    asOf: resolvedAsOf,
    confidence: valid.length >= 12 ? "high" : "medium",
  };
}

// SCFI MoM ±5% + WCI 방향 정합 여부 (인과 단정 금지 — 상관 표현만)
export function computeGlobalMomentumSignal(
  scfiSeries: FreightIndexPoint[],
  wciSeries: FreightIndexPoint[],
  asOf?: string | null,
): ComputedSignal | null {
  const scfiPoints = scfiSeries
    .filter((p) => p.value !== null)
    .sort((a, b) => a.week_date.localeCompare(b.week_date));
  const wciPoints = wciSeries
    .filter((p) => p.value !== null)
    .sort((a, b) => a.week_date.localeCompare(b.week_date));

  if (scfiPoints.length < 5) return null;

  const scfiMoM = momChange(scfiPoints.map((p) => ({ period: p.week_date, value: p.value })));
  if (scfiMoM === null) return null;

  const wciMoM =
    wciPoints.length >= 5
      ? momChange(wciPoints.map((p) => ({ period: p.week_date, value: p.value })))
      : null;

  const aligned = wciMoM !== null && Math.sign(scfiMoM) === Math.sign(wciMoM);
  const magnitude = Math.abs(scfiMoM);

  let state: SignalState = "normal";
  if (magnitude >= 10) state = aligned ? "alert" : "caution";
  else if (magnitude >= 5) state = aligned ? "caution" : "observe";

  const alignText =
    wciMoM !== null
      ? `WCI MoM ${wciMoM >= 0 ? "+" : ""}${wciMoM.toFixed(1)}%와 방향 ${aligned ? "정합" : "비정합"}`
      : "WCI 데이터 없음";

  return {
    label: "글로벌 운임 모멘텀",
    state,
    basis: `SCFI MoM ${scfiMoM >= 0 ? "+" : ""}${scfiMoM.toFixed(1)}% — ${alignText}`,
    sources: ["SCFI", ...(wciMoM !== null ? ["WCI"] : [])],
    asOf: asOf ?? scfiPoints.at(-1)?.week_date ?? null,
    confidence: aligned ? "high" : "medium",
  };
}

// Air MoM ≥10% + ocean percentile ≥70 → 모달 전환 가능성 (추정 표현)
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
