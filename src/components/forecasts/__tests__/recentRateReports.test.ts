import { describe, it, expect } from "vitest";

import type { Forecast } from "@/lib/api/forecasts";
import { recentRateReports } from "../forecastUtils";

function mk(p: Partial<Forecast>): Forecast {
  return {
    id: "x",
    module: "rates",
    statement: "",
    basis: null,
    impact_note: null,
    horizon_date: null,
    confidence: null,
    invalidation_condition: null,
    status: "published",
    outcome: null,
    outcome_note: null,
    metric_ref: null,
    created_at: "2026-06-01T00:00:00Z",
    published_at: null,
    resolved_at: null,
    ...p,
  } as Forecast;
}

describe("recentRateReports", () => {
  it("splits statement into lead (first sentence) and outlook (rest)", () => {
    const [r] = recentRateReports([
      mk({ id: "a", statement: "첫 문장이다. 둘째 문장이다. 셋째 문장이다." }),
    ]);
    expect(r.lead).toBe("첫 문장이다.");
    expect(r.outlook).toBe("둘째 문장이다. 셋째 문장이다.");
  });

  it("titles WCI composite and WCI lane distinctly (fixes duplicate-title bug)", () => {
    const reports = recentRateReports([
      mk({ id: "wci", metric_ref: "WCI", statement: "WCI 종합 지수 상승. 근거." }),
      mk({ id: "lane", metric_ref: "WCI_SHA_RTM", statement: "상하이발 WCI. 근거." }),
    ]);
    const titles = reports.map((r) => r.title);
    expect(new Set(titles).size).toBe(2); // 서로 다른 제목
    expect(titles).toContain("WCI");
    expect(titles).not.toContain("[저장 전망]"); // 내부 라벨 제거
  });

  it("excludes records whose lead AND outlook are both empty", () => {
    const reports = recentRateReports([
      mk({ id: "empty", statement: "" }),
      mk({ id: "ok", statement: "내용 있음." }),
    ]);
    expect(reports.map((r) => r.id)).toEqual(["ok"]);
  });

  it("keeps a single-sentence record (outlook empty, lead present)", () => {
    const [r] = recentRateReports([mk({ id: "solo", statement: "한 문장뿐이다." })]);
    expect(r.lead).toBe("한 문장뿐이다.");
    expect(r.outlook).toBe("");
  });

  it("dedupes same (metric_ref, published_at)", () => {
    const reports = recentRateReports([
      mk({ id: "1", metric_ref: "SCFI", published_at: "2026-06-06T00:00:00Z", statement: "A. B." }),
      mk({ id: "2", metric_ref: "SCFI", published_at: "2026-06-06T00:00:00Z", statement: "C. D." }),
    ]);
    expect(reports).toHaveLength(1);
  });

  it("dedupes repeated id", () => {
    const reports = recentRateReports([
      mk({ id: "dup", metric_ref: "KCCI", statement: "A. B." }),
      mk({ id: "dup", metric_ref: "KCCI", statement: "A. B." }),
    ]);
    expect(reports).toHaveLength(1);
  });

  it("caps at 5, newest published first, ignores non-rates", () => {
    const reports = recentRateReports([
      mk({
        id: "old",
        metric_ref: "WCI",
        published_at: "2026-06-01T00:00:00Z",
        statement: "A. B.",
      }),
      mk({
        id: "n1",
        metric_ref: "SCFI",
        published_at: "2026-06-09T00:00:00Z",
        statement: "A. B.",
      }),
      mk({
        id: "n2",
        metric_ref: "KCCI",
        published_at: "2026-06-08T00:00:00Z",
        statement: "A. B.",
      }),
      mk({
        id: "n3",
        metric_ref: "CCFI",
        published_at: "2026-06-07T00:00:00Z",
        statement: "A. B.",
      }),
      mk({ id: "n4", metric_ref: "FBX", published_at: "2026-06-06T00:00:00Z", statement: "A. B." }),
      mk({ id: "n5", metric_ref: "BDI", published_at: "2026-06-05T00:00:00Z", statement: "A. B." }),
      mk({ id: "other", module: "trade", statement: "A. B." }),
    ]);
    expect(reports).toHaveLength(5);
    expect(reports[0].id).toBe("n1"); // 최신
    expect(reports.map((r) => r.id)).not.toContain("other");
  });
});
