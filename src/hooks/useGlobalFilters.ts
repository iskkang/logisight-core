import { useNavigate, useSearch } from "@tanstack/react-router";

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

export function resolveFilters(s: Record<string, unknown>): GlobalFilters {
  const stored = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as Partial<GlobalFilters>) : {};
    } catch {
      return {};
    }
  })();

  const merge = { ...DEFAULTS, ...stored, ...s };

  const period = (["3m", "12m", "36m"] as const).includes(merge.period as "3m" | "12m" | "36m")
    ? (merge.period as GlobalFilters["period"])
    : DEFAULTS.period;

  const mode = (["ocean", "air", "rail", "all"] as const).includes(merge.mode as "ocean" | "air" | "rail" | "all")
    ? (merge.mode as GlobalFilters["mode"])
    : DEFAULTS.mode;

  const currency = (["USD", "KRW"] as const).includes(merge.currency as "USD" | "KRW")
    ? (merge.currency as GlobalFilters["currency"])
    : DEFAULTS.currency;

  return {
    period,
    origin: typeof merge.origin === "string" && merge.origin ? merge.origin : DEFAULTS.origin,
    dest: typeof merge.dest === "string" ? merge.dest : undefined,
    mode,
    hs: typeof merge.hs === "string" ? merge.hs : undefined,
    currency,
    compare: typeof merge.compare === "string" ? merge.compare : undefined,
    detail: typeof merge.detail === "string" ? merge.detail : undefined,
  };
}

export function useGlobalFilters(currentSearch: Record<string, unknown>) {
  const navigate = useNavigate();
  const filters = resolveFilters(currentSearch);

  function setFilters(patch: Partial<GlobalFilters>) {
    const next = { ...filters, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage quota or SSR — ignore
    }
    navigate({ search: next as Record<string, string | undefined>, replace: true });
  }

  return { filters, setFilters };
}
