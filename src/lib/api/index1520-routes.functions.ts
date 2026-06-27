import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

// Index1520 라우트 통계 — ETL이 index1520_transit_service(+선택적 route_statistics)에 적재.
// route API는 O-D가 아닌 지역 집계라 route_statistics는 보통 비어 있고, 페이지는 transit-service를 사용한다.
// 좌표는 index1520_locations(수동 시드)에서 station id로 매칭. 둘 다 좌표가 있어야 지도에 그린다.

export type LatLng = { lat: number; lng: number; name: string };
export type RouteRow = {
  routeId: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  from: LatLng | null;
  to: LatLng | null;
  hasCoords: boolean;
  previousPeriod: string | null;
  currentTeu: number;
  previousTeu: number;
  relativeTeu: number | null;
  currentActualWeight: number | null;
  previousActualWeight: number | null;
  relativeActualWeight: number | null;
  currentShippingQty: number | null;
  previousShippingQty: number | null;
  relativeShippingQty: number | null;
  currentTransitTime: number | null;
  previousTransitTime: number | null;
  relativeTransitTime: number | null;
};
export type Index1520RoutesData = {
  routes: RouteRow[];
  periods: string[];
  currentPeriod: string | null;
  previousPeriod: string | null;
  maxReportingDate: string | null;
  source: "route_statistics" | "transit_service";
};

type Row = Record<string, unknown>;
type QueryResult = Promise<{ data: Row[] | null; error: { message: string } | null }>;
type Builder = QueryResult & {
  select: (c: string) => Builder;
  eq: (col: string, val: unknown) => Builder;
  order: (col: string, opts?: { ascending?: boolean }) => Builder;
  limit: (n: number) => Builder;
};
type SbLike = { from: (table: string) => Builder };

const n = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const num = (v: unknown): number => Number(v) || 0;
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export const getIndex1520Routes = createServerFn({ method: "GET" })
  .inputValidator(z.string().optional())
  .handler(async ({ data: periodArg }): Promise<Index1520RoutesData> => {
    setResponseHeader("cache-control", "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400");
    const sb = supabasePublicServer as unknown as SbLike;

    // 최신 period 상태
    const ps = await sb
      .from("index1520_period_status")
      .select("max_reporting_date,current_period,previous_period")
      .order("max_reporting_date", { ascending: false })
      .limit(1);
    if (ps.error) throw new Error(ps.error.message);
    const latest = ps.data?.[0];

    // 사용 가능한 period 목록(transit_service 기준)
    const tAll = await sb.from("index1520_transit_service").select("period").order("period", { ascending: false });
    if (tAll.error) throw new Error(tAll.error.message);
    const periods = [...new Set((tAll.data ?? []).map((r) => str(r.period)).filter(Boolean))];

    const selectedPeriod = periodArg ?? str(latest?.current_period) ?? periods[0] ?? null;

    // 좌표 맵
    const locsRes = await sb.from("index1520_locations").select("id,name,latitude,longitude");
    if (locsRes.error) throw new Error(locsRes.error.message);
    const locMap = new Map(
      (locsRes.data ?? []).map((l) => [
        str(l.id),
        { name: str(l.name), lat: n(l.latitude), lng: n(l.longitude) },
      ]),
    );

    // 소스 우선순위: route_statistics에 데이터가 있으면 사용, 없으면 transit_service
    let source: Index1520RoutesData["source"] = "transit_service";
    let base: RouteRow[] = [];
    if (selectedPeriod) {
      const rs = await sb.from("index1520_route_statistics").select("*").eq("period", selectedPeriod);
      if (rs.error) throw new Error(rs.error.message);
      if (rs.data && rs.data.length) {
        source = "route_statistics";
        base = rs.data.map((r) => mapRow(r, "departure_id", "destination_id"));
      } else {
        const ts = await sb.from("index1520_transit_service").select("*").eq("period", selectedPeriod);
        if (ts.error) throw new Error(ts.error.message);
        base = (ts.data ?? []).map((r) => mapRow(r, "departure_station_id", "destination_station_id"));
      }
    }

    // 좌표 결합
    const routes = base.map((r) => {
      const f = locMap.get(r.fromId);
      const t = locMap.get(r.toId);
      const from = f && f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng, name: f.name || r.fromName } : null;
      const to = t && t.lat != null && t.lng != null ? { lat: t.lat, lng: t.lng, name: t.name || r.toName } : null;
      return { ...r, from, to, hasCoords: Boolean(from && to) };
    });

    return {
      routes,
      periods,
      currentPeriod: selectedPeriod,
      previousPeriod: routes[0]?.previousPeriod ?? str(latest?.previous_period) ?? null,
      maxReportingDate: str(latest?.max_reporting_date) || null,
      source,
    };
  });

function mapRow(r: Row, depKey: string, destKey: string): RouteRow {
  const fromId = str(r[depKey]);
  const toId = str(r[destKey]);
  const fromName = str(r[depKey.replace("_id", "_name")]) || fromId;
  const toName = str(r[destKey.replace("_id", "_name")]) || toId;
  return {
    routeId: `${fromId}__${toId}`,
    fromId,
    fromName,
    toId,
    toName,
    from: null,
    to: null,
    hasCoords: false,
    previousPeriod: str(r.previous_period) || null,
    currentTeu: num(r.current_teu),
    previousTeu: num(r.previous_teu),
    relativeTeu: n(r.relative_teu),
    currentActualWeight: n(r.current_actual_weight),
    previousActualWeight: n(r.previous_actual_weight),
    relativeActualWeight: n(r.relative_actual_weight),
    currentShippingQty: n(r.current_shipping_qty),
    previousShippingQty: n(r.previous_shipping_qty),
    relativeShippingQty: n(r.relative_shipping_qty),
    currentTransitTime: n(r.current_transit_time),
    previousTransitTime: n(r.previous_transit_time),
    relativeTransitTime: n(r.relative_transit_time),
  };
}
