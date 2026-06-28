import { queryOptions } from "@tanstack/react-query";

import { getEurasiaRailBrief } from "./eurasia-rail-brief.functions";

export type { RailBrief, RailBriefAction, RailBriefRisk } from "./eurasia-rail-brief.functions";

export const eurasiaRailBriefQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia-rail-brief"],
    queryFn: () => getEurasiaRailBrief(),
    staleTime: 5 * 60 * 1000,
  });
