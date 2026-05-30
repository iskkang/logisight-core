// src/lib/api/__tests__/news.date.test.ts
import { describe, it, expect } from "vitest";
import { todayKST, dateToKSTRange } from "../news";

describe("todayKST", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const result = todayKST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dateToKSTRange", () => {
  it("returns dateFrom as T00:00:00+09:00", () => {
    const { dateFrom } = dateToKSTRange("2026-05-31");
    expect(dateFrom).toBe("2026-05-31T00:00:00+09:00");
  });

  it("returns dateTo as T23:59:59.999+09:00", () => {
    const { dateTo } = dateToKSTRange("2026-05-31");
    expect(dateTo).toBe("2026-05-31T23:59:59.999+09:00");
  });

  it("works for a different date", () => {
    const { dateFrom, dateTo } = dateToKSTRange("2026-01-01");
    expect(dateFrom).toBe("2026-01-01T00:00:00+09:00");
    expect(dateTo).toBe("2026-01-01T23:59:59.999+09:00");
  });
});
