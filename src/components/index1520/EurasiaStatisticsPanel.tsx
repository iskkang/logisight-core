// Index1520 라우트 통계(Statistics) — Leaflet: 성(省)/국가 choropleth(물동량) + 실제 코리도어 네트워크(노드+세그먼트) + O-D 표.
// 지도 데이터: eurasia_charts.geo(지역 TEU, DB 보유) + 정적 코리도어(eurasiaCorridor). 표: index1520_route_statistics(없으면 transit fallback).
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { feature } from "topojson-client";
import type { Map as LMap, GeoJSON as LGeoJSON } from "leaflet";
import "leaflet/dist/leaflet.css";

import { index1520RoutesQueryOptions } from "@/lib/api/index1520-routes";
import type { RouteRow } from "@/lib/api/index1520-routes.functions";
import { eurasiaChartsQueryOptions } from "@/lib/api/eurasia-charts";
import { flagEmoji } from "@/lib/iso-country-codes";
import { CORRIDOR_NODES, CORRIDOR_SEGMENTS, CN_PROVINCE_EN_TO_CN } from "./eurasiaCorridor";

const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const CHINA_URL = "/china-provinces.json"; // 자체 호스팅(DataV 원본, 좌표 슬림) — aliyun 직접 호출은 브라우저 403

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
  const pa = hexToRgb(a), pb = hexToRgb(b), c = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * Math.max(0, Math.min(1, t)));
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}
const PALE = "#ffe3d6", DARK = "#8c1d13";

