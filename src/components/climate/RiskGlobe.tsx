import { useEffect, useMemo, useRef, useState } from "react";
import {
  geoArea,
  geoDistance,
  geoGraticule10,
  geoInterpolate,
  geoOrthographic,
  geoPath,
} from "d3-geo";

import landRings from "@/data/ne_110m_land.json";
import {
  HCONF,
  HDAYS,
  HLBL,
  type AssetType,
  type ClimateRiskData,
  type RiskRow,
  type RouteWaypoint,
} from "@/lib/api/climate";
import "./RiskGlobe.css";

// ---- derived globe structures (globe-data.js 매핑) ----
type GNode = { key: string; name: string; lon: number; lat: number; type: AssetType; freeze_prone: boolean };
type GRoute = { id: string; name: string; wp: RouteWaypoint[]; keys: string[]; chokes: string[] };
type RiskMap = Record<string, Record<number, RiskRow>>;
type Sel = { kind: "asset" | "route" | "event"; id: string } | null;
type TrackPhase = "past" | "current" | "forecast";
type TrackPoint = {
  lon: number;
  lat: number;
  validAtMs: number | null;
  forecastHour: number | null;
  intensity: string | null;
  phase: TrackPhase | null;
};
type EventTrack = {
  points: TrackPoint[];
  hasValidTimes: boolean;
  hasForecastHours: boolean;
};
type TrackHorizonPosition = {
  point: TrackPoint;
  outOfRange: boolean;
  label: string | null;
};

const MONO = '600 10px "JetBrains Mono", ui-monospace, monospace';
const KIND_LABEL: Record<string, string> = { cyclone: "태풍", storm: "폭풍", flood: "홍수", snow: "폭설", other: "경보" };
const TYPE_KO: Record<AssetType, string> = { port: "항만", choke: "초크포인트", rail: "철도" };
const TYPE_BADGE: Record<AssetType, string> = { port: "항만", choke: "관문", rail: "철도" };

