import { HDAYS, HLBL, type ClimateRiskData, type RiskRow } from "@/lib/api/climate";

export type ForecastQualityStatus = "ok" | "warn" | "blocked";

export type HorizonForecastQuality = {
  hIdx: number;
  horizonDays: number;
  label: string;
  status: ForecastQualityStatus;
  rows: number;
  expectedRows: number;
  missingRows: number;
  updatedAt: string | null;
  updatedAtMs: number | null;
  ageHours: number | null;
  issues: string[];
  coverage: {
    wind: number;
    precip: number;
    temp: number;
    maritimeRows: number;
    wave: number;
  };
};

export type ClimateForecastQuality = {
  status: ForecastQualityStatus;
  latestUpdatedAt: string | null;
  latestUpdatedAtMs: number | null;
  latestAgeHours: number | null;
  horizons: HorizonForecastQuality[];
};

const STALE_WARN_HOURS = 30;
const STALE_BLOCK_HOURS = 54;

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusRank(status: ForecastQualityStatus): number {
  return status === "blocked" ? 2 : status === "warn" ? 1 : 0;
}

function maxStatus(a: ForecastQualityStatus, b: ForecastQualityStatus): ForecastQualityStatus {
  return statusRank(a) >= statusRank(b) ? a : b;
}

function pushIssue(issues: string[], issue: string) {
  if (!issues.includes(issue)) issues.push(issue);
}

function latestRiskUpdatedAt(rows: RiskRow[]): { updatedAt: string | null; updatedAtMs: number | null } {
  let best: { updatedAt: string | null; updatedAtMs: number | null } = { updatedAt: null, updatedAtMs: null };
  for (const row of rows) {
    const updatedAtMs = parseDateMs(row.updated_at);
    if (updatedAtMs != null && (best.updatedAtMs == null || updatedAtMs > best.updatedAtMs)) {
      best = { updatedAt: row.updated_at, updatedAtMs };
    }
  }
  return best;
}

export function buildClimateForecastQuality(data: ClimateRiskData, nowMs = Date.now()): ClimateForecastQuality {
  const maritimeIds = new Set(data.assets.filter((a) => a.type === "port" || a.type === "choke").map((a) => a.id));
  const expectedRows = data.assets.length;
  const riskByHorizon = new Map<number, RiskRow[]>();
  for (const row of data.risk) {
    const list = riskByHorizon.get(row.horizon_days) ?? [];
    list.push(row);
    riskByHorizon.set(row.horizon_days, list);
  }

  const horizons = HDAYS.map((horizonDays, hIdx): HorizonForecastQuality => {
    const rows = riskByHorizon.get(horizonDays) ?? [];
    const { updatedAt, updatedAtMs } = latestRiskUpdatedAt(rows);
    const ageHours = updatedAtMs == null ? null : Math.max(0, (nowMs - updatedAtMs) / 3_600_000);
    const maritimeRows = rows.filter((row) => maritimeIds.has(row.asset_id)).length;
    const coverage = {
      wind: rows.filter((row) => row.wind_gust != null).length,
      precip: rows.filter((row) => row.precip != null).length,
      temp: rows.filter((row) => row.temp_min != null).length,
      maritimeRows,
      wave: rows.filter((row) => maritimeIds.has(row.asset_id) && row.wave_height != null).length,
    };
    const issues: string[] = [];
    let status: ForecastQualityStatus = "ok";

    if (rows.length === 0) {
      status = "blocked";
      pushIssue(issues, `${HLBL[hIdx]} asset_risk 예보 행 없음`);
    } else if (expectedRows > 0 && rows.length < expectedRows) {
      status = maxStatus(status, "warn");
      pushIssue(issues, `${HLBL[hIdx]} 자산 예보 ${rows.length}/${expectedRows}개만 수신`);
    }

    if (updatedAtMs == null) {
      status = maxStatus(status, "warn");
      pushIssue(issues, `${HLBL[hIdx]} 예보 갱신 시각 없음`);
    } else if (ageHours != null && ageHours > STALE_BLOCK_HOURS) {
      status = maxStatus(status, "blocked");
      pushIssue(issues, `${HLBL[hIdx]} 예보 갱신 ${Math.round(ageHours)}시간 전`);
    } else if (ageHours != null && ageHours > STALE_WARN_HOURS) {
      status = maxStatus(status, "warn");
      pushIssue(issues, `${HLBL[hIdx]} 예보 갱신 ${Math.round(ageHours)}시간 전`);
    }

    if (rows.length > 0 && (coverage.wind < rows.length || coverage.precip < rows.length || coverage.temp < rows.length)) {
      status = maxStatus(status, "warn");
      pushIssue(issues, `${HLBL[hIdx]} 핵심 기상 변수 일부 누락`);
    }

    if (maritimeRows > 0) {
      const requiredWave = horizonDays <= 7 ? Math.ceil(maritimeRows * 0.65) : 1;
      if (coverage.wave < requiredWave) {
        status = maxStatus(status, "warn");
        pushIssue(
          issues,
          coverage.wave === 0
            ? `${HLBL[hIdx]} 해상 파고 예보 없음`
            : `${HLBL[hIdx]} 해상 파고 ${coverage.wave}/${maritimeRows}개만 수신`,
        );
      }
    }

    return {
      hIdx,
      horizonDays,
      label: HLBL[hIdx],
      status,
      rows: rows.length,
      expectedRows,
      missingRows: Math.max(0, expectedRows - rows.length),
      updatedAt,
      updatedAtMs,
      ageHours,
      issues,
      coverage,
    };
  });

  const latest = latestRiskUpdatedAt(data.risk);
  const latestAgeHours = latest.updatedAtMs == null ? null : Math.max(0, (nowMs - latest.updatedAtMs) / 3_600_000);
  return {
    status: horizons.reduce<ForecastQualityStatus>((acc, h) => maxStatus(acc, h.status), "ok"),
    latestUpdatedAt: latest.updatedAt,
    latestUpdatedAtMs: latest.updatedAtMs,
    latestAgeHours,
    horizons,
  };
}

export function forecastQualityLabel(status: ForecastQualityStatus): string {
  if (status === "blocked") return "예보 불충분";
  if (status === "warn") return "부분 예보";
  return "예보 정상";
}

export function forecastQualityTone(status: ForecastQualityStatus): { dot: string; text: string; border: string; bg: string } {
  if (status === "blocked") return { dot: "bg-[#ef4444]", text: "text-[#b42318]", border: "border-[#fbd5d5]", bg: "bg-[#fef2f2]" };
  if (status === "warn") return { dot: "bg-[#f59e0b]", text: "text-[#b45309]", border: "border-[#fde6c8]", bg: "bg-[#fff7ed]" };
  return { dot: "bg-[#22c55e]", text: "text-[#067647]", border: "border-[#c7ead6]", bg: "bg-[#ecfdf3]" };
}

export function formatForecastAge(ageHours: number | null): string {
  if (ageHours == null) return "갱신 시각 없음";
  if (ageHours < 1) return "1시간 이내 갱신";
  if (ageHours < 24) return `${Math.round(ageHours)}시간 전 갱신`;
  return `${Math.round(ageHours / 24)}일 전 갱신`;
}