export function EurasiaStatisticsPanel() {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [metric, setMetric] = useState<MetricKey>("teu");
  const [depSearch, setDepSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isFetching } = useQuery({ ...index1520RoutesQueryOptions(period), placeholderData: keepPreviousData });
  const { data: charts } = useQuery(eurasiaChartsQueryOptions());
  const m = METRICS[metric];

  // choropleth 룩업: 성(중국어명)·국가(영문명) → TEU
  const { cnByName, euByName, teuMin, teuMax } = useMemo(() => {
    const cn = new Map<string, { teu: number; en: string }>();
    const eu = new Map<string, { teu: number; en: string }>();
    const vals: number[] = [];
    for (const r of charts?.geo?.data ?? []) {
      const teu = Number(r.TEU) || 0;
      if (teu > 0) vals.push(teu);
      if (r.countrySet === "eu") eu.set(r.name.toLowerCase(), { teu, en: r.name });
      else {
        const cnName = CN_PROVINCE_EN_TO_CN[r.name];
        if (cnName) cn.set(cnName, { teu, en: r.name });
      }
    }
    return { cnByName: cn, euByName: eu, teuMin: Math.min(...vals, 1), teuMax: Math.max(...vals, 1) };
  }, [charts]);

  const colorFor = (teu: number | undefined) => {
    if (!teu) return "#eef1f5";
    const t = (Math.log(teu) - Math.log(teuMin)) / (Math.log(teuMax) - Math.log(teuMin) || 1);
    return mix(PALE, DARK, t);
  };
  const cnByNameRef = useRef(cnByName), euByNameRef = useRef(euByName);
  cnByNameRef.current = cnByName;
  euByNameRef.current = euByName;
  const colorRef = useRef(colorFor);
  colorRef.current = colorFor;

  // 표 데이터(O-D)
  const filtered = useMemo(() => {
    const rows = data?.routes ?? [];
    const dq = depSearch.trim().toLowerCase(), tq = destSearch.trim().toLowerCase();
    return rows
      .filter((r) => (!dq || r.fromName.toLowerCase().includes(dq)) && (!tq || r.toName.toLowerCase().includes(tq)))
      .sort((a, b) => numOf(b[m.cur]) - numOf(a[m.cur]));
  }, [data, depSearch, destSearch, m.cur]);

  const summary = useMemo(() => {
    let totalTeu = 0, prevTeu = 0, tSum = 0, tN = 0, mapped = 0;
    for (const r of filtered) {
      totalTeu += r.currentTeu; prevTeu += r.previousTeu;
      if (r.currentTransitTime != null) { tSum += r.currentTransitTime; tN += 1; }
      if (r.hasCoords) mapped += 1;
    }
    return { totalTeu, prevTeu, yoy: yoyOf(totalTeu, prevTeu), avgT: tN ? tSum / tN : null, count: filtered.length, mapped };
  }, [filtered]);

  // Leaflet
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const cnLayerRef = useRef<LGeoJSON | null>(null);
  const euLayerRef = useRef<LGeoJSON | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      if (disposed || !containerRef.current) return;
      const map = L.map(containerRef.current, { center: [46, 60], zoom: 3, scrollWheelZoom: true, worldCopyJump: true });
      mapRef.current = map;
      map.createPane("corridor"); map.getPane("corridor")!.style.zIndex = "450";
      map.createPane("nodes"); map.getPane("nodes")!.style.zIndex = "460";
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 12, attribution: "&copy; OpenStreetMap &copy; CARTO" }).addTo(map);
      setTimeout(() => mapRef.current?.invalidateSize(), 120);

      // 코리도어 네트워크(정적)
      for (const [a, b] of CORRIDOR_SEGMENTS) {
        const na = CORRIDOR_NODES[a], nb = CORRIDOR_NODES[b];
        if (na && nb) L.polyline([[na[0], na[1]], [nb[0], nb[1]]], { pane: "corridor", color: "#334155", weight: 1.1, opacity: 0.65, dashArray: "4 3" }).addTo(map);
      }
      for (const code of Object.keys(CORRIDOR_NODES)) {
        const [lat, lng, label] = CORRIDOR_NODES[code];
        L.circleMarker([lat, lng], { pane: "nodes", radius: 2.6, color: "#334155", weight: 1, fillColor: "#ffffff", fillOpacity: 1 })
          .bindTooltip(label, { direction: "top" }).addTo(map);
      }

      // 국가(EU) choropleth
      try {
        const topo = await fetch(WORLD_URL).then((r) => r.json());
        if (disposed || !mapRef.current) return;
        const geo = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
        euLayerRef.current = L.geoJSON(geo, {
          style: (f) => {
            const hit = euByNameRef.current.get(String((f?.properties as { name?: string })?.name ?? "").toLowerCase());
            return { fillColor: colorRef.current(hit?.teu), fillOpacity: hit ? 0.85 : 0.25, weight: 0.4, color: "#ffffff", opacity: 1 };
          },
          onEachFeature: (f, lyr) => lyr.bindTooltip(() => {
            const hit = euByNameRef.current.get(String((f.properties as { name?: string })?.name ?? "").toLowerCase());
            return hit ? `<b>${hit.en}</b><br/>${Math.round(hit.teu).toLocaleString()} TEU` : "";
          }, { sticky: true }),
        }).addTo(map);
      } catch { /* noop */ }

      // 중국 성(省) choropleth
      try {
        const cnGeo = await fetch(CHINA_URL).then((r) => r.json());
        if (disposed || !mapRef.current) return;
        cnLayerRef.current = L.geoJSON(cnGeo, {
          style: (f) => {
            const hit = cnByNameRef.current.get(String((f?.properties as { name?: string })?.name ?? ""));
            return { fillColor: colorRef.current(hit?.teu), fillOpacity: hit ? 0.85 : 0.18, weight: 0.4, color: "#ffffff", opacity: 1 };
          },
          onEachFeature: (f, lyr) => lyr.bindTooltip(() => {
            const hit = cnByNameRef.current.get(String((f.properties as { name?: string })?.name ?? ""));
            return hit ? `<b>${hit.en}</b><br/>${Math.round(hit.teu).toLocaleString()} TEU` : "";
          }, { sticky: true }),
        }).addTo(map);
      } catch { /* noop */ }

      setReady(true);
    })();
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; cnLayerRef.current = null; euLayerRef.current = null; setReady(false); };
  }, []);

  // 데이터 도착/변경 시 choropleth 재색칠
  useEffect(() => {
    if (!ready) return;
    euLayerRef.current?.setStyle((f) => {
      const hit = euByNameRef.current.get(String((f?.properties as { name?: string })?.name ?? "").toLowerCase());
      return { fillColor: colorRef.current(hit?.teu), fillOpacity: hit ? 0.85 : 0.25, weight: 0.4, color: "#ffffff", opacity: 1 };
    });
    cnLayerRef.current?.setStyle((f) => {
      const hit = cnByNameRef.current.get(String((f?.properties as { name?: string })?.name ?? ""));
      return { fillColor: colorRef.current(hit?.teu), fillOpacity: hit ? 0.85 : 0.18, weight: 0.4, color: "#ffffff", opacity: 1 };
    });
  }, [cnByName, euByName, ready]);

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
      <div className="mb-3 grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-3 min-[1100px]:grid-cols-6">
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Total TEU</div><div className="mt-1 text-[18px] font-bold tabular-nums">{fmt(summary.totalTeu)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Previous TEU</div><div className="mt-1 text-[18px] font-bold tabular-nums">{fmt(summary.prevTeu)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">YoY Change</div><div className={`mt-1 text-[18px] font-bold tabular-nums ${summary.yoy == null ? "" : summary.yoy >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(summary.yoy)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Avg Travel (d)</div><div className="mt-1 text-[18px] font-bold tabular-nums">{summary.avgT == null ? "—" : summary.avgT.toFixed(1)}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">Routes</div><div className="mt-1 text-[18px] font-bold tabular-nums">{summary.count}</div></div>
        <div className={cardCls}><div className="text-[11px] text-[#667085]">코리도어 노드</div><div className="mt-1 text-[18px] font-bold tabular-nums">{Object.keys(CORRIDOR_NODES).length}</div></div>
      </div>

      {/* 지도: 성/국가 choropleth + 코리도어 네트워크 */}
      <section className="relative mb-3 overflow-hidden rounded-[14px] border border-[#d8dfe9]">
        <div ref={containerRef} className="h-[480px] w-full" data-testid="index1520-leaflet" style={{ background: "#dceaf5" }} />
        <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-md border border-[#d8dfe9] bg-white/92 px-3 py-1.5 text-[12px] font-medium text-[#344054] shadow-sm">
          유라시아 철도 코리도어 · 색 = 지역별 물동량(TEU)
        </div>
        {/* 범례 */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md border border-[#d8dfe9] bg-white/92 px-3 py-2 shadow-sm">
          <div className="mb-1 text-[10.5px] font-semibold text-[#344054]">The volume of containers transported, TEU</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-[#667085]">{fmt(teuMin)}</span>
            <span className="h-2.5 w-28 rounded-sm" style={{ background: `linear-gradient(to right, ${PALE}, ${DARK})` }} />
            <span className="text-[10px] tabular-nums text-[#667085]">{fmt(teuMax)}</span>
          </div>
        </div>
      </section>

      {/* 표 */}
      <section className="rounded-[14px] border border-[#d8dfe9] bg-white px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold text-[#1a2433]">라우트 통계 (국가 O-D)</h3>
          <div className="text-[12px] text-[#667085]">{filtered.length} rows</div>
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
                <th className="py-2 font-semibold">Travel (d)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-[#667085]">국가 O-D 데이터가 없습니다. (route_statistics 백필 또는 워크플로 force 실행)</td></tr>}
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
                    <td className="py-2.5 text-right tabular-nums">{r.currentTransitTime == null ? "—" : r.currentTransitTime.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[11px] text-[#828d9d]">출처: index1520.com · 지도: Leaflet · 성 경계 DataV.GeoAtlas · 국가 경계 world-atlas · 코리도어: index1520 route</div>
      </section>
    </div>
  );
}
