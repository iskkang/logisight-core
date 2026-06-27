// Index1520 라우트 지도 — transit-service(O-D 역 쌍) 기반. maplibre로 라인 렌더(폭=물동량, 색=YoY),
// 좌표는 index1520_locations 매칭. 좌표 없는 라우트는 표에만 표시(Missing coordinates). 출처: index1520.com.
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent, Popup as MapPopup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { index1520RoutesQueryOptions } from "@/lib/api/index1520-routes";
import type { RouteRow } from "@/lib/api/index1520-routes.functions";

type MetricKey = "teu" | "weight" | "qty" | "transit";
const METRICS: Record<MetricKey, { label: string; cur: keyof RouteRow; prev: keyof RouteRow; digits: number }> = {
  teu: { label: "TEU", cur: "currentTeu", prev: "previousTeu", digits: 0 },
  weight: { label: "Actual Weight (k t)", cur: "currentActualWeight", prev: "previousActualWeight", digits: 1 },
  qty: { label: "Shipping Qty", cur: "currentShippingQty", prev: "previousShippingQty", digits: 0 },
  transit: { label: "Transit Time (d)", cur: "currentTransitTime", prev: "previousTransitTime", digits: 1 },
};

const numOf = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const fmt = (v: number | null | undefined, d = 0) =>
  v == null || Number.isNaN(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v: number | null) => (v == null || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
const yoyOf = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

// 살짝 휜 라인(2차 베지어 샘플) — 직선보다 가독성↑, 좌표만 있으면 안전.
function arc(a: [number, number], b: [number, number]): [number, number][] {
  const steps = 24;
  const [ax, ay] = a;
  const [bx, by] = b;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / dist) * dist * 0.15;
  const cy = my + (dx / dist) * dist * 0.15;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = 1 - t;
    pts.push([k * k * ax + 2 * k * t * cx + t * t * bx, k * k * ay + 2 * k * t * cy + t * t * by]);
  }
  return pts;
}

function popupHtml(r: RouteRow): string {
  const yoy = yoyOf(r.currentTeu, r.previousTeu);
  return [
    `<div style="font-weight:700;margin-bottom:4px">${r.fromName} → ${r.toName}</div>`,
    `<div>Current TEU: <b>${fmt(r.currentTeu)}</b></div>`,
    `<div>Previous TEU: ${fmt(r.previousTeu)}</div>`,
    `<div>YoY: ${fmtPct(yoy)}</div>`,
    `<div>Transit: ${r.currentTransitTime == null ? "—" : `${r.currentTransitTime.toFixed(1)}d`}</div>`,
  ].join("");
}

