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

/**
 * 국가 코드 → 국가 대표 port_code.
 *
 * ■ 일본은 主要6港(속보)을 쓴다 ★
 * 처음에는 범위를 맞추려고 JP_ALL(전국 확보)만 썼다. 그런데 확보 통계는 구조적으로
 * 8개월 지연이라(2026-08 시점 최신 2025-10) 일본 열이 통째로 비었고, 표가 3개국짜리가
 * 됐다. 기다려서 채워지는 게 아니라 늘 그만큼 늦는다.
 *
 * 범위가 다른 것은 섞어서 감추는 대신 열 이름에 적는다 —— "일본(주요 6항)".
 * 전국과 6항을 한 열에 잇지 않는다는 원칙은 그대로다. 계열을 바꾼 것이지 섞은 게 아니다.
 */
export const NATIONAL_SERIES: Record<string, string> = {
  KR: "KR_ALL",
  JP: "JP_MAJOR6",
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

/**
 * 표의 열 순서.
 * 베트남은 뺐다 —— 월별 물동량 시계열을 내는 공식 소스를 찾지 못했고, "확보 중"이라고만
 * 적힌 빈 열은 정보가 아니라 빈 자리다. 소스가 생기면 그때 넣는다.
 */
export const ASIA_COUNTRIES: AsiaCountry[] = [
  { code: "KR", label: "한국", source: "해양수산부 (공공데이터포털)" },
  {
    code: "JP",
    label: "일본(주요 6항)",
    source: "国土交通省 港湾統計速報",
    note: "전국 확보 통계는 8개월가량 지연돼 속보(주요 6항) 기준을 씁니다. 다른 나라는 전국·전 지역 합계입니다.",
  },
  { code: "TW", label: "대만", source: "臺灣港務公司 (TIPC)", note: "월별 통계가 2025-01부터만 제공됩니다." },
  { code: "HK", label: "홍콩", source: "Hong Kong Maritime and Port Board" },
];

export type ThroughputRow = {
  country: string | null;
  port_code: string;
  year: number;
  month: number;
  teu: number | null;
  is_preliminary: boolean | null;
  /** 출처가 전년비를 함께 주는 경우(HK). 없으면 우리가 계산한다. */
  yoy_pct?: number | null;
};

export type AsiaCell = {
  teu: number;
  preliminary: boolean;
  /** 전년 같은 달 대비 %. 계산할 12개월 전 값이 없으면 null. */
  yoyPct: number | null;
  /** true = 출처가 준 값, false = 본 표의 시계열로 계산한 값. */
  yoyFromSource: boolean;
} | null;

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
  // 1) 국가 대표 계열만 남긴다. 값이 없는 행은 버린다(0으로 만들지 않는다).
  const teuByKey = new Map<string, ThroughputRow>();
  for (const r of rows) {
    if (!r.country) continue;
    if (NATIONAL_SERIES[r.country] !== r.port_code) continue;
    if (r.teu == null || !Number.isFinite(r.teu)) continue;
    teuByKey.set(`${r.country}_${periodKey(r.year, r.month)}`, r);
  }

  // 2) 전년비. 출처가 준 값이 있으면 그걸 쓰고, 없으면 같은 계열의 12개월 전 값으로 계산한다.
  //    두 방식을 섞으므로 어느 쪽인지 셀에 남긴다 —— 화면이 각주로 밝힌다.
  const cellOf = (country: string, year: number, month: number): AsiaCell => {
    const row = teuByKey.get(`${country}_${periodKey(year, month)}`);
    if (!row || row.teu == null) return null;

    if (row.yoy_pct != null && Number.isFinite(row.yoy_pct)) {
      return { teu: row.teu, preliminary: Boolean(row.is_preliminary), yoyPct: row.yoy_pct, yoyFromSource: true };
    }
    const prev = teuByKey.get(`${country}_${periodKey(year - 1, month)}`);
    const yoyPct =
      prev?.teu != null && prev.teu > 0 ? ((row.teu - prev.teu) / prev.teu) * 100 : null;
    return { teu: row.teu, preliminary: Boolean(row.is_preliminary), yoyPct, yoyFromSource: false };
  };

  return periods.map(({ year, month }) => {
    const period = periodKey(year, month);
    const cells: Record<string, AsiaCell> = {};
    for (const c of ASIA_COUNTRIES) cells[c.code] = cellOf(c.code, year, month);
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
  const header = [
    "period",
    ...ASIA_COUNTRIES.map((c) => `${c.code}_teu`),
    ...ASIA_COUNTRIES.map((c) => `${c.code}_yoy_pct`),
    ...ASIA_COUNTRIES.map((c) => `${c.code}_preliminary`),
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const teu = ASIA_COUNTRIES.map((c) => (r.cells[c.code] ? String(r.cells[c.code]!.teu) : ""));
    const yoy = ASIA_COUNTRIES.map((c) => {
      const v = r.cells[c.code]?.yoyPct;
      return v == null ? "" : v.toFixed(1);
    });
    const prelim = ASIA_COUNTRIES.map((c) => (r.cells[c.code] ? String(r.cells[c.code]!.preliminary) : ""));
    lines.push([r.period, ...teu, ...yoy, ...prelim].join(","));
  }
  return lines.join("\n");
}
