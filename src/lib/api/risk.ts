import { queryOptions } from "@tanstack/react-query";

import { getRiskSnapshot } from "./risk.functions";

export type SourceHealth = {
  source: string;
  ok: boolean;
  message?: string;
  asOf: string | null;
};

export type PortRiskRow = {
  rank: number | null;
  name: string;
  locode: string | null;
  country: string | null;
  region: string | null;
  delayPercent: number | null;
  congestion: number | null;
  importDwell: number | null;
  exportDwell: number | null;
  transshipDwell: number | null;
  turnaround: number | null;
  vesselsBerthed: number | null;
  schedule: number | null;
  importTeu: number | null;
  exportTeu: number | null;
  importTeuMom: number | null;
  exportTeuMom: number | null;
  globalTrade: number | null;
};

export type DirectionFlow = {
  code: string;
  name: string;
  value: number | null;
};

export type ChokepointRiskRow = {
  name: string;
  asOf: string | null;
  latestTotalTeu: number | null;
  previousTotalTeu: number | null;
  wowPct: number | null;
  avg8w: number | null;
  latestCrossings: number;
  topCrossingName: string | null;
  topCrossingTeu: number | null;
  directions: DirectionFlow[];
  spark: (number | null)[];
  sourceUrl: string;
};

export type MacroRiskRow = {
  label: string;
  asOf: string | null;
  value: number | null;
  change: string | null;
  spark: (number | null)[];
};

export type AiRiskBriefing = {
  analysisReport: string;
  coreTags: string[];
  generatedAt: string | null;
};

export type NewsRiskRow = {
  title: string;
  source: string | null;
  url: string | null;
  publishedAt: string | null;
  summary: string | null;
};

export type HormuzRisk = {
  asOf: string | null;
  gulfShipCount: number | null;
  gulfShipWowPct: number | null;
  gulfShipSpark: (number | null)[];
  crossingDate: string;
  crossingCount: number;
  eastbound: number;
  westbound: number;
  tankerCount: number;
  bulkCount: number;
  totalDwt: number | null;
  macro: MacroRiskRow[];
  news: NewsRiskRow[];
  aiRiskBriefing?: AiRiskBriefing | null;
};

export type MacroTrend = {
  label: string;
  asOf: string | null;
  latest: number | null;
  previous: number | null;
  changePct: number | null;
  spark: (number | null)[];
  source: string;
};

export type RiskSnapshot = {
  fetchedAt: string;
  sourceHealth: SourceHealth[];
  ports: PortRiskRow[];
  chokepoints: ChokepointRiskRow[];
  hormuz: HormuzRisk;
  macroTrends: MacroTrend[];
};

export const riskSnapshotQueryOptions = () =>
  queryOptions({
    queryKey: ["risk-snapshot"],
    queryFn: () => getRiskSnapshot(),
    staleTime: 15 * 60 * 1000,
  });
