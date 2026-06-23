import { describe, it, expect } from "vitest";
import { toTickerItems, aggregatePortCongestion, pickAirMoM } from "@/lib/home-view-model";
import type { IndexStats, KitaAirRateRow } from "@/lib/api/rates";

const stat = (code: string, value: number | null, chg: number | null): IndexStats => ({
  index_code: code, latest_value: value, latest_date: "2026-06-15", change_pct: chg,
  mom_pct: null, yoy_pct: null, pct_52w: null, normal_range: null, source: null,
});

describe("toTickerItems", () => {
  it("orders by ticker order, formats value, sets direction + delta", () => {
    const out = toTickerItems([stat("WCI", 3549, -3), stat("SCFI", 3121.69, 4.57)]);
    expect(out.map((o) => o.sym)).toEqual(["SCFI", "WCI"]);
    expect(out[0]).toMatchObject({ value: "3,121.69", dir: "up", delta: "▲ +4.57%" });
    expect(out[1]).toMatchObject({ dir: "down", delta: "▼ -3.00%" });
  });
  it("drops null-value indices and renders flat with em dash", () => {
    const out = toTickerItems([stat("BDI", 2809, 0), stat("CCFI", null, 1)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sym: "BDI", dir: "flat", delta: "— 0.00%" });
  });
});

describe("aggregatePortCongestion", () => {
  it("averages congestion and returns top 2 port names", () => {
    const out = aggregatePortCongestion({ ports: [
      { name: "Shanghai", congestion: 80 }, { name: "Busan", congestion: 40 }, { name: "LA", congestion: 60 },
    ] });
    expect(out.value).toBe(60);
    expect(out.topPorts).toEqual(["Shanghai", "LA"]);
  });
  it("returns null value when no congestion data", () => {
    expect(aggregatePortCongestion({ ports: [{ name: "X", congestion: null }] })).toEqual({ value: null, topPorts: [] });
    expect(aggregatePortCongestion(null)).toEqual({ value: null, topPorts: [] });
  });
});

describe("pickAirMoM", () => {
  const row = (dest: string, ym: string, kg300: number | null): KitaAirRateRow => ({
    origin: "ICN", dest, region: null, year_mon: ym, kg100: null, kg300, kg500: null, chg100: null, chg300: null, chg500: null,
  });
  it("picks route with largest |MoM| within ±200% and labels it", () => {
    const out = pickAirMoM([
      row("FRA", "202604", 100), row("FRA", "202605", 110), // +10%
      row("JFK", "202604", 100), row("JFK", "202605", 150), // +50%
    ]);
    expect(out.mom).toBeCloseTo(50, 5);
    expect(out.routeLabel).toBe("인천→JFK");
    expect(out.yearMon).toBe("202605");
  });
  it("returns null MoM and fallback label when no usable series", () => {
    expect(pickAirMoM([row("FRA", "202605", 100)])).toEqual({ mom: null, routeLabel: "인천발", yearMon: null });
  });
});
