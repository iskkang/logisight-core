import {
  DIR_META,
  SERIES_LABEL,
  type ForecastFilter,
  type SeriesClass,
} from "./forecastUtils";

type Props = {
  value: ForecastFilter;
  onChange: (next: ForecastFilter) => void;
  seriesCounts: Record<string, number>;
};

const SERIES_ORDER: SeriesClass[] = ["KITA", "KCCI", "SCFI", "WCI"];

export function ForecastFilters({ value, onChange, seriesCounts }: Props) {
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const active = value.cadence || value.dir.length > 0 || value.series.length > 0;

  return (
    <aside className="space-y-5 text-sm">
      <h2 className="text-sm font-semibold text-foreground">필터</h2>

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">기간</div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["weekly", "monthly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, cadence: value.cadence === c ? undefined : c })}
              className={`rounded-md px-3 py-1 text-xs ${value.cadence === c ? "bg-status-observe/15 font-medium text-status-observe" : "text-muted-foreground"}`}
            >
              {c === "weekly" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">방향</div>
        <div className="space-y-1">
          {(["up", "flat", "down"] as const).map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={value.dir.includes(d)}
                onChange={() => onChange({ ...value, dir: toggle(value.dir, d) })}
                className="accent-status-observe"
              />
              <span className="text-foreground/60">{DIR_META[d].glyph}</span>
              <span className="text-foreground">{DIR_META[d].label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">지표 계열</div>
        <div className="space-y-1">
          {SERIES_ORDER.filter((s) => (seriesCounts[s] ?? 0) > 0).map((s) => (
            <label key={s} className="flex cursor-pointer items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value.series.includes(s)}
                  onChange={() => onChange({ ...value, series: toggle(value.series, s) })}
                  className="accent-status-observe"
                />
                <span className="text-foreground">{SERIES_LABEL[s]}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">{seriesCounts[s]}</span>
            </label>
          ))}
        </div>
      </div>

      {active && (
        <button
          type="button"
          onClick={() => onChange({ cadence: undefined, dir: [], series: [] })}
          className="text-xs text-status-observe hover:underline"
        >
          ↺ 필터 초기화
        </button>
      )}
    </aside>
  );
}
