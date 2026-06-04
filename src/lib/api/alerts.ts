import { queryOptions } from "@tanstack/react-query";
import { getAlertCandidates } from "./alerts.functions";
export type { AlertCandidate } from "@/server/alerts";

export const alertCandidatesQueryOptions = () =>
  queryOptions({
    queryKey: ["alert_candidates"],
    queryFn: () => getAlertCandidates(),
    staleTime: 15 * 60 * 1000,
  });
