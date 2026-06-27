// Index1520 라우트 통계(Statistics) — Leaflet 지도(타일 베이스맵 + 국가 choropleth + O-D 코리도어 라인).
// 데이터: index1520_route_statistics(국가 O-D, route view=list) + index1520_locations 좌표. 출처: index1520.com.
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { feature } from "topojson-client";
import type { Map as LMap, GeoJSON as LGeoJSON, LayerGroup, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";

import { index1520RoutesQueryOptions } from "@/lib/api/index1520-routes";
import type { RouteRow, LatLng } from "@/lib/api/index1520-routes.functions";
import { ISO2_TO_NUMERIC, flagEmoji } from "@/lib/iso-country-codes";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type MetricKey = "teu" | "weight" | "qty" | "transit";
const METRICS: Record<MetricKey, { label: string; cur: keyof RouteRow; prev: keyof RouteRow }> = {
  teu: { label: "TEU", cur: "currentTeu", prev: "previousTeu" },
  weight: { label: "Actual Weight (k t)", cur: "currentActualWeight", prev: "previousActualWeight" },
  qty: { label: "Shipping Qty", cur: "currentShippingQty", prev: "previousShippingQty" },
  transit: { label: "Travel Time (d)", cur: "currentTransitTime", prev: "previousTransitTime" },
};

const numOf = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const fmt = (v: number | null | undefined, d = 0) =>
  v == null || Number.isNaN(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v: number | null) => (v == null || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
const yoyOf = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const c = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * Math.max(0, Math.min(1, t)));
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

// 살짝 휜 코리도어(2차 베지어 → [lat,lng]). 방향 무관하게 서→동 기준으로 그려
// 양방향 쌍(A→B, B→A)이 렌즈처럼 벌어지지 않게 하고, bulge를 캡해 과도한 호를 방지.
function arcLatLng(p1: LatLng, p2: LatLng): [number, number][] {
  const [a, b] = p1.lng <= p2.lng ? [p1, p2] : [p2, p1];
  const ax = a.lng, ay = a.lat, bx = b.lng, by = b.lat;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(dist * 0.12, 9);
  const cx = mx - (dy / dist) * bend;
  const cy = my + (dx / dist) * bend;
  const steps = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, k = 1 - t;
    pts.push([k * k * ay + 2 * k * t * cy + t * t * by, k * k * ax + 2 * k * t * cx + t * t * bx]);
  }
  return pts;
}

function popupHtml(r: RouteRow): string {
  const yoy = yoyOf(r.currentTeu, r.previousTeu);
  const col = yoy == null ? "#667085" : yoy >= 0 ? "#16a34a" : "#dc2626";
  return `<div style="font-size:12px;line-height:1.5">
    <div style="font-weight:700;margin-bottom:3px">${flagEmoji(r.fromId)} ${r.fromName} → ${flagEmoji(r.toId)} ${r.toName}</div>
    <div>Current TEU: <b>${fmt(r.currentTeu)}</b></div>
    <div>Previous TEU: ${fmt(r.previousTeu)}</div>
    <div>YoY: <span style="color:${col};font-weight:600">${fmtPct(yoy)}</span></div>
    <div>Travel: ${r.currentTransitTime == null ? "—" : `${r.currentTransitTime.toFixed(1)}d`}</div>
  </div>`;
}