const level = (r: number) => (r >= 60 ? "r" : r >= 30 ? "a" : "g");
const levelKo = (c: string) => (c === "r" ? "경보" : c === "a" ? "주의" : "정상");
const rc = (c: string) => (c === "r" ? "#EF4444" : c === "a" ? "#F59E0B" : "#22C55E");
const hexrgb = (h: string) =>
  `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ZOOM_MIN = 0.6, ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
const HOUR_MS = 60 * 60 * 1000;
const HKO_FORECAST_LIMIT_HOURS = 120;
const TRACK_LIMIT_LABEL = "\uc608\ubcf4 \ubc94\uc704 \ucd08\uacfc(+5\uc77c\uae4c\uc9c0)";
const TRACK_MISSING_LABEL = "\uc608\ubcf4 \ud2b8\ub799 \uc5c6\uc74c";
const TRACK_PANEL_LABEL = "\ud2b8\ub799";
const TRACK_POSITION_LABEL = "\uc704\uce58";

function riskScore(rm: RiskMap, key: string, h: number): number {
  return rm[key]?.[HDAYS[h]]?.score ?? 0;
}
function assetDriver(rm: RiskMap, key: string, h: number): string {
  const row = rm[key]?.[HDAYS[h]];
  return row && row.score >= 30 ? row.driver || "정상" : "정상";
}
function routeRisk(rm: RiskMap, R: GRoute, h: number): number {
  let m = 0;
  for (const k of R.keys) {
    const s = rm[k]?.[HDAYS[h]]?.score ?? 0;
    if (s > m) m = s;
  }
  return m;
}
function firstAlert(rm: RiskMap, key: string): string {
  for (let i = 0; i < HDAYS.length; i++) if ((rm[key]?.[HDAYS[i]]?.score ?? 0) >= 60) return `경보 ${HLBL[i]}`;
  for (let i = 0; i < HDAYS.length; i++) if ((rm[key]?.[HDAYS[i]]?.score ?? 0) >= 30) return `주의 ${HLBL[i]}`;
  return "없음";
}

function finiteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function parseDateMs(v: unknown): number | null {
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 1_000_000_000_000) return v;
    if (v > 1_000_000_000) return v * 1000;
  }
  return null;
}
function parsePhase(v: unknown): TrackPhase | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase();
  return s === "past" || s === "current" || s === "forecast" ? s : null;
}
function rawTrackPoints(raw: unknown): unknown[] {
  if (typeof raw === "string") {
    try {
      return rawTrackPoints(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.points)) return obj.points;
    if (Array.isArray(obj.track)) return obj.track;
    if (Array.isArray(obj.features)) return obj.features;
    if (Array.isArray(obj.coordinates) && Array.isArray(obj.coordinates[0])) return obj.coordinates;
    const geometry = obj.geometry && typeof obj.geometry === "object" ? obj.geometry as Record<string, unknown> : null;
    if (geometry && Array.isArray(geometry.coordinates) && Array.isArray(geometry.coordinates[0])) return geometry.coordinates;
  }
  return [];
}
function readTrackPoint(raw: unknown): TrackPoint | null {
  let lon: number | null = null;
  let lat: number | null = null;
  let validAtMs: number | null = null;
  let forecastHour: number | null = null;
  let intensity: string | null = null;
  let phase: TrackPhase | null = null;

  if (Array.isArray(raw)) {
    lon = finiteNumber(raw[0]);
    lat = finiteNumber(raw[1]);
    for (let i = 2; i < raw.length; i++) {
      validAtMs ||= parseDateMs(raw[i]);
      phase ||= parsePhase(raw[i]);
      if (typeof raw[i] === "string" && !parsePhase(raw[i]) && parseDateMs(raw[i]) == null && !intensity) intensity = raw[i];
    }
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const geometry = obj.geometry && typeof obj.geometry === "object" ? obj.geometry as Record<string, unknown> : null;
    const geometryCoords = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : null;
    const coords = Array.isArray(obj.coordinates)
      ? obj.coordinates
      : Array.isArray(obj.coord)
        ? obj.coord
        : Array.isArray(obj.position)
          ? obj.position
          : geometryCoords;
    lon = finiteNumber(obj.lon ?? obj.lng ?? obj.longitude ?? coords?.[0]);
    lat = finiteNumber(obj.lat ?? obj.latitude ?? coords?.[1]);
    validAtMs = parseDateMs(obj.valid_at ?? obj.validAt ?? obj.time ?? obj.timestamp);
    forecastHour = finiteNumber(obj.forecast_hour ?? obj.forecastHour ?? obj.hour ?? obj.tau);
    intensity = typeof obj.intensity === "string" ? obj.intensity : typeof obj.grade === "string" ? obj.grade : null;
    phase = parsePhase(obj.phase);
  }

  if (lon == null || lat == null || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return { lon, lat, validAtMs, forecastHour, intensity, phase };
}
function normalizeEventTrack(raw: unknown): EventTrack | null {
  const points = rawTrackPoints(raw).map(readTrackPoint).filter((p): p is TrackPoint => !!p);
  if (points.length < 2) return null;

  const hasValidTimes = points.some((p) => p.validAtMs != null);
  if (hasValidTimes && points.every((p) => p.validAtMs != null)) points.sort((a, b) => a.validAtMs! - b.validAtMs!);

  if (!hasValidTimes && !points.some((p) => p.forecastHour != null)) {
    const denom = Math.max(1, points.length - 1);
    points.forEach((p, i) => {
      p.forecastHour = (i / denom) * HKO_FORECAST_LIMIT_HOURS;
      p.phase ||= i === 0 ? "current" : "forecast";
    });
  }

  return {
    points,
    hasValidTimes,
    hasForecastHours: points.some((p) => p.forecastHour != null),
  };
}
function phaseOfPoint(p: TrackPoint, nowMs: number, idx: number): TrackPhase {
  if (p.phase) return p.phase;
  if (p.validAtMs != null) {
    const diff = p.validAtMs - nowMs;
    if (Math.abs(diff) <= 3 * HOUR_MS) return "current";
    return diff < 0 ? "past" : "forecast";
  }
  if (p.forecastHour != null) return p.forecastHour <= 0.1 ? "current" : "forecast";
  return idx === 0 ? "current" : "forecast";
}
function closestBy<T>(items: T[], score: (item: T) => number): T {
  let best = items[0];
  let bestScore = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s < bestScore) {
      best = items[i];
      bestScore = s;
    }
  }
  return best;
}
function trackHorizonPosition(track: EventTrack, hIdx: number, nowMs: number): TrackHorizonPosition {
  const horizonHours = HDAYS[hIdx] * 24;
  const timed = track.points.filter((p) => p.validAtMs != null);
  if (timed.length > 0) {
    if (hIdx === 0) {
      return { point: track.points.find((p) => p.phase === "current") ?? closestBy(timed, (p) => Math.abs(p.validAtMs! - nowMs)), outOfRange: false, label: null };
    }
    const targetMs = nowMs + horizonHours * HOUR_MS;
    const last = timed.reduce((m, p) => (p.validAtMs! > m.validAtMs! ? p : m), timed[0]);
    if (targetMs > last.validAtMs! + 6 * HOUR_MS) return { point: last, outOfRange: true, label: TRACK_LIMIT_LABEL };
    return { point: closestBy(timed, (p) => Math.abs(p.validAtMs! - targetMs)), outOfRange: false, label: null };
  }

  const hourly = track.points.filter((p) => p.forecastHour != null);
  if (hourly.length > 0) {
    const last = hourly.reduce((m, p) => (p.forecastHour! > m.forecastHour! ? p : m), hourly[0]);
    if (horizonHours > last.forecastHour! + 0.1) return { point: last, outOfRange: true, label: TRACK_LIMIT_LABEL };
    return { point: closestBy(hourly, (p) => Math.abs(p.forecastHour! - horizonHours)), outOfRange: false, label: null };
  }

  return { point: track.points[0], outOfRange: false, label: null };
}
function formatLonLat(p: TrackPoint): string {
  const ns = p.lat >= 0 ? "N" : "S";
  const ew = p.lon >= 0 ? "E" : "W";
  return `${Math.abs(p.lat).toFixed(1)}${ns} / ${Math.abs(p.lon).toFixed(1)}${ew}`;
}

type Scene = {
  projection: ReturnType<typeof geoOrthographic> | null;
  path: ReturnType<typeof geoPath> | null;
  graticule: ReturnType<typeof geoGraticule10> | null;
  W: number; H: number; dpr: number; cx: number; cy: number; R: number;
  rot: [number, number]; down: boolean;
  assetHit: { key: string; x: number; y: number; r: number }[];
  routeHit: { id: string; pts: [number, number][] }[];
  eventHit: { id: string; x: number; y: number; r: number }[];
  render: (() => void) | null;
};
type Live = {
  nodes: Record<string, GNode>; assetList: GNode[]; routes: GRoute[]; riskMap: RiskMap;
  events: ClimateRiskData["events"]; eventTracks: Record<string, EventTrack | null>; landGeo: GeoJSON.MultiPolygon;
  hIdx: number; sel: Sel; spinOn: boolean; reduce: boolean; zoom: number;
};

export function RiskGlobe({ data }: { data: ClimateRiskData }) {
  const [hIdx, setHIdx] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [spinOn, setSpinOn] = useState(true);
  const [zoom, setZoom] = useState(1);

  const { nodes, assetList, routes, riskMap } = useMemo(() => {
    const nodes: Record<string, GNode> = {};
    const assetList = data.assets.map((a) => {
      nodes[a.id] = { key: a.id, name: a.name, lon: a.lon, lat: a.lat, type: a.type, freeze_prone: a.freeze_prone };
      return nodes[a.id];
    });
    const routes: GRoute[] = data.routes.map((r) => {
      const wp = r.waypoints || [];
      return { id: r.id, name: r.name, wp, keys: wp.filter((w): w is string => typeof w === "string"), chokes: r.chokes || [] };
    });
    const riskMap: RiskMap = {};
    for (const row of data.risk) (riskMap[row.asset_id] ||= {})[row.horizon_days] = row;
    return { nodes, assetList, routes, riskMap };
  }, [data]);

  const events = data.events;
  const eventTracks = useMemo(() => {
    const tracks: Record<string, EventTrack | null> = {};
    for (const e of events) tracks[e.id] = e.kind === "cyclone" ? normalizeEventTrack(e.track) : null;
    return tracks;
  }, [events]);

  // land 감기(winding) 보정 — 구면 면적 > 2π 이면 반전. (승인 비주얼과 동일)
  const landGeo = useMemo<GeoJSON.MultiPolygon>(() => {
    const rings = landRings as unknown as number[][][];
    return {
      type: "MultiPolygon",
      coordinates: rings.map((r) => {
        const poly = { type: "Polygon", coordinates: [r] } as GeoJSON.Polygon;
        return geoArea(poly) > 2 * Math.PI ? [r.slice().reverse()] : [r];
      }),
    };
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene>({
    projection: null, path: null, graticule: null,
    W: 0, H: 0, dpr: 1, cx: 0, cy: 0, R: 200, rot: [-60, -12], down: false,
    assetHit: [], routeHit: [], eventHit: [], render: null,
  });
  const liveRef = useRef<Live>(null as unknown as Live);
  liveRef.current = { nodes, assetList, routes, riskMap, events, eventTracks, landGeo, hIdx, sel, spinOn, zoom, reduce: prefersReduced() };

  // init: projection·path·드래그·오토스핀·최초 렌더 (1회). cleanup으로 해제.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const sc = sceneRef.current;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    sc.projection = geoOrthographic().clipAngle(90).precision(0.4);
    sc.path = geoPath(sc.projection, ctx);
    sc.graticule = geoGraticule10();
    sc.rot = [-60, -12];

    const label = (t: string, x: number, y: number) => {
      ctx.fillStyle = "rgba(234,242,251,.92)"; ctx.font = MONO; ctx.textAlign = "center"; ctx.fillText(t, x, y);
    };
    const badgeLabel = (t: string, x: number, y: number) => {
      ctx.save();
      ctx.font = MONO;
      ctx.textAlign = "center";
      const w = ctx.measureText(t).width + 12;
      const bx = Math.max(w / 2 + 4, Math.min(sc.W - w / 2 - 4, x));
      const by = Math.max(13, Math.min(sc.H - 13, y));
      ctx.fillStyle = "rgba(7,15,28,.78)";
      ctx.strokeStyle = "rgba(239,68,68,.52)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx - w / 2, by - 9, w, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(254,202,202,.94)";
      ctx.fillText(t, bx, by + 3);
      ctx.restore();
    };
    const drawArrow = (from: [number, number], to: [number, number], color: string, alpha = 0.9) => {
      const dx = to[0] - from[0], dy = to[1] - from[1];
      if (Math.hypot(dx, dy) < 5) return;
      ctx.save();
      ctx.translate(to[0], to[1]);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-7, -3.8);
      ctx.lineTo(-7, 3.8);
      ctx.closePath();
      ctx.fillStyle = `rgba(${hexrgb(color)},${alpha})`;
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      const L = liveRef.current;
      const projection = sc.projection!, path = sc.path!;
      const R = sc.R * L.zoom;
      projection.scale(R).translate([sc.cx, sc.cy]).rotate(sc.rot);
      ctx.clearRect(0, 0, sc.W, sc.H);
      const rotInv: [number, number] = [-sc.rot[0], -sc.rot[1]];
      const visible = (lon: number, lat: number) => geoDistance([lon, lat], rotInv) < Math.PI / 2 - 0.012;

      // ocean sphere
      const grd = ctx.createRadialGradient(sc.cx - R * 0.35, sc.cy - R * 0.4, R * 0.2, sc.cx, sc.cy, R * 1.15);
      grd.addColorStop(0, "#15375c"); grd.addColorStop(0.6, "#0e2440"); grd.addColorStop(1, "#081627");
      ctx.beginPath(); path({ type: "Sphere" } as never); ctx.fillStyle = grd; ctx.fill();
      // graticule
      ctx.beginPath(); path(sc.graticule as never); ctx.strokeStyle = "rgba(143,169,196,0.10)"; ctx.lineWidth = 0.6; ctx.stroke();
      // land
      ctx.beginPath(); path(L.landGeo as never); ctx.fillStyle = "#16324c"; ctx.fill(); ctx.strokeStyle = "rgba(143,169,196,0.30)"; ctx.lineWidth = 0.5; ctx.stroke();

      // routes
      const routeHit: Scene["routeHit"] = [];
      for (const Rt of L.routes) {
        const coords = Rt.wp.map((w) => (typeof w === "string" ? [L.nodes[w].lon, L.nodes[w].lat] : w));
        const col = rc(level(routeRisk(L.riskMap, Rt, L.hIdx)));
        const seld = L.sel?.kind === "route" && L.sel.id === Rt.id;
        ctx.beginPath(); path({ type: "LineString", coordinates: coords } as never);
        ctx.strokeStyle = col; ctx.lineWidth = seld ? 3 : 1.7; ctx.lineCap = "round";
        ctx.shadowColor = seld ? col : "transparent"; ctx.shadowBlur = seld ? 12 : 0;
        ctx.stroke(); ctx.shadowBlur = 0;
        const hp: [number, number][] = [];
        for (let i = 0; i < coords.length - 1; i++) {
          const it = geoInterpolate(coords[i] as [number, number], coords[i + 1] as [number, number]);
          for (let s = 0; s <= 5; s++) {
            const ll = it(s / 5);
            if (visible(ll[0], ll[1])) { const p = projection(ll); if (p) hp.push([p[0], p[1]]); }
          }
        }
        routeHit.push({ id: Rt.id, pts: hp });
      }
      // sphere rim
      ctx.beginPath(); path({ type: "Sphere" } as never); ctx.strokeStyle = "rgba(120,170,220,0.35)"; ctx.lineWidth = 1; ctx.stroke();

      // assets (port 원 · choke 다이아 · rail 사각 · freeze 링)
      const assetHit: Scene["assetHit"] = [];
      for (const n of L.assetList) {
        if (!visible(n.lon, n.lat)) continue;
        const p = projection([n.lon, n.lat]); if (!p) continue;
        const col = rc(level(riskScore(L.riskMap, n.key, L.hIdx)));
        const seld = L.sel?.kind === "asset" && L.sel.id === n.key;
        if (n.type === "choke") {
          const s = seld ? 8 : 6;
          ctx.beginPath(); ctx.moveTo(p[0], p[1] - s); ctx.lineTo(p[0] + s, p[1]); ctx.lineTo(p[0], p[1] + s); ctx.lineTo(p[0] - s, p[1]); ctx.closePath();
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = "rgba(7,15,28,.8)"; ctx.stroke();
          label(n.name, p[0], p[1] - 11);
        } else if (n.type === "rail") {
          const sq = seld ? 5 : 3.6;
          ctx.beginPath(); ctx.rect(p[0] - sq, p[1] - sq, 2 * sq, 2 * sq);
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(7,15,28,.7)"; ctx.stroke();
          if (seld) label(n.name, p[0], p[1] - 9);
        } else {
          ctx.beginPath(); ctx.arc(p[0], p[1], seld ? 5 : 3.4, 0, 7);
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(7,15,28,.7)"; ctx.stroke();
          if (n.freeze_prone) { ctx.beginPath(); ctx.arc(p[0], p[1], seld ? 7.5 : 5.5, 0, 7); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(186,230,253,0.8)"; ctx.stroke(); }
          if (seld) label(n.name, p[0], p[1] - 9);
        }
        assetHit.push({ key: n.key, x: p[0], y: p[1], r: n.type === "choke" ? 11 : 8 });
      }

      // events (글로벌 감지 이벤트 핀 — 합성 SPOTS 대체)
      const eventHit: Scene["eventHit"] = [];
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      const nowMs = Date.now();
      const drawCycloneTrack = (e: ClimateRiskData["events"][number], track: EventTrack) => {
        const col = e.severity === "r" ? "#EF4444" : "#F59E0B";
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 0; i < track.points.length - 1; i++) {
          const a = track.points[i], b = track.points[i + 1];
          const ph = phaseOfPoint(b, nowMs, i + 1);
          ctx.beginPath();
          path({ type: "LineString", coordinates: [[a.lon, a.lat], [b.lon, b.lat]] } as never);
          ctx.strokeStyle = ph === "past" ? `rgba(${hexrgb(col)},0.30)` : `rgba(${hexrgb(col)},0.78)`;
          ctx.lineWidth = ph === "past" ? 1.2 : 2.15;
          ctx.setLineDash(ph === "past" ? [4, 5] : []);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        const dotStep = track.points.length > 80 ? 12 : track.points.length > 30 ? 6 : 1;
        for (let i = 0; i < track.points.length; i++) {
          const pt = track.points[i];
          const ph = phaseOfPoint(pt, nowMs, i);
          const drawDot = i === 0 || i === track.points.length - 1 || ph === "current" || i % dotStep === 0;
          if (!drawDot || !visible(pt.lon, pt.lat)) continue;
          const p = projection([pt.lon, pt.lat]); if (!p) continue;
          ctx.beginPath();
          ctx.arc(p[0], p[1], ph === "current" ? 3.7 : 2.2, 0, 7);
          ctx.fillStyle = ph === "past" ? `rgba(${hexrgb(col)},0.28)` : `rgba(${hexrgb(col)},0.72)`;
          ctx.fill();
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = "rgba(7,15,28,.7)";
          ctx.stroke();
        }

        const arrows: { from: [number, number]; to: [number, number] }[] = [];
        for (let i = 0; i < track.points.length - 1; i++) {
          const a = track.points[i], b = track.points[i + 1];
          if (phaseOfPoint(b, nowMs, i + 1) !== "forecast" || !visible(a.lon, a.lat) || !visible(b.lon, b.lat)) continue;
          const p1 = projection([a.lon, a.lat]), p2 = projection([b.lon, b.lat]);
          if (p1 && p2) arrows.push({ from: [p1[0], p1[1]], to: [p2[0], p2[1]] });
        }
        const arrowStep = Math.max(1, Math.floor(arrows.length / 3));
        for (let i = arrowStep - 1, drawn = 0; i < arrows.length && drawn < 3; i += arrowStep, drawn++) {
          drawArrow(arrows[i].from, arrows[i].to, col, 0.88);
        }

        const horizon = trackHorizonPosition(track, L.hIdx, nowMs);
        const hp = horizon.point;
        if (visible(hp.lon, hp.lat)) {
          const p = projection([hp.lon, hp.lat]); if (p) {
            const base = horizon.outOfRange ? 8 : e.severity === "r" ? 11 : 8;
            const pulse = L.reduce || horizon.outOfRange ? 0.5 : 0.5 + 0.5 * Math.sin(now / 520 + hp.lon);
            ctx.beginPath();
            ctx.arc(p[0], p[1], base + pulse * (horizon.outOfRange ? 5 : 10), 0, 7);
            ctx.fillStyle = horizon.outOfRange ? `rgba(${hexrgb(col)},0.08)` : `rgba(${hexrgb(col)},0.12)`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p[0], p[1], base, 0, 7);
            ctx.fillStyle = horizon.outOfRange ? `rgba(${hexrgb(col)},0.28)` : `rgba(${hexrgb(col)},0.68)`;
            ctx.fill();
            ctx.lineWidth = horizon.outOfRange ? 1.2 : 1.8;
            ctx.strokeStyle = horizon.outOfRange ? `rgba(${hexrgb(col)},0.45)` : `rgba(${hexrgb(col)},0.98)`;
            ctx.stroke();
            if (horizon.label) badgeLabel(horizon.label, p[0], p[1] - base - 12);
            else label(KIND_LABEL[e.kind] || "ê²½ë³´", p[0], p[1] - base - 7);
            eventHit.push({ id: e.id, x: p[0], y: p[1], r: base + 10 });
          }
        } else if (horizon.label) {
          for (let i = track.points.length - 1; i >= 0; i--) {
            const pt = track.points[i];
            if (!visible(pt.lon, pt.lat)) continue;
            const p = projection([pt.lon, pt.lat]);
            if (!p) continue;
            badgeLabel(horizon.label, p[0], p[1] - 16);
            break;
          }
        }
        ctx.restore();
      };
      for (const e of L.events) {
        const track = L.eventTracks[e.id];
        if (e.kind === "cyclone") {
          if (track) {
            drawCycloneTrack(e, track);
            continue;
          }
          if (L.hIdx > 0) continue;
        }
        if (e.lon == null || e.lat == null || !visible(e.lon, e.lat)) continue;
        const p = projection([e.lon, e.lat]); if (!p) continue;
        const col = e.severity === "r" ? "#EF4444" : "#F59E0B";
        const base = e.severity === "r" ? 11 : 8;
        const pulse = L.reduce ? 0.6 : 0.5 + 0.5 * Math.sin(now / 520 + e.lon);
        ctx.beginPath(); ctx.arc(p[0], p[1], base + pulse * 10, 0, 7); ctx.fillStyle = `rgba(${hexrgb(col)},0.10)`; ctx.fill();
        ctx.beginPath(); ctx.arc(p[0], p[1], base, 0, 7); ctx.fillStyle = `rgba(${hexrgb(col)},0.55)`; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(${hexrgb(col)},0.95)`; ctx.stroke();
        label(KIND_LABEL[e.kind] || "경보", p[0], p[1] - base - 7);
        eventHit.push({ id: e.id, x: p[0], y: p[1], r: base + 8 });
      }

      sc.assetHit = assetHit; sc.routeHit = routeHit; sc.eventHit = eventHit;
    };
    sc.render = render;

    const resize = () => {
      const wrap = cv.parentElement; if (!wrap) return;
      const b = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(40, Math.round(b.width)), H = Math.max(40, Math.round(b.height));
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.W = W; sc.H = H; sc.dpr = dpr; sc.cx = W / 2; sc.cy = H / 2; sc.R = Math.min(W, H) * 0.44;
      render();
    };

    // 마커 클릭 → 선택 + 회전 정지(패널 확인용). 빈 곳 클릭 → 회전 토글(정지↔재개) + 선택 해제.
    const hitTest = (clientX: number, clientY: number) => {
      const b = cv.getBoundingClientRect();
      const px = (clientX - b.left) * (sc.W / b.width), py = (clientY - b.top) * (sc.H / b.height);
      for (const s of sc.eventHit) if (Math.hypot(px - s.x, py - s.y) <= s.r) { setSel({ kind: "event", id: s.id }); setSpinOn(false); return; }
      let ba: string | null = null, bd = 11;
      for (const a of sc.assetHit) { const dd = Math.hypot(px - a.x, py - a.y); if (dd < bd) { bd = dd; ba = a.key; } }
      if (ba) { setSel({ kind: "asset", id: ba }); setSpinOn(false); return; }
      let br: string | null = null, brd = 9;
      for (const Rt of sc.routeHit) for (const pt of Rt.pts) { const dd = Math.hypot(px - pt[0], py - pt[1]); if (dd < brd) { brd = dd; br = Rt.id; } }
      if (br) { setSel({ kind: "route", id: br }); setSpinOn(false); }
      else { setSel(null); setSpinOn((v) => !v); }
    };

    let sx = 0, sy = 0, srot: [number, number] = [0, 0];
    const onDown = (e: PointerEvent) => { sc.down = true; sx = e.clientX; sy = e.clientY; srot = [sc.rot[0], sc.rot[1]]; cv.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!sc.down) return;
      const k = 0.27 * (220 / (sc.R * liveRef.current.zoom));
      sc.rot = [srot[0] + (e.clientX - sx) * k, Math.max(-89, Math.min(89, srot[1] - (e.clientY - sy) * k))];
      render();
    };
    const onUp = (e: PointerEvent) => { sc.down = false; if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) hitTest(e.clientX, e.clientY); };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.12 : 0.89))); };
    cv.addEventListener("wheel", onWheel, { passive: false });

    let rzTimer: number | undefined;
    const onResize = () => { window.clearTimeout(rzTimer); rzTimer = window.setTimeout(resize, 120); };
    window.addEventListener("resize", onResize);

    const reduce = prefersReduced();
    if (reduce) setSpinOn(false);
    resize();

    let last = 0, raf = 0;
    const tick = (t: number) => {
      if (t - last > 40) { last = t; if (liveRef.current.spinOn && !sc.down) sc.rot = [sc.rot[0] + 0.16, sc.rot[1]]; render(); }
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(rzTimer);
      window.removeEventListener("resize", onResize);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("wheel", onWheel);
      sc.render = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 갱신: data·horizon·선택 변경 시 재렌더만 (재초기화 금지).
  useEffect(() => {
    sceneRef.current.render?.();
  }, [data, hIdx, sel, spinOn, zoom, landGeo]);

  // ---- panel/alerts (JSX) ----
  const counts = useMemo(() => {
    let r = 0, a = 0, g = 0;
    for (const n of assetList) { const c = level(riskScore(riskMap, n.key, hIdx)); if (c === "r") r++; else if (c === "a") a++; else g++; }
    return { r, a, g };
  }, [assetList, riskMap, hIdx]);

  const topAssets = useMemo(
    () => [...assetList].sort((x, y) => riskScore(riskMap, y.key, hIdx) - riskScore(riskMap, x.key, hIdx)).slice(0, 8),
    [assetList, riskMap, hIdx],
  );

  const alerts = useMemo(() => {
    const aa = assetList
      .filter((n) => level(riskScore(riskMap, n.key, hIdx)) !== "g")
      .map((n) => {
        const s = riskScore(riskMap, n.key, hIdx);
        return { sev: level(s), score: s, text: `${n.name} (${TYPE_KO[n.type]})`, sub: `${assetDriver(riskMap, n.key, hIdx)} · ${hIdx > 0 ? `${HLBL[hIdx]} ` : ""}리스크 ${s}` };
      });
    const ee = events.map((e) => ({ sev: e.severity === "r" ? "r" : "a", score: e.severity === "r" ? 95 : 55, text: e.title, sub: `${e.area || ""} · ${e.source.toUpperCase()}` }));
    return [...aa, ...ee].sort((x, y) => y.score - x.score).slice(0, 4);
  }, [assetList, riskMap, hIdx, events]);

  const selEvent = sel?.kind === "event" ? events.find((e) => e.id === sel.id) : undefined;
  const selRoute = sel?.kind === "route" ? routes.find((r) => r.id === sel.id) : undefined;
  const selNode = sel?.kind === "asset" ? nodes[sel.id] : undefined;
  const selEventTrack = selEvent ? eventTracks[selEvent.id] : null;
  const selTrackPosition = selEventTrack ? trackHorizonPosition(selEventTrack, hIdx, Date.now()) : null;
  const selTrackMissing = !!selEvent && selEvent.kind === "cyclone" && !selEventTrack;
  const selTrackLabel = selTrackPosition
    ? selTrackPosition.label || `${HLBL[hIdx]} ${TRACK_POSITION_LABEL} ${formatLonLat(selTrackPosition.point)}`
    : selTrackMissing ? TRACK_MISSING_LABEL : null;

  return (
    <div className="risk-globe">
      <div className="rg-controls">
        <button className="rg-spin" onClick={() => setZoom((z) => clampZoom(z / 1.3))} aria-label="축소" title="축소">－</button>
        <button className="rg-spin" onClick={() => setZoom((z) => clampZoom(z * 1.3))} aria-label="확대" title="확대">＋</button>
        <button className="rg-spin" data-on={spinOn} onClick={() => setSpinOn((v) => !v)}>↻ 회전</button>
        <div className="rg-horizon" role="group" aria-label="예보 시점">
          {HLBL.map((lbl, i) => (
            <button key={lbl} aria-pressed={hIdx === i} onClick={() => setHIdx(i)}>{lbl}</button>
          ))}
        </div>
      </div>

      <div className="rg-stage">
        <div className="rg-mapwrap">
          <canvas ref={canvasRef} className="rg-canvas" />
          <div className="rg-legend">
            <div className="rg-lrow">
              <span className="rg-sw" style={{ background: "var(--g)" }} />정상
              <span className="rg-sw" style={{ background: "var(--a)" }} />주의
              <span className="rg-sw" style={{ background: "var(--r)" }} />경보
            </div>
            <div className="rg-lrow">
              <span className="rg-sw" style={{ width: 8, height: 8 }} />항만&nbsp;
              <span className="rg-dia" />초크&nbsp;
              <span className="rg-sq" />철도&nbsp;
              <span className="rg-ring" />결빙
            </div>
          </div>
          <div className="rg-hint">드래그 회전 · 휠 확대/축소 · 클릭으로 선택·회전 토글</div>
        </div>

        <aside className="rg-panel">
          <div>
            <div className="rg-ptag">전 세계 자산 요약 · {HLBL[hIdx]}{hIdx > 0 ? " 예보" : ""}</div>
            <div className="rg-summary">
              <div className="rg-stat r"><div className="rg-n">{counts.r}</div><div className="rg-l">경보</div></div>
              <div className="rg-stat a"><div className="rg-n">{counts.a}</div><div className="rg-l">주의</div></div>
              <div className="rg-stat g"><div className="rg-n">{counts.g}</div><div className="rg-l">정상</div></div>
            </div>
          </div>

          <div>
            {selEvent ? (
              <>
                <div className="rg-ptag">감지된 이벤트 · {selEvent.source.toUpperCase()}</div>
                <div className="rg-detail">
                  {selTrackLabel && <div className="rg-drv"><span>{TRACK_PANEL_LABEL}</span> {selTrackLabel}</div>}
                  <div className="rg-dh"><div className="rg-dname">{selEvent.title}</div><span className={`rg-pill ${selEvent.severity === "r" ? "r" : "a"}`}>{selEvent.severity === "r" ? "경보" : "주의"}</span></div>
                  <div className="rg-drv"><span>유형</span> {KIND_LABEL[selEvent.kind] || selEvent.kind}</div>
                  <div className="rg-drv"><span>지역</span> {selEvent.area || "—"}</div>
                  {selEvent.url && <div className="rg-drv"><a className="rg-link" href={selEvent.url} target="_blank" rel="noopener noreferrer">출처 보기 ↗</a></div>}
                </div>
              </>
            ) : selRoute ? (
              (() => {
                const rr = routeRisk(riskMap, selRoute, hIdx), c = level(rr);
                const chk = selRoute.chokes.map((k) => nodes[k]?.name).filter(Boolean).join(" · ") || "—";
                return (
                  <>
                    <div className="rg-ptag">항로 · {HLBL[hIdx]}</div>
                    <div className="rg-detail">
                      <div className="rg-dh"><div className="rg-dname">{selRoute.name}</div><span className={`rg-pill ${c}`}>{levelKo(c)}</span></div>
                      <div className="rg-drv"><span>통과 초크포인트</span> {chk}</div>
                      <div className="rg-grid2">
                        <div className="rg-cell"><div className="rg-k">최대 리스크</div><div className="rg-v" style={{ color: rc(c) }}>{rr}</div></div>
                        <div className="rg-cell"><div className="rg-k">예보 신뢰도</div><div className="rg-v">{HCONF[hIdx]}<small>%</small></div></div>
                      </div>
                      <div className="rg-action"><div className="rg-k">권장</div><div className="rg-v">{c === "r" ? "고위험 구간 우회(예: 희망봉) 또는 통항 시점 조정 검토" : c === "a" ? "영향 구간 ETA 버퍼 반영, 모니터링 강화" : "정상 — 계획대로 운항"}</div></div>
                    </div>
                  </>
                );
              })()
            ) : selNode ? (
              (() => {
                const r = riskScore(riskMap, selNode.key, hIdx), c = level(r);
                const routeNames = routes.filter((R) => R.keys.includes(selNode.key)).map((R) => R.name).join(", ") || "—";
                return (
                  <>
                    <div className="rg-ptag">{TYPE_KO[selNode.type]} · {HLBL[hIdx]}</div>
                    <div className="rg-detail">
                      <div className="rg-dh"><div className="rg-dname">{selNode.name}</div><span className={`rg-pill ${c}`}>{levelKo(c)}</span></div>
                      <div className="rg-drv"><span>주요 기상 요인</span> {assetDriver(riskMap, selNode.key, hIdx)}</div>
                      <div className="rg-grid2">
                        <div className="rg-cell"><div className="rg-k">리스크 점수</div><div className="rg-v" style={{ color: rc(c) }}>{r}</div></div>
                        <div className="rg-cell"><div className="rg-k">최초 경보 도달</div><div className="rg-v" style={{ fontSize: 14 }}>{firstAlert(riskMap, selNode.key)}</div></div>
                        <div className="rg-cell" style={{ gridColumn: "1/3" }}><div className="rg-k">영향 항로</div><div className="rg-v" style={{ fontSize: 13, fontFamily: "inherit" }}>{routeNames}</div></div>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <div className="rg-ptag" style={{ marginBottom: 8 }}>리스크 상위 자산</div>
                <div className="rg-list">
                  {topAssets.map((n) => {
                    const r = riskScore(riskMap, n.key, hIdx), c = level(r);
                    return (
                      <button key={n.key} className="rg-row" onClick={() => setSel({ kind: "asset", id: n.key })}>
                        <span className="rg-ty">{TYPE_BADGE[n.type]}</span>
                        <span className="rg-nm">{n.name}<small>{assetDriver(riskMap, n.key, hIdx)}</small></span>
                        <span className={`rg-pill ${c}`}>{levelKo(c)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="rg-note">
            <div className="rg-qrow"><span className="rg-qdot" /><span className="rg-q">이 화면 보는 법</span></div>
            <div className="rg-a">전 세계 항만·초크포인트·내륙 철도 거점을 동시에 감시합니다. {HDAYS[hIdx]}일 후 기상장 기준으로 각 지점·항로의 리스크를 산출하고, 빨강(경보)·노랑(주의)을 사전에 띄웁니다. 활성 재해(NHC·GDACS·NWS)는 별도 핀으로 표시됩니다. 지구본을 돌려 보고, 시점 탭을 바꿔 확인하세요.</div>
          </div>
        </aside>
      </div>

      <footer className="rg-alerts">
        {alerts.length === 0 ? (
          <div className="rg-clear">현재 경보·주의 없음 — 전 세계 정상</div>
        ) : (
          alerts.map((al, i) => (
            <div key={i} className={`rg-alert${al.sev === "a" ? " warn" : ""}`}>
              <span className="rg-sev">{al.sev === "a" ? "주의" : "경보"}</span>
              <span className="rg-tx"><b>{al.text}</b> · {al.sub}</span>
            </div>
          ))
        )}
      </footer>
    </div>
  );
}
