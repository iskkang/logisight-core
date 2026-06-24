import { queryOptions } from "@tanstack/react-query";

import { getReports } from "./reports.functions";

export type Report = {
  id: string;
  type: "weekly" | "monthly";
  period_start: string; // 'YYYY-MM-DD'
  period_end: string; // 'YYYY-MM-DD'
  period_label: string; // '25주차 · 06.15–06.21' | '2026년 5월호'
  title: string;
  summary: string | null;
  pdf_url: string;
  web_url: string | null; // null → "웹으로 보기" 숨김
  cover_url: string | null;
  published_at: string | null;
};

export type ReportsBundle = {
  weekly: Report | null;
  monthly: Report | null;
  archive: Report[];
};

export const reportsQueryOptions = () =>
  queryOptions({
    queryKey: ["reports", "landing"],
    queryFn: () => getReports(),
    staleTime: 5 * 60 * 1000,
  });
