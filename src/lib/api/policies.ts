import { queryOptions } from "@tanstack/react-query";
import { getPolicies, upsertPolicy } from "./policies.functions";

export type PolicyRow = {
  id: string;
  title_ko: string;
  title_en: string | null;
  country_code: string | null;
  region: string | null;
  policy_type: string;
  effective_date: string | null;
  expiry_date: string | null;
  severity: "high" | "medium" | "low" | "info";
  status: "active" | "expired" | "draft";
  summary_ko: string | null;
  summary_en: string | null;
  affected_hs_chapters: string[] | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export { upsertPolicy };

export const policiesQueryOptions = () =>
  queryOptions({
    queryKey: ["policies"],
    queryFn: () => getPolicies(),
    staleTime: 15 * 60 * 1000,
  });
