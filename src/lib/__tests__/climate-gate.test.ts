import { describe, it, expect } from "vitest";
import { gateEvent } from "@/lib/climate-gate";
import type { AssetRow, EventRow, RouteRow } from "@/lib/api/climate";

const asset = (id: string, lon: number, lat: number, type: AssetRow["type"] = "inland"): AssetRow =>
  ({ id, name: id, type, lon, lat, freeze_prone: false });
const ev = (over: Partial<EventRow>): EventRow => ({
  id: "e1", source: "nws", kind: "flood", title: "Flood Warning", severity: "r",
  lon: 0, lat: 0, area: null, url: null, starts_at: null, ends_at: null, updated_at: null, track: null, ...over,
});

describe("gateEvent", () => {
  it("자산 위 severity r → LINKED_HIGH (NWS 소스도 통과)", () => {
    const v = gateEvent(ev({ lon: 0, lat: 0, source: "nws", severity: "r" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LINKED_HIGH");
    expect(v.linkedAssets).toHaveLength(1);
    expect(v.linkedAssets[0].id).toBe("chi");
  });

  it("~111km(위도 1°) severity r → LINKED_HIGH (반경 내)", () => {
    const v = gateEvent(ev({ lon: 0, lat: 1, severity: "r" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LINKED_HIGH");
  });

  it("~222km(위도 2°) severity r, 단일 자산 → LIMITED, nearestKm > 200", () => {
    const v = gateEvent(ev({ lon: 0, lat: 2, severity: "r" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LIMITED");
    expect(v.nearestKm).toBeGreaterThan(200);
    expect(v.nearestAsset?.id).toBe("chi");
  });

  it("반경 내 severity a → LINKED_WATCH", () => {
    const v = gateEvent(ev({ lon: 0, lat: 0, severity: "a" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LINKED_WATCH");
  });

  it("반경 내지만 severity 없음 → LIMITED", () => {
    const v = gateEvent(ev({ lon: 0, lat: 0, severity: "" }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LIMITED");
  });

  it("좌표 없는 이벤트 → LIMITED, nearestAsset null", () => {
    const v = gateEvent(ev({ lon: null, lat: null }), [asset("chi", 0, 0)], [], {});
    expect(v.tier).toBe("LIMITED");
    expect(v.nearestAsset).toBeNull();
  });

  it("점 자산은 멀고 노선 waypoint 근접 → LINKED_HIGH (노선 경유)", () => {
    const routes: RouteRow[] = [{ id: "r1", name: "R1", waypoints: [[0, 0]], chokes: [] }];
    const v = gateEvent(ev({ lon: 0, lat: 0, severity: "r" }), [asset("far", 100, 80)], routes, {});
    expect(v.tier).toBe("LINKED_HIGH");
    expect(v.linkedRouteIds).toEqual(["r1"]);
    expect(v.linkedAssets).toHaveLength(0);
  });
});
