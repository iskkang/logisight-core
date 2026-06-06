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

// SSR-safe: screen state is derived solely from the URL query — no per-user
// state, no localStorage. All visitors with the same URL see the same screen.
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
  const filters = resolveFilters(currentSearch);

  function setFilters(patch: Partial<GlobalFilters>) {
    const next = { ...filters, ...patch };
    navigate({ search: next as Record<string, string | undefined>, replace: true });
  }

  return { filters, setFilters };
}
