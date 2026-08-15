/**
 * 동아시아 컨테이너 물동량 표 — 순수 조립 로직. PHASE 2 EA-5.
 *
 * ■ 국가마다 「국가 대표 시계열」을 하나만 쓴다 ★
 * port_throughput 에는 항만별 행이 섞여 있다(JP 는 14개 항만 + 두 종류의 합계).
 * 나라별로 범위가 같은 계열 하나를 골라 쓴다 —— 안 그러면 열끼리 비교가 안 된다.
 *
 *   JP_ALL     전국 (港湾調査 확보)      ← 이걸 쓴다
 *   JP_MAJOR6  주요 6항 (속보)          ← 범위가 다르다. 최신이라고 섞으면 안 된다
 *
 * JP_MAJOR6 가 더 최근(2026-05)이고 JP_ALL 은 확보라 늦다(2025-10). 그래도 섞지 않는다.
 * 한 열 안에서 「전국」과 「6항」이 이어지면 그 사이에 없는 계단이 생긴다.
 * 늦은 건 늦다고 보여준다 —— 빈 칸은 "데이터 확보 중"이다.
 *
 * ■ 합계 열을 만들지 않는다
 * 5개국 중 하나라도 비면 합계가 그 달만 작아진다. 부분 합계를 총계처럼 보여주지 않는다.
 */

/** 국가 코드 → 국가 대표 port_code. 여기 없는 나라는 아직 수집기가 없다. */
export const NATIONAL_SERIES: Record<string, string> = {
  KR: "KR_ALL",
  JP: "JP_ALL",
  TW: "TW_ALL",
  HK: "HK_ALL",
};

export type AsiaCountry = {
  code: string;
  label: string;
  /** 출처 표기 — 대만 OGDL 은 미이행 시 이용 권리가 소급 무효라 비울 수 없다. */
  source: string;
  note?: string;
};

/** 표의 열 순서. 수집기가 없는 나라(VN)도 세운다 —— 없는 것이 보여야 한다. */
export const ASIA_COUNTRIES: AsiaCountry[] = [
  { code: "KR", label: "한국", source: "해양수산부 (공공데이터포털)" },
  { code: "JP", label: "일본", source: "国土交通省 港湾調査 (e-Stat)", note: "확보 기준이라 공표가 늦다" },
  { code: "TW", label: "대만", source: "臺灣港務公司 (TIPC)", note: "월별 통계가 2025-01부터만 제공된다" },
  { code: "HK", label: "홍콩", source: "Hong Kong Maritime and Port Board" },
  { code: "VN", label: "베트남", source: "—", note: "소스 확보 중" },
];

export type ThroughputRow = {
  country: string | null;
  port_code: string;
  year: number;
  month: number;
  teu: number | null;
  is_preliminary: boolean | null;
};

export type AsiaCell = { teu: number; preliminary: boolean } | null;

export type AsiaRow = {
  /** "2026-06" */
  period: string;
  year: number;
  month: number;
  /** 국가코드 → 값. 없으면 null(= 화면에서 "데이터 확보 중"). */
  cells: Record<string, AsiaCell>;
};

/** 최근 n개월의 연월을 최신순으로. */
export function recentPeriods(now: Date, months: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * 행 목록 → 표. 국가 대표 계열이 아닌 행은 전부 무시한다.
 * 값이 null 인 행도 무시한다 —— 결측을 0으로 만들지 않는다.
 */
export function buildAsiaTable(rows: ThroughputRow[], periods: { year: number; month: number }[]): AsiaRow[] {
  const byKey = new Map<string, AsiaCell>();
  for (const r of rows) {
    if (!r.country) continue;
    if (NATIONAL_SERIES[r.country] !== r.port_code) continue;
    if (r.teu == null || !Number.isFinite(r.teu)) continue;
    byKey.set(`${r.country}_${periodKey(r.year, r.month)}`, {
      teu: r.teu,
      preliminary: Boolean(r.is_preliminary),
    });
  }

  return periods.map(({ year, month }) => {
    const period = periodKey(year, month);
    const cells: Record<string, AsiaCell> = {};
    for (const c of ASIA_COUNTRIES) cells[c.code] = byKey.get(`${c.code}_${period}`) ?? null;
    return { period, year, month, cells };
  });
}

/** 표에 값이 하나라도 있는 달만 남긴다(맨 위가 전부 빈 줄로 시작하지 않게). */
export function trimEmptyLeading(rows: AsiaRow[]): AsiaRow[] {
  const firstWithData = rows.findIndex((r) => Object.values(r.cells).some((c) => c !== null));
  return firstWithData <= 0 ? rows : rows.slice(firstWithData);
}

/** CSV. 빈 칸은 빈 문자열로 둔다 —— 0 으로 채우지 않는다. */
export function toCsv(rows: AsiaRow[]): string {
  const header = ["period", ...ASIA_COUNTRIES.map((c) => `${c.code}_teu`), ...ASIA_COUNTRIES.map((c) => `${c.code}_preliminary`)];
  const lines = [header.join(",")];
  for (const r of rows) {
    const teu = ASIA_COUNTRIES.map((c) => (r.cells[c.code] ? String(r.cells[c.code]!.teu) : ""));
    const prelim = ASIA_COUNTRIES.map((c) => (r.cells[c.code] ? String(r.cells[c.code]!.preliminary) : ""));
    lines.push([r.period, ...teu, ...prelim].join(","));
  }
  return lines.join("\n");
}
