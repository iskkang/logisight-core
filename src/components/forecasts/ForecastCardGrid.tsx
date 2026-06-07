import type { Forecast, ForecastSeries } from "@/lib/api/forecasts";
import { ForecastSparkline } from "./ForecastSparkline";
import {
  DIR_META,
  routeName,
  sentences,
  evidenceCount,
  nearestWatch,
  mdLabel,
} from "./forecastUtils";

type Props = {
  forecasts: Forecast[];
  series: Record<string, ForecastSeries>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ForecastCardGrid({ forecasts, series, selectedId, onSelect }: Props) {
  if (forecasts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        조건에 맞는 전망이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {forecasts.map((f) => {
        const d = f.direction ? DIR_META[f.direction] : null;
        const { present, total } = evidenceCount(f);
        const watch = nearestWatch(f);
        const lead = sentences(f.statement || "")[0] ?? "";
        const selected = f.id === selectedId;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className={`flex flex-col rounded-xl border bg-card p-3.5 text-left transition-colors ${
              selected ? "border-status-observe ring-1 ring-status-observe/40" : "border-border hover:border-status-observe/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-semibold text-heading">{routeName(f)}</span>
              {d && (
                <span className="shrink-0 rounded bg-status-observe/10 px-1.5 py-0.5 text-xs font-medium text-status-observe">
                  {d.glyph} {f.direction === "flat" ? "보합권" : ""}
                  {f.expected_range_pct ? ` ${f.expected_range_pct}%` : ""}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              근거 {present}/{total}
              <span className="flex gap-0.5" aria-hidden>
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < present ? "bg-status-observe" : "bg-muted-foreground/30"}`} />
                ))}
              </span>
            </div>

            <div className="mt-2">
              <ForecastSparkline
                series={series[f.id]}
                valueAtPublish={f.metric_value_at_publish}
                rangeLowPct={f.range_low_pct}
                rangeHighPct={f.range_high_pct}
                mini
              />
            </div>

            {watch && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                다음 확인 · {mdLabel(watch.due)} {watch.source}
              </div>
            )}
            {lead && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{lead}</p>}
          </button>
        );
      })}
    </div>
  );
}
