import { describe, it, expect } from "vitest";
import { buildClimateForecastQuality } from "@/lib/climate-quality";
import { HDAYS, type AssetRow, type RiskRow, type ClimateRiskData } from "@/lib/api/climate";

const NOW = Date.UTC(2026, 5, 30, 0, 0, 0);
const RECENT = new Date(NOW - 3600_000).toISOString();

function asset(id: string, type: AssetRow["type"]): AssetRow {
  return { id, name: id, type, lon: 0, lat: 0, freeze_prone: false };
}
function riskRowsFor(id: string): RiskRow[] {
  return HDAYS.map((h) => ({
    asset_id: id, horizon_days: h, score: 0, level: "g", driver: null,
    wind_gust: 1, wave_height: null, precip: 1, snowfall: null, temp_min: 1,
    is_freeze: false, updated_at: RECENT,
  }));
}
function data(assets: AssetRow[], risk: RiskRow[]): ClimateRiskData {
  return { assets, risk, routes: [], events: [], forecasts: [] };
}

describe("buildClimateForecastQuality inland guard", () => {
  it("risk 행 없는 inland 자산은 expectedRows에서 제외", () => {
    const assets = [asset("p1", "port"), asset("p2", "port"), asset("chi", "inland")];
    const risk = [...riskRowsFor("p1"), ...riskRowsFor("p2")]; // inland 없음
    const q = buildClimateForecastQuality(data(assets, risk), NOW);
    expect(q.horizons[0].expectedRows).toBe(2);
  });

  it("risk 행 있는 inland 자산은 expectedRows에 포함", () => {
    const assets = [asset("p1", "port"), asset("chi", "inland")];
    const risk = [...riskRowsFor("p1"), ...riskRowsFor("chi")];
    const q = buildClimateForecastQuality(data(assets, risk), NOW);
    expect(q.horizons[0].expectedRows).toBe(2);
  });
});
