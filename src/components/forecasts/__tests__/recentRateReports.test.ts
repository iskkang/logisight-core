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
    metric_ref: "WCI",
    created_at: "2026-06-01T00:00:00Z",
    published_at: null,
    resolved_at: null,
    ...p,
  } as Forecast;
}

describe("recentRateReports", () => {
  it("splits statement into lead (first sentence) and outlook (rest)", () => {
    const [r] = recentRateReports([
      mk({ id: "a", metric_ref: "WCI", statement: "첫 문장이다. 둘째 문장이다. 셋째 문장이다." }),
    ]);
    expect(r.lead).toBe("첫 문장이다.");
    expect(r.outlook).toBe("둘째 문장이다. 셋째 문장이다.");
  });

  it("includes only WCI/SCFI/KCCI composite indices, with clean titles", () => {
    const reports = recentRateReports([
      mk({ id: "wci", metric_ref: "WCI", statement: "WCI 종합. 근거." }),
      mk({ id: "scfi", metric_ref: "SCFI", statement: "SCFI 종합. 근거." }),
      mk({ id: "kcci", metric_ref: "KCCI", statement: "KCCI 종합. 근거." }),
      mk({ id: "lane", metric_ref: "WCI_SHA_RTM", statement: "상하이발 WCI. 근거." }),
      mk({ id: "kita", metric_ref: "kita_sea_rates:부산-뉴욕", statement: "부산발 뉴욕. 근거." }),
    ]);
    expect(reports.map((r) => r.id).sort()).toEqual(["kcci", "scfi", "wci"]);
    expect(reports.map((r) => r.title).sort()).toEqual(["KCCI", "SCFI", "WCI"]);
    expect(reports.some((r) => r.title.includes("[저장 전망]"))).toBe(false);
  });

  it("excludes records whose lead AND outlook are both empty", () => {
    const reports = recentRateReports([
      mk({ id: "empty", metric_ref: "WCI", statement: "" }),
      mk({ id: "ok", metric_ref: "SCFI", statement: "내용 있음." }),
    ]);
    expect(reports.map((r) => r.id)).toEqual(["ok"]);
  });

  it("keeps a single-sentence record (outlook empty, lead present)", () => {
    const [r] = recentRateReports([
      mk({ id: "solo", metric_ref: "KCCI", statement: "한 문장뿐이다." }),
    ]);
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

  it("caps at 3, newest published first, ignores non-composite and non-rates", () => {
    const reports = recentRateReports([
      mk({
        id: "wci",
        metric_ref: "WCI",
        published_at: "2026-06-09T00:00:00Z",
        statement: "A. B.",
      }),
      mk({
        id: "scfi",
        metric_ref: "SCFI",
        published_at: "2026-06-08T00:00:00Z",
        statement: "A. B.",
      }),
      mk({
        id: "kcci",
        metric_ref: "KCCI",
        published_at: "2026-06-07T00:00:00Z",
        statement: "A. B.",
      }),
      mk({
        id: "lane",
        metric_ref: "WCI_SHA_RTM",
        published_at: "2026-06-10T00:00:00Z",
        statement: "A. B.",
      }),
      mk({ id: "other", module: "trade", metric_ref: "WCI", statement: "A. B." }),
    ]);
    expect(reports).toHaveLength(3);
    expect(reports.map((r) => r.id)).toEqual(["wci", "scfi", "kcci"]);
  });
});
