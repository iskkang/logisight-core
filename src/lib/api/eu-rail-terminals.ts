import { queryOptions } from "@tanstack/react-query";

import { getEuRailTerminals } from "./eu-rail-terminals.functions";

export type { EuRailTerminal } from "./eu-rail-terminals.functions";

export const euRailTerminalsQueryOptions = () =>
  queryOptions({
    queryKey: ["eu-rail-terminals"],
    queryFn: () => getEuRailTerminals(),
    staleTime: 60 * 60 * 1000,
  });
