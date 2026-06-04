import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export type GlobalFilters = {
  period: "3m" | "12m" | "36m";
  origin: string;
  dest?: string;
  mode: "ocean" | "air" | "rail" | "all";
  hs?: string;
  currency: "USD" | "KRW";
  compare?: string;
  detail?: string;
};

const DEFAULTS: GlobalFilters = {
  period: "12m",
  origin: "KR",
  mode: "all",
  currency: "USD",
};

const STORAGE_KEY = "logisight:global-filters";

// SSR-safe: only uses URL params, no localStorage access during render
export function resolveFilters(s: Record<string, unknown>): GlobalFilters {
  const period = (["3m", "12m", "36m"] as const).includes(s.period as "3m" | "12m" | "36m")
    ? (s.period as GlobalFilters["period"])
    : DEFAULTS.period;

  const mode = (["ocean", "air", "rail", "all"] as const).includes(s.mode as "ocean" | "air" | "rail" | "all")
    ? (s.mode as GlobalFilters["mode"])
    : DEFAULTS.mode;

  const currency = (["USD", "KRW"] as const).includes(s.currency as "USD" | "KRW")
    ? (s.currency as GlobalFilters["currency"])
    : DEFAULTS.currency;

  return {
    period,
    origin: typeof s.origin === "string" && s.origin ? s.origin : DEFAULTS.origin,
    dest: typeof s.dest === "string" ? s.dest : undefined,
    mode,
    hs: typeof s.hs === "string" ? s.hs : undefined,
    currency,
    compare: typeof s.compare === "string" ? s.compare : undefined,
    detail: typeof s.detail === "string" ? s.detail : undefined,
  };
}

export function useGlobalFilters(currentSearch: Record<string, unknown>) {
  const navigate = useNavigate();
  const [filters, setFiltersState] = useState<GlobalFilters>(() =>
    resolveFilters(currentSearch),
  );

  // After hydration, merge with localStorage backup (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<GlobalFilters>;
      // Only apply stored values if URL has no overrides
      const hasUrlParams = Object.keys(currentSearch).some(
        (k) => k in DEFAULTS && currentSearch[k] !== undefined,
      );
      if (!hasUrlParams) {
        setFiltersState((prev) => resolveFilters({ ...stored, ...prev }));
      }
    } catch {
      // ignore
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilters(patch: Partial<GlobalFilters>) {
    const next = { ...filters, ...patch };
    setFiltersState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage quota or SSR — ignore
    }
    navigate({ search: next as Record<string, string | undefined>, replace: true });
  }

  return { filters, setFilters };
}
