import { describe, expect, it } from "vitest";

import {
  ASIA_COUNTRIES,
  NATIONAL_SERIES,
  buildAsiaTable,
  periodKey,
  recentPeriods,
  toCsv,
  trimEmptyLeading,
  type ThroughputRow,
} from "../asia-table";

const P = [
  { year: 2026, month: 6 },
  { year: 2026, month: 5 },
];

function row(p: Partial<ThroughputRow> & Pick<ThroughputRow, "country" | "port_code" | "year" | "month">): ThroughputRow {
  return { teu: 1000, is_preliminary: false, ...p };
}

describe("buildAsiaTable", () => {
  // ★ 이 테스트가 핵심이다. JP_MAJOR6(주요 6항)는 JP_ALL(전국)과 범위가 다르다.
  //    최신이라는 이유로 섞으면 한 열 안에 없는 계단이 생긴다.
  it("국가 대표 계열이 아닌 항만 행은 무시한다", () => {
    const rows = [
      row({ country: "JP", port_code: "JP_ALL", year: 2026, month: 5, teu: 111 }),
      row({ country: "JP", port_code: "JP_MAJOR6", year: 2026, month: 6, teu: 999 }),
      row({ country: "JP", port_code: "JPTYO", year: 2026, month: 6, teu: 888 }),
    ];
    const t = buildAsiaTable(rows, P);
    expect(t[0].cells.JP).toBeNull(); // 2026-06 은 JP_ALL 이 없으므로 비어야 한다
    expect(t[1].cells.JP).toEqual({ teu: 111, preliminary: false });
  });

  it("teu 가 null 인 행은 0으로 만들지 않고 버린다", () => {
    const t = buildAsiaTable([row({ country: "KR", port_code: "KR_ALL", year: 2026, month: 6, teu: null })], P);
    expect(t[0].cells.KR).toBeNull();
  });

  it("잠정치 표시를 그대로 옮긴다", () => {
    const t = buildAsiaTable(
      [row({ country: "HK", port_code: "HK_ALL", year: 2026, month: 6, teu: 1_061_000, is_preliminary: true })],
      P,
    );
    expect(t[0].cells.HK).toEqual({ teu: 1_061_000, preliminary: true });
  });

  it("수집기가 없는 나라도 열은 만든다 (없는 것이 보여야 한다)", () => {
    const t = buildAsiaTable([], P);
    expect(Object.keys(t[0].cells).sort()).toEqual(ASIA_COUNTRIES.map((c) => c.code).sort());
    expect(t[0].cells.VN).toBeNull();
  });

  it("국가 대표 계열 지도에 JP_MAJOR6 가 들어가 있지 않다", () => {
    expect(Object.values(NATIONAL_SERIES)).not.toContain("JP_MAJOR6");
    expect(NATIONAL_SERIES.JP).toBe("JP_ALL");
  });
});

describe("recentPeriods", () => {
  it("최신순으로 n개월, 연 경계를 넘는다", () => {
    expect(recentPeriods(new Date("2026-01-15T00:00:00Z"), 3).map((p) => periodKey(p.year, p.month))).toEqual([
      "2026-01",
      "2025-12",
      "2025-11",
    ]);
  });
});

describe("trimEmptyLeading", () => {
  it("맨 위의 빈 달을 걷어낸다", () => {
    const t = buildAsiaTable([row({ country: "KR", port_code: "KR_ALL", year: 2026, month: 5, teu: 7 })], P);
    expect(trimEmptyLeading(t).map((r) => r.period)).toEqual(["2026-05"]);
  });

  it("전부 비어 있으면 그대로 둔다", () => {
    const t = buildAsiaTable([], P);
    expect(trimEmptyLeading(t)).toHaveLength(2);
  });
});

describe("toCsv", () => {
  it("빈 칸은 0이 아니라 빈 문자열이다", () => {
    const t = buildAsiaTable([row({ country: "KR", port_code: "KR_ALL", year: 2026, month: 6, teu: 2_813_913 })], P);
    const csv = toCsv(t).split("\n");
    expect(csv[0]).toContain("period,KR_teu");
    expect(csv[1]).toContain("2026-06,2813913,,,,"); // JP·TW·HK·VN 은 빈칸
    expect(csv[1]).not.toContain(",0,");
  });
});
