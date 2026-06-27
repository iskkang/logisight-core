import { queryOptions } from "@tanstack/react-query";

import { getIndex1520Routes } from "./index1520-routes.functions";

export const index1520RoutesQueryOptions = (period?: string) =>
  queryOptions({
    queryKey: ["index1520-routes", period ?? "latest"],
    queryFn: () => getIndex1520Routes({ data: period }),
    staleTime: 5 * 60 * 1000,
  });
