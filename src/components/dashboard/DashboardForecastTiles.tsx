import { Link } from "@tanstack/react-router";

import type { Forecast, ForecastSeries } from "@/lib/api/forecasts";
import { ForecastSparkline } from "@/components/forecasts/ForecastSparkline";
import {
  DIR_META,
  dirCls,
  displayLabelOf,
  displayOrderOf,
  evidenceCount,
} from "@/components/forecasts/forecastUtils";

// 미니 전망 타일 3 — 확정 순서(displayOrder) 상위 3 + 방향 토큰 + 근거 N/5 + 미니 스파크 + /forecasts 링크.
export function DashboardForecastTiles({
  forecasts,
  series,
}: {
  forecasts: Forecast[];
  series: Record<string, ForecastSeries>;
}) {
  const tiles = [...forecasts]
    .filter((f) => f.status === "published")
    .sort((a, b) => displayOrderOf(a) - displayOrderOf(b))
    .slice(0, 3);
  if (tiles.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">주요 지수 전망</h2>
        <Link to="/forecasts" search={{ dir: [], series: [] }} className="text-[11px] text-muted-foreground hover:underline">
          전망 보드 ↗
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((f) => {
          const d = f.direction ? DIR_META[f.direction] : null;
          const dc = dirCls(f.direction);
          const { present, total } = evidenceCount(f);
          return (
            <Link
              key={f.id}
              to="/forecasts"
              search={{ dir: [], series: [], sel: f.id }}
              className="flex flex-col rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-status-observe/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-semibold text-heading">{displayLabelOf(f)}</span>
                {d && (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${dc.badge}`}>
                    {d.glyph}
                    {f.expected_range_pct ? ` ${f.expected_range_pct}%` : ""}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <ForecastSparkline
                  series={series[f.id]}
                  valueAtPublish={f.metric_value_at_publish}
                  rangeLowPct={f.range_low_pct}
                  rangeHighPct={f.range_high_pct}
                  colorClass={dc.spark}
                  mini
                />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                근거 {present}/{total}
                <span className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: total }).map((_, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < present ? "bg-foreground/60" : "bg-muted-foreground/30"}`} />
                  ))}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
