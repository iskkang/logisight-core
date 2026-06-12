import { queryOptions } from "@tanstack/react-query";

import { getOperationalCurrentDelay } from "./operational-delay.functions";

// 현재 운영 지연(정규화) — FESCO(zidk…) + TCR(hmg…) 두 소스의 집계 뷰를 앱에서 union.
export type OperationalCurrentDelay = {
  id: string;
  source_system: "FESCO" | "TCR";
  transport_mode: "TSR_RUSSIA_RAIL" | "CHINA_RAIL" | "CHINA_RAIL_TRUCK" | "UNKNOWN";
  route_family: "russia_tsr" | "china_rail" | "china_rail_truck";
  container_count: number;
  active_delayed_count: number;
  current_from?: string;
  current_to?: string;
  origin?: string;
  destination?: string;
  route_label: string;
  location_name?: string;
  segment_type?: "port" | "rail_hub" | "border" | "destination" | "corridor";
  max_delay_days?: number;
  median_delay_days?: number;
  p90_delay_days?: number;
  // FESCO 전용: alert_reason에서 파싱한 원본 기준 지연/도착예정일
  alert_delay_days?: number;
  original_expected_arrival_date?: string;
  current_eta?: string;
  last_checked_at?: string;
  data_quality: "confirmed" | "provisional" | "indicative";
  source_table: string;
};

// 소스별 연동 상태 — UI가 'TCR 미연동/0행/정상'을 명시하기 위함.
export type SourceState = "active" | "empty" | "view_missing" | "error";
export type SourceStatus = {
  source_system: "FESCO" | "TCR";
  state: SourceState;
  rows: number;
  message?: string;
};
export type OperationalDelayResult = {
  records: OperationalCurrentDelay[];
  sources: SourceStatus[];
};

export const operationalCurrentDelayQueryOptions = () =>
  queryOptions({
    queryKey: ["operational_current_delay"],
    queryFn: () => getOperationalCurrentDelay(),
    staleTime: 2 * 60 * 1000,
  });

export { getOperationalCurrentDelay };
