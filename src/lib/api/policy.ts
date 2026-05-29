import { queryOptions } from "@tanstack/react-query";

import {
  getActivePolicyAlerts,
  getPolicyRelatedNews,
} from "./policy.functions";

export type PolicyAlertRow = {
  id: string;
  code: string;
  title: string;
  meta: string | null;
  is_active: boolean | null;
  display_order: number | null;
};

export type PolicyNewsItem = {
  id: number;
  slug: string | null;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  published_at: string | null;
  tags: string[] | null;
};

export const policyAlertsQueryOptions = () =>
  queryOptions({
    queryKey: ["policy_alerts", "active"],
    queryFn: () => getActivePolicyAlerts(),
    staleTime: 5 * 60 * 1000,
  });

export const policyRelatedNewsQueryOptions = () =>
  queryOptions({
    queryKey: ["policy_alerts", "related_news"],
    queryFn: () => getPolicyRelatedNews(),
    staleTime: 5 * 60 * 1000,
  });

export function formatPublishedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

export type CodeStyle = { badge: string; dot: string };

export function codeStyle(code: string): CodeStyle {
  const c = code.trim().toUpperCase();
  if (c === "CBAM") return { badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" };
  if (c === "EU ETS" || c === "EU-ETS" || c === "ETS")
    return { badge: "bg-blue-100 text-blue-800", dot: "bg-blue-500" };
  if (code.includes("제재")) return { badge: "bg-rose-100 text-rose-800", dot: "bg-rose-500" };
  if (c === "EAR") return { badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" };
  if (code.includes("전략물자"))
    return { badge: "bg-purple-100 text-purple-800", dot: "bg-purple-500" };
  return { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
}

export const CODE_DESCRIPTIONS: { code: string; desc: string }[] = [
  { code: "CBAM", desc: "EU 탄소국경조정제도(수입품 배출량 보고·조정)" },
  { code: "EU ETS", desc: "EU 해운 탄소배출권 거래제(선사 의무 부담)" },
  { code: "제재", desc: "대러·대이란·대북 수출통제 및 금융 제재" },
  { code: "EAR", desc: "美 수출관리규정(이중용도·재수출 통제)" },
  { code: "전략물자", desc: "한국 전략물자 수출허가·캐치올 통제" },
];