export function Index1520RoutesMap() {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [metric, setMetric] = useState<MetricKey>("teu");
  const [depSearch, setDepSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coordMsg, setCoordMsg] = useState<string | null>(null);

  const { data, isFetching } = useQuery({ ...index1520RoutesQueryOptions(period), placeholderData: keepPreviousData });

  const m = METRICS[metric];
  const filtered = useMemo(() => {
    const rows = data?.routes ?? [];
    const dq = depSearch.trim().toLowerCase();
    const tq = destSearch.trim().toLowerCase();
    return rows
      .filter((r) => (!dq || r.fromName.toLowerCase().includes(dq)) && (!tq || r.toName.toLowerCase().includes(tq)))
      .sort((a, b) => numOf(b[m.cur]) - numOf(a[m.cur]));
  }, [data, depSearch, destSearch, m.cur]);

  const summary = useMemo(() => {
    let totalTeu = 0;
    let prevTeu = 0;
    let transitSum = 0;
    let transitN = 0;
    let mapped = 0;
    for (const r of filtered) {
      totalTeu += r.currentTeu;
      prevTeu += r.previousTeu;
      if (r.currentTransitTime != null) {
        transitSum += r.currentTransitTime;
        transitN += 1;
      }
      if (r.hasCoords) mapped += 1;
    }
    return {
      totalTeu,
      prevTeu,
      yoy: yoyOf(totalTeu, prevTeu),
      avgTransit: transitN ? transitSum / transitN : null,
      count: filtered.length,
      mapped,
      missing: filtered.length - mapped,
    };
  }, [filtered]);

  const fc = useMemo(() => {
    const drawable = filtered.filter((r) => r.hasCoords && r.from && r.to);
    const maxCur = Math.max(0, ...drawable.map((r) => numOf(r[m.cur])));
    return {
      type: "FeatureCollection" as const,
      features: drawable.map((r) => {
        const cur = numOf(r[m.cur]);
        const prev = numOf(r[m.prev]);
        return {
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: arc([r.from!.lng, r.from!.lat], [r.to!.lng, r.to!.lat]) },
          properties: {
            routeId: r.routeId,
            fromName: r.fromName,
            toName: r.toName,
            w: maxCur > 0 ? cur / maxCur : 0,
            rel: cur - prev,
          },
        };
      }),
    };
  }, [filtered, m.cur, m.prev]);

  // 지도 refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const glRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<MapPopup | null>(null);
  const routesRef = useRef<RouteRow[]>([]);
  const [mapReady, setMapReady] = useState(false);
  routesRef.current = filtered;

  useEffect(() => {
    let disposed = false;
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (disposed || !containerRef.current) return;
      glRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [53, 49],
        zoom: 2.7,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => {
        map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "routes-highlight",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "routeId"], "__none__"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#1d4ed8",
            "line-opacity": 0.45,
            "line-width": ["interpolate", ["linear"], ["get", "w"], 0, 6, 1, 20],
          },
        });
        map.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": ["interpolate", ["linear"], ["get", "w"], 0, 1.5, 0.25, 4, 0.5, 7, 0.75, 10, 1, 14],
            "line-color": [
              "case",
              [">", ["get", "rel"], 0], "#2ecc71",
              ["<", ["get", "rel"], 0], "#e74c3c",
              "#999999",
            ],
            "line-opacity": 0.85,
          },
        });
        map.on("click", "routes-line", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const id = e.features?.[0]?.properties?.routeId as string | undefined;
          if (id) {
            setCoordMsg(null);
            setSelectedId(id);
          }
        });
        map.on("mouseenter", "routes-line", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "routes-line", () => {
          map.getCanvas().style.cursor = "";
        });
        setMapReady(true);
      });
    }
    init();
    return () => {
      disposed = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 데이터 갱신 → 소스 setData + 첫 로드 시 전체 fit
  const firstFit = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !mapReady || !gl) return;
    const src = map.getSource("routes") as import("maplibre-gl").GeoJSONSource | undefined;
    src?.setData(fc);
    if (!firstFit.current && fc.features.length) {
      const b = new gl.LngLatBounds();
      for (const f of fc.features) for (const c of f.geometry.coordinates) b.extend(c as [number, number]);
      map.fitBounds(b, { padding: 70, maxZoom: 5, duration: 0 });
      firstFit.current = true;
    }
  }, [fc, mapReady]);

  // 선택 변경 → 하이라이트 + 팝업 + fitBounds
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !mapReady || !gl) return;
    if (map.getLayer("routes-highlight")) {
      map.setFilter("routes-highlight", ["==", ["get", "routeId"], selectedId ?? "__none__"]);
    }
    popupRef.current?.remove();
    popupRef.current = null;
    if (!selectedId) return;
    const r = routesRef.current.find((x) => x.routeId === selectedId);
    if (!r || !r.hasCoords || !r.from || !r.to) return;
    const b = new gl.LngLatBounds([r.from.lng, r.from.lat], [r.from.lng, r.from.lat]);
    b.extend([r.to.lng, r.to.lat]);
    map.fitBounds(b, { padding: 90, maxZoom: 5.5, duration: 600 });
    popupRef.current = new gl.Popup({ closeButton: true, maxWidth: "300px" })
      .setLngLat([(r.from.lng + r.to.lng) / 2, (r.from.lat + r.to.lat) / 2])
      .setHTML(popupHtml(r))
      .addTo(map);
  }, [selectedId, mapReady]);

  function onRowClick(r: RouteRow) {
    if (!r.hasCoords) {
      setSelectedId(r.routeId);
      setCoordMsg(`${r.fromName} → ${r.toName}: 좌표 없음 — 지도에 표시할 수 없습니다.`);
      return;
    }
    setCoordMsg(null);
    setSelectedId(r.routeId);
  }

  const periods = data?.periods ?? [];
  const card = "rounded-lg border border-[#d8dfe9] bg-white px-4 py-3";

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#1a2433]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 min-[900px]:px-6">
        <header className="mb-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">Index1520 · Eurasia Rail</div>
          <h1 className="mt-1 text-[24px] font-bold leading-tight text-[#101828]">라우트 통계 지도</h1>
          <p className="mt-1.5 text-[13px] text-[#54606f]">
            중국–유럽 철도 O-D 구간 물동량(TEU)·운송기간·YoY. 라인 굵기=물동량, 색=전년 대비 증감. 출처:{" "}
            <a href="https://index1520.com/en/statistics/" target="_blank" rel="noopener noreferrer" className="underline">
              index1520.com
            </a>
            {data ? <> · 소스: {data.source === "route_statistics" ? "route API" : "transit-service"}{isFetching ? " · 갱신 중…" : ""}</> : null}
          </p>
        </header>

        {/* 필터 */}
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[#d8dfe9] bg-white px-4 py-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">
            기간 (Period)
            <select
              value={period ?? data?.currentPeriod ?? ""}
              onChange={(e) => {
                setPeriod(e.target.value || undefined);
                firstFit.current = false;
                setSelectedId(null);
              }}
              className="min-w-[150px] rounded-md border border-[#d0d7e2] bg-white px-2.5 py-1.5 text-[13px] text-[#1a2433]"
            >
              {periods.length === 0 && <option value="">{data?.currentPeriod ?? "—"}</option>}
              {periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">
            이전 기간 (Previous)
            <input
              value={data?.previousPeriod ?? "—"}
              readOnly
              className="min-w-[150px] cursor-not-allowed rounded-md border border-[#e4e9f1] bg-[#f5f7fa] px-2.5 py-1.5 text-[13px] text-[#667085]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">
            지표 (Metric)
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricKey)}
              className="min-w-[150px] rounded-md border border-[#d0d7e2] bg-white px-2.5 py-1.5 text-[13px] text-[#1a2433]"
            >
              {Object.entries(METRICS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">
            출발 검색 (Departure)
            <input
              value={depSearch}
              onChange={(e) => setDepSearch(e.target.value)}
              placeholder="예: DOSTYK"
              className="min-w-[150px] rounded-md border border-[#d0d7e2] bg-white px-2.5 py-1.5 text-[13px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">
            도착 검색 (Destination)
            <input
              value={destSearch}
              onChange={(e) => setDestSearch(e.target.value)}
              placeholder="예: BREST"
              className="min-w-[150px] rounded-md border border-[#d0d7e2] bg-white px-2.5 py-1.5 text-[13px]"
            />
          </label>
        </div>

        {/* 요약 카드 */}
        <div className="mb-4 grid grid-cols-2 gap-3 min-[700px]:grid-cols-4 min-[1100px]:grid-cols-7">
          <div className={card}><div className="text-[11px] text-[#667085]">Total TEU</div><div className="mt-1 text-[18px] font-bold tabular-nums">{fmt(summary.totalTeu)}</div></div>
          <div className={card}><div className="text-[11px] text-[#667085]">Previous TEU</div><div className="mt-1 text-[18px] font-bold tabular-nums">{fmt(summary.prevTeu)}</div></div>
          <div className={card}><div className="text-[11px] text-[#667085]">YoY Change</div><div className={`mt-1 text-[18px] font-bold tabular-nums ${summary.yoy == null ? "" : summary.yoy >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(summary.yoy)}</div></div>
          <div className={card}><div className="text-[11px] text-[#667085]">Avg Transit (d)</div><div className="mt-1 text-[18px] font-bold tabular-nums">{summary.avgTransit == null ? "—" : summary.avgTransit.toFixed(1)}</div></div>
          <div className={card}><div className="text-[11px] text-[#667085]">Routes</div><div className="mt-1 text-[18px] font-bold tabular-nums">{summary.count}</div></div>
          <div className={card}><div className="text-[11px] text-[#667085]">Mapped</div><div className="mt-1 text-[18px] font-bold tabular-nums text-[#16a34a]">{summary.mapped}</div></div>
          <div className={card}><div className="text-[11px] text-[#667085]">Missing Coords</div><div className="mt-1 text-[18px] font-bold tabular-nums text-[#d97706]">{summary.missing}</div></div>
        </div>

        {/* 지도 */}
        <section className="relative mb-4 overflow-hidden rounded-lg border border-[#d8dfe9] bg-white">
          <div ref={containerRef} className="h-[460px] w-full" data-testid="index1520-map" />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-[#d8dfe9] bg-white/92 px-3 py-1.5 text-[12px] font-medium text-[#344054] shadow-sm">
            {fc.features.length} / {summary.count} 라우트 표시 · <span className="text-[#16a34a]">▲ 증가</span> <span className="text-[#e74c3c]">▼ 감소</span>
          </div>
          {coordMsg && (
            <div className="absolute bottom-3 left-3 rounded-md border border-[#f0c27a] bg-[#fef6e7] px-3 py-1.5 text-[12px] text-[#92600a] shadow-sm">{coordMsg}</div>
          )}
        </section>

        {/* 표 */}
        <section className="rounded-lg border border-[#d8dfe9] bg-white px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold">라우트 통계</h2>
            <div className="text-[12px] text-[#667085]">{filtered.length} rows · 행 클릭 시 지도에서 강조</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#d8dfe9] text-[11px] uppercase text-[#667085]">
                  <th className="py-2 pr-4 font-semibold">From</th>
                  <th className="py-2 pr-4 font-semibold">To</th>
                  <th className="py-2 pr-4 text-right font-semibold">Current TEU</th>
                  <th className="py-2 pr-4 text-right font-semibold">Previous TEU</th>
                  <th className="py-2 pr-4 text-right font-semibold">YoY %</th>
                  <th className="py-2 pr-4 text-right font-semibold">Actual Weight</th>
                  <th className="py-2 pr-4 text-right font-semibold">Shipping Qty</th>
                  <th className="py-2 pr-4 text-right font-semibold">Transit (d)</th>
                  <th className="py-2 font-semibold">Coordinate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-[#667085]">표시할 라우트가 없습니다.</td></tr>
                )}
                {filtered.map((r) => {
                  const yoy = yoyOf(r.currentTeu, r.previousTeu);
                  const sel = r.routeId === selectedId;
                  return (
                    <tr
                      key={r.routeId}
                      onClick={() => onRowClick(r)}
                      className={`cursor-pointer border-b border-[#eef2f7] last:border-0 ${sel ? "bg-[#eaf1ff]" : "hover:bg-[#f6f9fc]"}`}
                    >
                      <td className="py-2.5 pr-4 font-medium">{r.fromName}</td>
                      <td className="py-2.5 pr-4">{r.toName}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.currentTeu)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-[#667085]">{fmt(r.previousTeu)}</td>
                      <td className={`py-2.5 pr-4 text-right tabular-nums ${yoy == null ? "text-[#667085]" : yoy >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(yoy)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.currentActualWeight, 1)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.currentShippingQty)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{r.currentTransitTime == null ? "—" : r.currentTransitTime.toFixed(1)}</td>
                      <td className="py-2.5">
                        {r.hasCoords ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#16a34a]"><span className="h-2 w-2 rounded-full bg-[#16a34a]" />Mapped</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#d97706]"><span className="h-2 w-2 rounded-full bg-[#d97706]" />Missing coordinates</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
