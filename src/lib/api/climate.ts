import { queryOptions } from "@tanstack/react-query";

import { getClimateRisk } from "./climate.functions";

// 예보 시점 — asset_risk.horizon_days 의 부분집합. 14일은 해상 파고가 장기예보 미제공(모델 한계)이라
// 표시에서 제외(7일까지만 신뢰 가능한 예보). asset_risk엔 14일 행이 남아 있어도 화면·품질평가는 0/3/7만 사용.
export const HDAYS = [0, 3, 7] as const;
export const HLBL = ["지금", "+3일", "+7일"] as const;
// 예보 신뢰도(표시용) — 승인 비주얼의 HCONF.
export const HCONF = [90, 84, 76] as const;

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
  updated_at: string | null;
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
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string | null;
  track: unknown;
};

// 발행된 기후 영향 AI 분석(forecasts module='climate', status='published').
// metric_ref='climate:<route>:<event>:<via>'. statement=3단 본문, basis에 걸린 관문 등 맥락.
export type ClimateForecastRow = {
  id: string;
  metric_ref: string | null;
  statement: string;
  impact_note: string | null;
  basis: string[] | null;
  confidence: string | null;
  confidence_reason: string | null;
  data_quality_flags: string[] | null;
  published_at: string | null;
};

export type ClimateRiskData = {
  assets: AssetRow[];
  risk: RiskRow[];
  routes: RouteRow[];
  events: EventRow[];
  forecasts: ClimateForecastRow[];
};

export const climateRiskQueryOptions = () =>
  queryOptions({
    queryKey: ["climate", "risk"],
    queryFn: () => getClimateRisk(),
    staleTime: 10 * 60 * 1000,
  });
