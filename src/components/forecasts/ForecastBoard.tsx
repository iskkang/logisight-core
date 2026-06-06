import type { Forecast } from "@/lib/api/forecasts";
import { routeName } from "./ForecastCardV2";

// 전체가 3초에 들어오는 층: 타깃별 타일(노선 · 큰 방향 글리프 · 범위 · 근거 N/5 · D-n).
// 클릭 시 해당 카드로 스크롤. 방향 글리프 중립색.
const DIR: Record<string, { glyph: string; label: string }> = {
  up: { glyph: "▲", label: "" },
  down: { glyph: "▼", label: "" },
  flat: { glyph: "▬", label: "보합권" },
};

function dDay(horizon: string | null | undefined): string | null {
  if (!horizon) return null;
  const d = Math.round((Date.parse(`${horizon}T00:00:00Z`) - Date.now()) / 86400000);
  return d >= 0 ? `D-${d}` : `D+${-d}`;
}

export function ForecastBoard({ forecasts }: { forecasts: Forecast[] }) {
  if (forecasts.length === 0) return null;
  const scrollTo = (id: string) => {
    document.getElementById(`fc-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {forecasts.map((f) => {
        const d = f.direction ? DIR[f.direction] : null;
        const present = (f.factor_scores ?? []).filter((x) => !x.missing && x.score != null).length;
        const total = (f.factor_scores ?? []).length || 5;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => scrollTo(f.id)}
            className="rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-status-observe/60"
          >
            <div className="truncate text-xs text-muted-foreground">{routeName(f)}</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              {d && <span className="text-lg font-bold text-foreground/80">{d.glyph}</span>}
              <span className="text-lg font-bold tracking-tight text-heading">
                {f.direction === "flat" ? "보합권" : f.expected_range_pct ? `${f.expected_range_pct}%` : "—"}
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              근거 {present}/{total}
              {f.horizon_date ? ` · ${dDay(f.horizon_date)} 판정` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
