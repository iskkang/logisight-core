import { queryOptions } from "@tanstack/react-query";

import { getClimateRisk } from "./climate.functions";

// 예보 시점 — asset_risk.horizon_days 와 일치. globe-data.js 기준.
export const HDAYS = [0, 3, 7, 14] as const;
export const HLBL = ["지금", "+3일", "+7일", "+14일"] as const;
// 예보 신뢰도(표시용) — 승인 비주얼의 HCONF.
export const HCONF = [90, 84, 76, 66] as const;

export type AssetType = "port" | "choke" | "rail";

export type AssetRow = {
  id: string;
  name: string;
  type: AssetType;
  lon: number;
  lat: number;
  freeze_prone: boolean;
};

export type RiskRow = {
  asset_id: string;
  horizon_days: number;
  score: number;
  level: string;
  driver: string | null;
  wind_gust: number | null;
  wave_height: number | null;
  precip: number | null;
  snowfall: number | null;
  temp_min: number | null;
  is_freeze: boolean;
};

// routes.waypoints: ["shanghai",[60,8],"suez",...] — 문자열(asset id) 또는 [lon,lat].
export type RouteWaypoint = string | [number, number];

export type RouteRow = {
  id: string;
  name: string;
  waypoints: RouteWaypoint[];
  chokes: string[];
};

export type EventRow = {
  id: string;
  source: string;
  kind: string;
  title: string;
  severity: string;
  lon: number | null;
  lat: number | null;
  area: string | null;
  url: string | null;
};

export type ClimateRiskData = {
  assets: AssetRow[];
  risk: RiskRow[];
  routes: RouteRow[];
  events: EventRow[];
};

export const climateRiskQueryOptions = () =>
  queryOptions({
    queryKey: ["climate", "risk"],
    queryFn: () => getClimateRisk(),
    staleTime: 10 * 60 * 1000,
  });
