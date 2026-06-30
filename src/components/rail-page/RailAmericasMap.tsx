// 미주 철도 코리도 지도 — 기존 /rail-map 페이지에서 이동(데이터/지도 로직 그대로 재사용).
// /rail/americas 라우트에서 사용. 허브 레이아웃(nav+탭바+footer) 안에 들어가도록 외곽 높이만 조정.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { railMapQueryOptions } from "@/lib/api/rail-map";
import type { RailCorridorsGeoJSON } from "@/lib/api/rail-map.functions";
import { STATUS_COLORS } from "@/lib/railMap";
import { GeoArticleSchema } from "@/components/geo/GeoArticleSchema";

function formatScore(score: number | null): string {
  return score == null ? "-" : String(score);
}

/* ===================== GEO: Article 스키마용 기준일 계산 ===================== */
function buildAmericasGeo(geojson: RailCorridorsGeoJSON) {
  let latest: string | null = null;
  for (const f of geojson.features) {
    const updated = f.properties.updated_at;
    if (updated && (!latest || updated > latest)) latest = updated;
  }
  const refDate = latest ? latest.slice(0, 10) : null;
  return { refDate };
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function popupHtml(properties: MapGeoJSONFeature["properties"]): string {
  const score = properties.score === null || properties.score === undefined || properties.score === "" ? "-" : properties.score;
  const reason = properties.reason || "-";
  const updated = properties.updated_at || "-";
  return [
    `<strong>${properties.name}</strong>`,
    `Railroad: ${properties.railroad}`,
    `Status: ${properties.status}`,
    `Score: ${score}`,
    `Reason: ${reason}`,
    `Updated: ${updated}`,
  ].join("<br/>");
}

export function RailAmericasMap() {
  const { data: geojson } = useSuspenseQuery(railMapQueryOptions());
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const summary = useMemo(() => {
    const counts = { normal: 0, watch: 0, delayed: 0, severe: 0, unknown: 0 };
    let latest: string | null = null;
    for (const feature of geojson.features) {
      counts[feature.properties.status] += 1;
      const updated = feature.properties.updated_at;
      if (updated && (!latest || updated > latest)) latest = updated;
    }
    return { counts, latest };
  }, [geojson]);

  const geo = useMemo(() => buildAmericasGeo(geojson), [geojson]);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (disposed || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [-101, 43.5],
        zoom: 3.1,
        attributionControl: false,
        // 페이지 세로 스크롤이 지도에 흡수되지 않도록 협조적 제스처 사용.
        // 데스크톱은 ⌘/Ctrl+스크롤, 모바일은 두 손가락일 때만 지도를 조작한다.
        cooperativeGestures: true,
        locale: {
          "CooperativeGesturesHandler.WindowsHelpText": "Ctrl + 스크롤로 지도를 확대/축소합니다",
          "CooperativeGesturesHandler.MacHelpText": "⌘ + 스크롤로 지도를 확대/축소합니다",
          "CooperativeGesturesHandler.MobileHelpText": "두 손가락으로 지도를 움직입니다",
        },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        map.addSource("rail", { type: "geojson", data: geojson });
        map.addLayer({
          id: "rail-lines",
          type: "line",
          source: "rail",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 3, 7, 7],
            "line-color": [
              "match",
              ["get", "status"],
              "normal",
              STATUS_COLORS.normal,
              "watch",
              STATUS_COLORS.watch,
              "delayed",
              STATUS_COLORS.delayed,
              "severe",
              STATUS_COLORS.severe,
              "unknown",
              STATUS_COLORS.unknown,
              STATUS_COLORS.unknown,
            ],
            "line-opacity": 0.9,
          },
        });

        map.on("click", "rail-lines", (event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
          const feature = event.features?.[0];
          if (!feature) return;
          new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
            .setLngLat(event.lngLat)
            .setHTML(popupHtml(feature.properties))
            .addTo(map);
        });

        map.on("mouseenter", "rail-lines", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "rail-lines", () => {
          map.getCanvas().style.cursor = "";
        });
      });
    }

    initMap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geojson]);

  return (
    <main className="bg-[#f3f6fa] text-[#1a2433]">
      {/* GEO: 보이지 않는 Article JSON-LD만 유지 (시각 요소 없음) */}
      <GeoArticleSchema
        article={{
          headline: "북미 인터모달 철도 코리도어 상태",
          description: "북미 인터모달 철도 코리도 상태 지도(정상·주의·지연)와 코리도어별 상태·점수·갱신 시각.",
          path: "/rail/americas",
          datePublished: geo.refDate,
          dateModified: geo.refDate,
        }}
      />

      <div className="grid min-h-[78vh] grid-cols-[320px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_70vh_auto]">
        <aside className="border-r border-[#d8dfe9] bg-white px-5 py-5 max-[900px]:border-b max-[900px]:border-r-0">
          <div className="mb-5">
            <div className="text-[12px] font-semibold uppercase text-[#667085]">Rail Risk Map</div>
            <h1 className="mt-1 text-[22px] font-bold leading-tight text-[#101828]">North America Intermodal Corridors</h1>
            <p className="mt-2 text-[13px] leading-[1.55] text-[#54606f]">
              Carrier advisory + news monitored. Green = source checked, no reported disruption. Gray = limited public visibility.
            </p>
          </div>

          <div className="rounded-lg border border-[#d8dfe9] bg-[#f8fafc] p-4">
            <div className="text-[13px] font-bold text-[#1a2433]">Status Summary</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              {Object.entries(summary.counts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-md border border-[#e4e9f1] bg-white px-3 py-2">
                  <span className="flex items-center gap-2 capitalize">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }}
                    />
                    {status}
                  </span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-[#e4e9f1] pt-3 text-[12px] text-[#667085]">
              Last update: <span className="font-medium text-[#344054]">{formatDate(summary.latest)}</span>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#d8dfe9] bg-white p-4">
            <div className="text-[13px] font-bold text-[#1a2433]">Active Severe / Delayed</div>
            <div className="mt-2 text-[13px] text-[#667085]">No severe or delayed corridors in the current monitoring window.</div>
          </div>
        </aside>

        <section className="relative min-h-0">
          <div ref={containerRef} className="h-full min-h-[520px] w-full" data-testid="rail-map-canvas" />
          <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-[#d8dfe9] bg-white/92 px-3 py-2 text-[12px] font-semibold text-[#344054] shadow-sm">
            {geojson.features.length} corridors / normal green, limited visibility gray
          </div>
        </section>

        <section className="col-span-2 border-t border-[#d8dfe9] bg-white px-5 py-4 max-[900px]:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold text-[#1a2433]">Corridor Table</h2>
            <div className="text-[12px] text-[#667085]" data-testid="rail-map-line-count">
              Rows: {geojson.features.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#d8dfe9] text-[12px] uppercase text-[#667085]">
                  <th className="py-2 pr-4 font-semibold">Corridor</th>
                  <th className="py-2 pr-4 font-semibold">Railroad</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Score</th>
                  <th className="py-2 pr-4 font-semibold">Reason</th>
                  <th className="py-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {geojson.features.map((feature) => (
                  <tr key={feature.properties.corridor_code} className="border-b border-[#eef2f7] last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-[#1a2433]">{feature.properties.name}</td>
                    <td className="py-2.5 pr-4 text-[#344054]">{feature.properties.railroad}</td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-2 rounded-md border border-[#d8dfe9] bg-[#f8fafc] px-2 py-1 text-[12px] font-semibold capitalize text-[#344054]">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[feature.properties.status] }}
                        />
                        {feature.properties.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[#344054]">{formatScore(feature.properties.score)}</td>
                    <td className="py-2.5 pr-4 text-[#54606f]">{feature.properties.reason || "-"}</td>
                    <td className="py-2.5 text-[#54606f]">{formatDate(feature.properties.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
