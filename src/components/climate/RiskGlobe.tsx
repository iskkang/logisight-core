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
  events: ClimateRiskData["events"]; landGeo: GeoJSON.MultiPolygon;
  hIdx: number; sel: Sel; spinOn: boolean; reduce: boolean;
};

export function RiskGlobe({ data }: { data: ClimateRiskData }) {
  const [hIdx, setHIdx] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [spinOn, setSpinOn] = useState(true);

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
  liveRef.current = { nodes, assetList, routes, riskMap, events, landGeo, hIdx, sel, spinOn, reduce: prefersReduced() };

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

    const render = () => {
      const L = liveRef.current;
      const projection = sc.projection!, path = sc.path!;
      projection.scale(sc.R).translate([sc.cx, sc.cy]).rotate(sc.rot);
      ctx.clearRect(0, 0, sc.W, sc.H);
      const rotInv: [number, number] = [-sc.rot[0], -sc.rot[1]];
      const visible = (lon: number, lat: number) => geoDistance([lon, lat], rotInv) < Math.PI / 2 - 0.012;

      // ocean sphere
      const grd = ctx.createRadialGradient(sc.cx - sc.R * 0.35, sc.cy - sc.R * 0.4, sc.R * 0.2, sc.cx, sc.cy, sc.R * 1.15);
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
      for (const e of L.events) {
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

    const hitTest = (clientX: number, clientY: number) => {
      const b = cv.getBoundingClientRect();
      const px = (clientX - b.left) * (sc.W / b.width), py = (clientY - b.top) * (sc.H / b.height);
      for (const s of sc.eventHit) if (Math.hypot(px - s.x, py - s.y) <= s.r) return setSel({ kind: "event", id: s.id });
      let ba: string | null = null, bd = 11;
      for (const a of sc.assetHit) { const dd = Math.hypot(px - a.x, py - a.y); if (dd < bd) { bd = dd; ba = a.key; } }
      if (ba) return setSel({ kind: "asset", id: ba });
      let br: string | null = null, brd = 9;
      for (const Rt of sc.routeHit) for (const pt of Rt.pts) { const dd = Math.hypot(px - pt[0], py - pt[1]); if (dd < brd) { brd = dd; br = Rt.id; } }
      setSel(br ? { kind: "route", id: br } : null);
    };

    let sx = 0, sy = 0, srot: [number, number] = [0, 0];
    const onDown = (e: PointerEvent) => { sc.down = true; sx = e.clientX; sy = e.clientY; srot = [sc.rot[0], sc.rot[1]]; cv.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!sc.down) return;
      const k = 0.27 * (220 / sc.R);
      sc.rot = [srot[0] + (e.clientX - sx) * k, Math.max(-89, Math.min(89, srot[1] - (e.clientY - sy) * k))];
      render();
    };
    const onUp = (e: PointerEvent) => { sc.down = false; if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) hitTest(e.clientX, e.clientY); };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);

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
      sc.render = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 갱신: data·horizon·선택 변경 시 재렌더만 (재초기화 금지).
  useEffect(() => {
    sceneRef.current.render?.();
  }, [data, hIdx, sel, spinOn, landGeo]);

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

  return (
    <div className="risk-globe">
      <div className="rg-controls">
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
          <div className="rg-hint">드래그하여 회전 · 클릭하여 선택</div>
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
