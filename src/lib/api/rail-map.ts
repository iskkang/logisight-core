import { queryOptions } from "@tanstack/react-query";

import { getRailCorridorsGeoJSON } from "./rail-map.functions";

export const railMapQueryOptions = () =>
  queryOptions({
    queryKey: ["rail-map", "corridors-geojson"],
    queryFn: () => getRailCorridorsGeoJSON(),
    staleTime: 5 * 60 * 1000,
  });
