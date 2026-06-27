import { queryOptions } from "@tanstack/react-query";

import { getEurasiaCharts } from "./eurasia-charts.functions";

export type {
  EurasiaCharts,
  IndexQuotes,
  ChartSection,
  ChartDataset,
  LabelInfo,
  GeoPayload,
  GeoItem,
} from "./eurasia-charts.functions";

export const eurasiaChartsQueryOptions = () =>
  queryOptions({
    queryKey: ["eurasia_charts"],
    queryFn: () => getEurasiaCharts(),
    staleTime: 30 * 60 * 1000,
  });
