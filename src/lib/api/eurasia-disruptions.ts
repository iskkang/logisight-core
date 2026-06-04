import { queryOptions } from "@tanstack/react-query";
import {
  getEurasiaDisruptionsActive,
  upsertEurasiaDisruption,
  resolveEurasiaDisruption,
} from "./eurasia-disruptions.functions";

export type EurasiaDisruptionRow = {
  id: string;
  lane_id: string | null;
  segment: string;
  title: string;
  severity: "high" | "medium" | "low";
  delay_contribution_days: number | null;
  status: "active" | "resolved";
  started_at: string | null;
  resolved_at: string | null;
  source: string | null;
  confidence: "high" | "medium" | "low" | null;
  created_at: string | null;
};

export { upsertEurasiaDisruption, resolveEurasiaDisruption };

export const eurasiaDisruptionsActiveQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia_disruptions", "active"],
    queryFn: () => getEurasiaDisruptionsActive(),
    staleTime: 5 * 60 * 1000,
  });
