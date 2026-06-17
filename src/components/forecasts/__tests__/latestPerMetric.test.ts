import { describe, it, expect } from "vitest";

import type { Forecast } from "@/lib/api/forecasts";
import { latestPerMetric } from "../forecastUtils";

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

describe("latestPerMetric", () => {
  it("keeps only the newest published forecast per metric_ref", () => {
    const out = latestPerMetric([
      mk({ id: "wci-old", metric_ref: "WCI", published_at: "2026-06-06T00:00:00Z" }),
      mk({ id: "wci-mid", metric_ref: "WCI", published_at: "2026-06-13T00:00:00Z" }),
      mk({ id: "wci-new", metric_ref: "WCI", published_at: "2026-06-17T00:00:00Z" }),
      mk({ id: "kcci", metric_ref: "KCCI", published_at: "2026-06-17T00:00:00Z" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((f) => f.metric_ref === "WCI")?.id).toBe("wci-new");
    expect(out.find((f) => f.metric_ref === "KCCI")?.id).toBe("kcci");
  });

  it("falls back to created_at when published_at is null", () => {
    const out = latestPerMetric([
      mk({ id: "a", metric_ref: "SCFI", published_at: null, created_at: "2026-06-01T00:00:00Z" }),
      mk({ id: "b", metric_ref: "SCFI", published_at: null, created_at: "2026-06-10T00:00:00Z" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("treats rows with no metric_ref as distinct (keyed by id)", () => {
    const out = latestPerMetric([
      mk({ id: "a", metric_ref: null }),
      mk({ id: "b", metric_ref: null }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(latestPerMetric([])).toEqual([]);
  });
});