export function EurasiaStatisticsPanel() {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [metric, setMetric] = useState<MetricKey>("teu");
  const [depSearch, setDepSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    let totalTeu = 0, prevTeu = 0, tSum = 0, tN = 0, mapped = 0;
    for (const r of filtered) {
      totalTeu += r.currentTeu;
      prevTeu += r.previousTeu;
      if (r.currentTransitTime != null) { tSum += r.currentTransitTime; tN += 1; }
      if (r.hasCoords) mapped += 1;
    }
    return { totalTeu, prevTeu, yoy: yoyOf(totalTeu, prevTeu), avgT: tN ? tSum / tN : null, count: filtered.length, mapped, missing: filtered.length - mapped };
  }, [filtered]);

  const { byNumeric, maxTeu } = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      for (const code of [r.fromId, r.toId]) {
        const num = ISO2_TO_NUMERIC[(code || "").toUpperCase()];
        if (num) map.set(num, (map.get(num) ?? 0) + r.currentTeu);
      }
    }
    return { byNumeric: map, maxTeu: Math.max(1, ...map.values()) };
  }, [filtered]);

  const lines = useMemo(() => filtered.filter((r) => r.hasCoords && r.from && r.to), [filtered]);
  const maxLineVal = useMemo(() => Math.max(1, ...lines.map((r) => numOf(r[m.cur]))), [lines, m.cur]);
  const lineColor = (r: RouteRow) => {
    const d = numOf(r[m.cur]) - numOf(r[m.prev]);
    return d > 0 ? "#16a34a" : d < 0 ? "#dc2626" : "#94a3b8";
  };
  const lineWidth = (r: RouteRow) => 1.5 + (numOf(r[m.cur]) / maxLineVal) * 7;

  // Leaflet refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const geoLayerRef = useRef<LGeoJSON | null>(null);
  const lineGroupRef = useRef<LayerGroup | null>(null);
  const lineByIdRef = useRef<Map<string, Polyline>>(new Map());
  const byNumericRef = useRef(byNumeric);
  const maxTeuRef = useRef(maxTeu);
  byNumericRef.current = byNumeric;
  maxTeuRef.current = maxTeu;
  const [mapReady, setMapReady] = useState(false);
  const [geoReady, setGeoReady] = useState(false);

  const geoStyle = (numeric: string) => {
    const v = byNumericRef.current.get(numeric);
    const fill = v ? mix("#d6efe9", "#0d9488", Math.log1p(v) / Math.log1p(maxTeuRef.current)) : "#e9eef4";
    return { fillColor: fill, fillOpacity: v ? 0.82 : 0.5, weight: 0.5, color: "#ffffff", opacity: 1 };
  };

  // 지도 초기화
  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      if (disposed || !containerRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { center: [45, 55], zoom: 3, scrollWheelZoom: true, worldCopyJump: true });
      mapRef.current = map;
      map.createPane("odlines");
      const odPane = map.getPane("odlines");
      if (odPane) odPane.style.zIndex = "450"; // choropleth(overlayPane 400) 위
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 12,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map);
      lineGroupRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
      setTimeout(() => mapRef.current?.invalidateSize(), 120);
      try {
        const topo = await fetch(GEO_URL).then((r) => r.json());
        if (disposed || !mapRef.current) return;
        const geo = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
        const layer = L.geoJSON(geo, {
          style: (f) => geoStyle(String(f?.id ?? "").padStart(3, "0")),
          onEachFeature: (f, lyr) => {
            lyr.bindTooltip(
              () => {
                const id = String(f.id ?? "").padStart(3, "0");
                const teu = byNumericRef.current.get(id);
                const name = (f.properties as { name?: string } | null)?.name ?? "—";
                return `<b>${name}</b><br/>${teu ? `물동량 ${Math.round(teu).toLocaleString()} TEU` : "데이터 없음"}`;
              },
              { sticky: true },
            );
          },
        }).addTo(map);
        geoLayerRef.current = layer;
        setGeoReady(true);
      } catch {
        /* geojson 실패해도 라인은 표시 */
      }
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      geoLayerRef.current = null;
      lineGroupRef.current = null;
      setMapReady(false);
      setGeoReady(false);
    };
  }, []);

  // choropleth 재색칠
  useEffect(() => {
    if (!geoReady || !geoLayerRef.current) return;
    geoLayerRef.current.setStyle((f) => geoStyle(String(f?.id ?? "").padStart(3, "0")));
  }, [byNumeric, maxTeu, geoReady]);

  // O-D 라인 그리기 + 선택 강조 + 팝업/fit
  useEffect(() => {
    const L = LRef.current, group = lineGroupRef.current, map = mapRef.current;
    if (!L || !group || !map || !mapReady) return;
    group.clearLayers();
    lineByIdRef.current.clear();
    for (const r of lines) {
      const on = r.routeId === selectedId;
      const pl = L.polyline(arcLatLng(r.from!, r.to!), {
        pane: "odlines",
        color: on ? "#1d4ed8" : lineColor(r),
        weight: on ? lineWidth(r) + 2.5 : lineWidth(r),
        opacity: on ? 0.95 : 0.82,
        dashArray: on ? undefined : "5 4",
        lineCap: "round",
      });
      pl.bindPopup(popupHtml(r));
      pl.on("click", () => setSelectedId(r.routeId));
      pl.addTo(group);
      lineByIdRef.current.set(r.routeId, pl);
    }
    if (selectedId) {
      const r = lines.find((x) => x.routeId === selectedId);
      const pl = lineByIdRef.current.get(selectedId);
      if (r && pl && r.from && r.to) {
        pl.openPopup();
        map.fitBounds(L.latLngBounds([[r.from.lat, r.from.lng], [r.to.lat, r.to.lng]]), { padding: [60, 60], maxZoom: 5 });
      }
    }
  }, [lines, selectedId, mapReady, metric]);

  const periods = data?.periods ?? [];
  const inp = "rounded-md border border-[#d0d7e2] bg-white px-2.5 py-1.5 text-[13px] text-[#1a2433]";
  const cardCls = "rounded-[12px] border border-[#d8dfe9] bg-white px-3.5 py-3";

  return (
    <div className="mt-2">
      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] px-4 py-3">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">기간
          <select value={period ?? data?.currentPeriod ?? ""} onChange={(e) => { setPeriod(e.target.value || undefined); setSelectedId(null); }} className={`min-w-[150px] ${inp}`}>
            {periods.length === 0 && <option value="">{data?.currentPeriod ?? "—"}</option>}
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">이전 기간
          <input value={data?.previousPeriod ?? "—"} readOnly className={`min-w-[140px] cursor-not-allowed border-[#e4e9f1] bg-[#eef1f6] text-[#828d9d] ${inp}`} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">지표
          <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} className={`min-w-[150px] ${inp}`}>
            {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">출발 검색
          <input value={depSearch} onChange={(e) => setDepSearch(e.target.value)} placeholder="예: China" className={`min-w-[140px] ${inp}`} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#667085]">도착 검색
          <input value={destSearch} onChange={(e) => setDestSearch(e.target.value)} placeholder="예: Poland" className={`min-w-[140px] ${inp}`} />
        </label>
        {isFetching && <span className="pb-1.5 text-[12px] text-[#828d9d]">갱신 중…</span>}
      </div>

      {/* 요약 카드 */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-4 min-[1100px]:grid-cols-7">
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Total TEU</div><div className="mt-1 text-[18px] font-bold tabular-nums">{fmt(summary.totalTeu)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Previous TEU</div><div className="mt-1 text-[18px] font-bold tabular-nums">{fmt(summary.prevTeu)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">YoY Change</div><div className={`mt-1 text-[18px] font-bold tabular-nums ${summary.yoy == null ? "" : summary.yoy >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(summary.yoy)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Avg Travel (d)</div><div className="mt-1 text-[18px] font-bold tabular-nums">{summary.avgT == null ? "—" : summary.avgT.toFixed(1)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Routes</div><div className="mt-1 text-[18px] font-bold tabular-nums">{summary.count}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Mapped</div><div className="mt-1 text-[18px] font-bold tabular-nums text-[#16a34a]">{summary.mapped}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Missing</div><div className="mt-1 text-[18px] font-bold tabular-nums text-[#d97706]">{summary.missing}</div></div>
      </div>

      {/* Leaflet 지도 */}
      <section className="relative mb-3 overflow-hidden rounded-[14px] border border-[#d8dfe9]">
        <div ref={containerRef} className="h-[460px] w-full" data-testid="index1520-leaflet" style={{ background: "#aadaff" }} />
        <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-md border border-[#d8dfe9] bg-white/92 px-3 py-1.5 text-[12px] font-medium text-[#344054] shadow-sm">
          {lines.length}/{summary.count} 라우트 · <span className="text-[#16a34a]">▲ 증가</span> <span className="text-[#e74c3c]">▼ 감소</span> · 색=국가별 물동량
        </div>
      </section>

      {/* 표 */}
      <section className="rounded-[14px] border border-[#d8dfe9] bg-white px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold text-[#1a2433]">라우트 통계</h3>
          <div className="text-[12px] text-[#667085]">{filtered.length} rows · 행 클릭 시 지도 강조</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#d8dfe9] text-[11px] uppercase text-[#667085]">
                <th className="py-2 pr-4 font-semibold">From</th>
                <th className="py-2 pr-4 font-semibold">To</th>
                <th className="py-2 pr-4 text-right font-semibold">Current TEU</th>
                <th className="py-2 pr-4 text-right font-semibold">Previous</th>
                <th className="py-2 pr-4 text-right font-semibold">YoY %</th>
                <th className="py-2 pr-4 text-right font-semibold">Weight</th>
                <th className="py-2 pr-4 text-right font-semibold">Qty</th>
                <th className="py-2 pr-4 text-right font-semibold">Travel (d)</th>
                <th className="py-2 font-semibold">Coord</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-[#667085]">표시할 라우트가 없습니다. (워크플로 실행 후 데이터가 채워집니다)</td></tr>}
              {filtered.map((r) => {
                const yoy = yoyOf(r.currentTeu, r.previousTeu);
                const on = r.routeId === selectedId;
                return (
                  <tr key={r.routeId} onClick={() => setSelectedId(r.routeId)} className={`cursor-pointer border-b border-[#eef2f7] last:border-0 ${on ? "bg-[#eaf1ff]" : "hover:bg-[#f6f9fc]"}`}>
                    <td className="py-2.5 pr-4 font-medium">{flagEmoji(r.fromId)} {r.fromName}</td>
                    <td className="py-2.5 pr-4">{flagEmoji(r.toId)} {r.toName}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.currentTeu)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-[#667085]">{fmt(r.previousTeu)}</td>
                    <td className={`py-2.5 pr-4 text-right tabular-nums ${yoy == null ? "text-[#667085]" : yoy >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(yoy)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.currentActualWeight, 1)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.currentShippingQty)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{r.currentTransitTime == null ? "—" : r.currentTransitTime.toFixed(1)}</td>
                    <td className="py-2.5">
                      {r.hasCoords
                        ? <span className="inline-flex items-center gap-1.5 text-[12px] text-[#16a34a]"><span className="h-2 w-2 rounded-full bg-[#16a34a]" />Mapped</span>
                        : <span className="inline-flex items-center gap-1.5 text-[12px] text-[#d97706]"><span className="h-2 w-2 rounded-full bg-[#d97706]" />Missing</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[11px] text-[#828d9d]">데이터 출처: index1520.com (route view=list, 국가 O-D) · 지도: Leaflet · world-atlas · © CARTO</div>
      </section>
    </div>
  );
}
