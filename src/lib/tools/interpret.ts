/**
 * 숫자 앞에 해석 한 문장. PHASE 3-3.
 *
 * ■ 무엇을 하고 무엇을 안 하나 ★
 * 하는 것: "지금 값이 최근 이력 안에서 어디쯤인가"를 말한다. 그건 계산으로 나온다.
 * 안 하는 것: 왜 그런지 말하지 않는다. "홍해 사태로 급등" 같은 인과 단정은 방법론
 *            원칙 위반이고, 우리가 가진 데이터로는 확인할 수 없는 주장이다.
 *
 * 백분위는 "지금 값보다 낮았던 관측의 비율"이다. 상위 9% 구간이라는 말은
 * 최근 이력의 91%가 지금보다 낮았다는 뜻이지, 앞으로 오른다는 뜻이 아니다.
 *
 * 표본이 적으면 백분위가 의미를 잃는다 —— MIN_SAMPLES 미만이면 아무 말도 하지 않는다.
 * "모르는 것은 말하지 않는다"가 "그럴듯한 문장을 만든다"보다 낫다.
 */

/** 이만큼은 있어야 백분위를 말한다. 12주 = 계절성 한 바퀴의 최소치. */
export const MIN_SAMPLES = 12;

export type Band = "top10" | "top25" | "middle" | "bottom25";

export type Interpretation = {
  /** 0~100. 지금 값보다 낮았던 관측의 비율. */
  percentile: number;
  band: Band;
  /** 화면에 그대로 쓸 한 문장. */
  sentence: string;
  sampleSize: number;
};

/** 구간별 문구. 방향을 단정하지 않고 위치만 말한다. */
const BAND_PHRASE: Record<Band, (pctFromTop: number) => string> = {
  top10: (p) => `최근 이력 중 상위 ${p}% 구간입니다`,
  top25: (p) => `최근 이력 중 상위 ${p}% 구간입니다`,
  middle: () => `최근 이력의 중간 구간입니다`,
  bottom25: (p) => `최근 이력 중 하위 ${100 - p}% 구간입니다`,
};

function bandOf(percentile: number): Band {
  if (percentile >= 90) return "top10";
  if (percentile >= 75) return "top25";
  if (percentile > 25) return "middle";
  return "bottom25";
}

/**
 * @param current 지금 값
 * @param history 비교할 이력(지금 값 포함 여부는 무관 — 아래에서 같이 센다)
 * @param label   "부산→북미 해상운임" 처럼 주어. 비우면 문장이 값부터 시작한다.
 */
export function interpretPercentile(
  current: number | null | undefined,
  history: (number | null | undefined)[],
  label?: string,
): Interpretation | null {
  if (current == null || !Number.isFinite(current)) return null;

  const clean = history.filter((v): v is number => v != null && Number.isFinite(v));
  if (clean.length < MIN_SAMPLES) return null;

  const below = clean.filter((v) => v < current).length;
  const percentile = Math.round((below / clean.length) * 100);
  const band = bandOf(percentile);
  // 상위 몇 %인지는 100에서 뺀 값이다. 상위 0%는 말이 안 되므로 최소 1로 둔다.
  const fromTop = Math.max(1, 100 - percentile);

  const subject = label ? `${label}은 지금 ` : "지금 ";
  return {
    percentile,
    band,
    sentence: `${subject}${BAND_PHRASE[band](fromTop)}.`,
    sampleSize: clean.length,
  };
}
