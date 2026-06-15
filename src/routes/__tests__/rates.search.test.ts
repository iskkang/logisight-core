import { describe, it, expect } from "vitest";
import {
  inMonthRange,
  monthBounds,
  regionsOf,
  portsOf,
  routeSeries,
  regionPortsLatest,
  topPorts,
} from "../rates.search";

type Row = { origin: string; dest: string; region: string | null; year_mon: string; feu: number | null };
const mk = (p: Partial<Row>): Row =>
  ({ origin: "부산", dest: "롱비치", region: "북미", year_mon: "202606", feu: 100, ...p });

describe("inMonthRange", () => {
  it("filters inclusive by YYYYMM and tolerates reversed bounds", () => {
    const rows = [mk({ year_mon: "202604" }), mk({ year_mon: "202606" }), mk({ year_mon: "202601" })];
    expect(inMonthRange(rows, "202606", "202604").map((r) => r.year_mon).sort()).toEqual(["202604", "202606"]);
  });
});

describe("monthBounds", () => {
  it("returns min/max YYYYMM or null", () => {
    expect(monthBounds([mk({ year_mon: "202601" }), mk({ year_mon: "202606" })])).toEqual({ min: "202601", max: "202606" });
    expect(monthBounds([])).toBeNull();
  });
});

describe("regionsOf / portsOf", () => {
  it("lists distinct regions and ports within a region, sorted", () => {
    const rows = [
      mk({ region: "북미", dest: "롱비치" }),
      mk({ region: "북미", dest: "서배너" }),
      mk({ region: "유럽", dest: "함부르크" }),
    ];
    expect(regionsOf(rows)).toEqual(["북미", "유럽"]);
    expect(portsOf(rows, "북미")).toEqual(["롱비치", "서배너"]);
  });
});

describe("routeSeries", () => {
  it("returns sorted non-null monthly values for one dest", () => {
    const rows = [
      mk({ dest: "롱비치", year_mon: "202606", feu: 4950 }),
      mk({ dest: "롱비치", year_mon: "202605", feu: 2900 }),
      mk({ dest: "롱비치", year_mon: "202604", feu: null }),
      mk({ dest: "서배너", year_mon: "202606", feu: 5000 }),
    ];
    expect(routeSeries(rows, "롱비치", (r) => r.feu)).toEqual([
      { ym: "202605", value: 2900 },
      { ym: "202606", value: 4950 },
    ]);
  });
});

describe("regionPortsLatest", () => {
  it("gives one row per port (latest month) with MoM, sorted by value desc", () => {
    const rows = [
      mk({ dest: "롱비치", year_mon: "202605", feu: 2900 }),
      mk({ dest: "롱비치", year_mon: "202606", feu: 4950 }),
      mk({ dest: "서배너", year_mon: "202606", feu: 5100 }),
    ];
    const out = regionPortsLatest(rows, "북미", (r) => r.feu);
    expect(out[0]).toEqual({ dest: "서배너", ym: "202606", value: 5100, mom: null });
    expect(out[1].dest).toBe("롱비치");
    expect(Math.round(out[1].mom!)).toBe(71);
  });
});

describe("topPorts", () => {
  it("returns up to N dest names with non-null value", () => {
    const latest = [
      { dest: "a", ym: "202606", value: 5, mom: null },
      { dest: "b", ym: "202606", value: null, mom: null },
      { dest: "c", ym: "202606", value: 3, mom: null },
    ];
    expect(topPorts(latest, 1)).toEqual(["a"]);
    expect(topPorts(latest, 5)).toEqual(["a", "c"]);
  });
});
