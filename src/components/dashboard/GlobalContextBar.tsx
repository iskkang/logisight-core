import type { GlobalFilters } from "@/hooks/useGlobalFilters";

type Props = {
  filters: GlobalFilters;
  onChange: (patch: Partial<GlobalFilters>) => void;
  collapsed?: boolean;
};

const PERIODS: { value: GlobalFilters["period"]; label: string }[] = [
  { value: "3m", label: "3개월" },
  { value: "12m", label: "12개월" },
  { value: "36m", label: "36개월" },
];

const MODES: { value: GlobalFilters["mode"]; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "ocean", label: "해상" },
  { value: "air", label: "항공" },
  { value: "rail", label: "철도" },
];

const CURRENCIES: { value: GlobalFilters["currency"]; label: string }[] = [
  { value: "USD", label: "USD" },
  { value: "KRW", label: "KRW" },
];

export function GlobalContextBar({ filters, onChange, collapsed = false }: Props) {
  if (collapsed) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/70">필터</span>
        <span>{PERIODS.find((p) => p.value === filters.period)?.label}</span>
        <span>·</span>
        <span>{MODES.find((m) => m.value === filters.mode)?.label}</span>
        <span>·</span>
        <span>{filters.origin}</span>
        <span>·</span>
        <span>{filters.currency}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted/30 px-4 py-3">
      <FilterGroup
        label="기간"
        options={PERIODS}
        value={filters.period}
        onChange={(v) => onChange({ period: v as GlobalFilters["period"] })}
      />
      <FilterGroup
        label="수송모드"
        options={MODES}
        value={filters.mode}
        onChange={(v) => onChange({ mode: v as GlobalFilters["mode"] })}
      />
      <FilterGroup
        label="통화"
        options={CURRENCIES}
        value={filters.currency}
        onChange={(v) => onChange({ currency: v as GlobalFilters["currency"] })}
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">출발지</span>
        <input
          type="text"
          value={filters.origin}
          onChange={(e) => onChange({ origin: e.target.value.toUpperCase() })}
          placeholder="KR"
          maxLength={3}
          className="h-7 w-14 rounded border border-border bg-background px-2 text-xs font-mono text-center uppercase outline-none focus:border-ring"
        />
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className="flex rounded-md border border-border overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "px-2.5 py-1 text-xs transition-colors",
              value === opt.value
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-background text-muted-foreground hover:bg-muted",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
