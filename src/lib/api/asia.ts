import { queryOptions } from "@tanstack/react-query";

import { getAsiaThroughput } from "./asia.functions";

export const asiaThroughputQueryOptions = (months: number) =>
  queryOptions({
    queryKey: ["port_throughput", "asia", months],
    queryFn: () => getAsiaThroughput({ data: { months } }),
    staleTime: 30 * 60 * 1000,
  });
