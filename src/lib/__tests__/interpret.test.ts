import { describe, expect, it } from "vitest";

import { MIN_SAMPLES, interpretPercentile } from "../tools/interpret";

/** 1..n 의 오름차순 이력. */
const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("interpretPercentile", () => {
  it("표본이 모자라면 아무 말도 하지 않는다", () => {
    expect(interpretPercentile(10, seq(MIN_SAMPLES - 1))).toBeNull();
    expect(interpretPercentile(10, seq(MIN_SAMPLES))).not.toBeNull();
  });

  it("값이 없으면 문장을 만들지 않는다", () => {
    expect(interpretPercentile(null, seq(50))).toBeNull();
    expect(interpretPercentile(undefined, seq(50))).toBeNull();
    expect(interpretPercentile(Number.NaN, seq(50))).toBeNull();
  });

  it("이력의 결측은 0으로 세지 않고 빼고 센다", () => {
    const r = interpretPercentile(10, [...seq(12), null, undefined, Number.NaN]);
    expect(r?.sampleSize).toBe(12); // 결측 3개는 표본에 안 들어간다
  });

  it("최고값이면 상위 구간이다", () => {
    const r = interpretPercentile(100, seq(100));
    expect(r?.band).toBe("top10");
    expect(r?.sentence).toContain("상위");
  });

  it("최저값이면 하위 구간이다", () => {
    const r = interpretPercentile(0, seq(100));
    expect(r?.percentile).toBe(0);
    expect(r?.band).toBe("bottom25");
    expect(r?.sentence).toContain("하위");
  });

  it("가운데면 중간 구간이라고만 말한다", () => {
    const r = interpretPercentile(50, seq(100));
    expect(r?.band).toBe("middle");
    expect(r?.sentence).toBe("지금 최근 이력의 중간 구간입니다.");
  });

  it("주어를 붙이면 문장 앞에 온다", () => {
    const r = interpretPercentile(100, seq(100), "부산→북미 해상운임");
    expect(r?.sentence.startsWith("부산→북미 해상운임은 지금 ")).toBe(true);
  });

  it("상위 0% 라는 말은 만들지 않는다", () => {
    const r = interpretPercentile(999, seq(100));
    expect(r?.percentile).toBe(100);
    expect(r?.sentence).toContain("상위 1%");
    expect(r?.sentence).not.toContain("상위 0%");
  });

  // ★ 방법론 원칙 —— 위치만 말하고 원인이나 방향을 단정하지 않는다.
  it("인과·전망 표현을 쓰지 않는다", () => {
    const forbidden = ["때문", "영향", "급등", "급락", "전망", "예상", "상승세", "하락세"];
    for (const v of [0, 30, 50, 80, 100]) {
      const s = interpretPercentile(v, seq(100), "운임")!.sentence;
      for (const w of forbidden) expect(s).not.toContain(w);
    }
  });
});
