import type { AssetRow, EventRow, RouteRow } from "@/lib/api/climate";

// 게이트 반경 정본 — 파이프라인(logisight 레포)도 이 값을 그대로 구현해야 한다.
export const ASSET_RADIUS_KM = 200;
export const ROUTE_RADIUS_KM = 1000;

export type GateTier = "LINKED_HIGH" | "LINKED_WATCH" | "LIMITED";
export type LinkedAsset = { id: string; name: string; type: AssetRow["type"]; km: number };
export type GateVerdict = {
  tier: GateTier;
  nearestAsset: LinkedAsset | null;
  nearestKm: number | null;
  linkedAssets: LinkedAsset[];
  linkedRouteIds: string[];
};

const EARTH_KM = 6371;
function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const t = Math.PI / 180;
  const dla = (lat2 - lat1) * t, dlo = (lon2 - lon1) * t;
  const x = Math.sin(dla / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dlo / 2) ** 2;
  return 2 * EARTH_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// routes.waypoints: 문자열(asset id) 또는 [lon,lat]. 문자열은 nodes로 해소.
function routeCoords(r: RouteRow, nodes: Record<string, AssetRow>): [number, number][] {
  return (r.waypoints || [])
    .map((w): [number, number] | null =>
      typeof w === "string" ? (nodes[w] ? [nodes[w].lon, nodes[w].lat] : null) : (w as [number, number]))
    .filter((c): c is [number, number] => !!c);
}

// 이벤트가 물류 자산/노선과 연관 있는지 결정론으로 판정. severityTier()는 NWS를 INFO로 떨구므로 쓰지 않고
// 이벤트 원본 severity('r'/'a')를 직접 사용한다.
export function gateEvent(
  event: EventRow,
  assets: AssetRow[],
  routes: RouteRow[],
  nodes: Record<string, AssetRow>,
): GateVerdict {
  if (event.lon == null || event.lat == null) {
    return { tier: "LIMITED", nearestAsset: null, nearestKm: null, linkedAssets: [], linkedRouteIds: [] };
  }
  const elon = event.lon, elat = event.lat;
  const linkedAssets: LinkedAsset[] = [];
  let nearest: LinkedAsset | null = null;
  for (const a of assets) {
    const km = Math.round(hav(elat, elon, a.lat, a.lon));
    const la: LinkedAsset = { id: a.id, name: a.name, type: a.type, km };
    if (nearest == null || km < nearest.km) nearest = la;
    if (km <= ASSET_RADIUS_KM) linkedAssets.push(la);
  }
  linkedAssets.sort((x, y) => x.km - y.km);
  const linkedRouteIds: string[] = [];
  for (const r of routes) {
    let min = Infinity;
    for (const c of routeCoords(r, nodes)) { const d = hav(elat, elon, c[1], c[0]); if (d < min) min = d; }
    if (min <= ROUTE_RADIUS_KM) linkedRouteIds.push(r.id);
  }
  const linked = linkedAssets.length > 0 || linkedRouteIds.length > 0;
  const sev = event.severity;
  const tier: GateTier = !linked ? "LIMITED" : sev === "r" ? "LINKED_HIGH" : sev === "a" ? "LINKED_WATCH" : "LIMITED";
  return { tier, nearestAsset: nearest, nearestKm: nearest ? nearest.km : null, linkedAssets, linkedRouteIds };
}
