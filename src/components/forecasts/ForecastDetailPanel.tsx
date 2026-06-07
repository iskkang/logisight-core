import { useState } from "react";

import type { Forecast, ForecastSeries, ForecastOutcome } from "@/lib/api/forecasts";
import { ForecastSparkline } from "./ForecastSparkline";
import { DIR_META, routeName, sentences, dDay, mdLabel } from "./forecastUtils";

const OUTCOME: Record<ForecastOutcome, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-status-normal/10 text-status-normal" },
  partial: { label: "부분", cls: "bg-status-caution/10 text-status-caution" },
  miss: { label: "빗나감", cls: "bg-status-alert/10 text-status-alert" },
};

// E — 선택 타깃 큰 차트(전망 구간 구분선 + 콘) + lead/전환조건 + watch_points 캘린더.
export function ForecastDetailPanel({ f, series }: { f: Forecast; series: ForecastSeries | undefined }) {
  const [open, setOpen] = useState(false);
  const d = f.direction ? DIR_META[f.direction] : null;
  const sents = sentences(f.statement || "");
  const lead = sents[0] ?? "";
  const transition = sents.length > 1 ? sents[sents.length - 1] : "";

  return (
    <article className="rounded-xl border border-border bg-card p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {routeName(f)} · {f.cadence === "monthly" ? "월간" : "주간"}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            {d && <span className="text-2xl font-bold text-foreground/80">{d.glyph}</span>}
            <h3 className="text-2xl font-bold tracking-tight text-heading">
              {d ? d.label : "전망"}
              {f.expected_range_pct ? ` ${f.expected_range_pct}%` : ""}
            </h3>
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {f.horizon_date && <div>판정 {mdLabel(f.horizon_date)}</div>}
          {f.status === "resolved" && f.outcome ? (
            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 font-medium ${OUTCOME[f.outcome].cls}`}>
              {OUTCOME[f.outcome].label}
              {f.realized_pct != null ? ` ${f.realized_pct > 0 ? "+" : ""}${f.realized_pct}%` : ""}
            </span>
          ) : (
            <div className="mt-0.5">{dDay(f.horizon_date)}</div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* 큰 차트 */}
        <div>
          <ForecastSparkline
            series={series}
            valueAtPublish={f.metric_value_at_publish}
            rangeLowPct={f.range_low_pct}
            rangeHighPct={f.range_high_pct}
          />
          {lead && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lead}</p>}
        </div>

        {/* 우측: 전환 조건 + watch_points */}
        <div className="space-y-3">
          {transition && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">전환 조건</div>
              <p className="mt-1 rounded-lg bg-status-observe/10 px-3 py-2 text-sm leading-relaxed text-foreground">
                {transition}
              </p>
            </div>
          )}
          {f.watch_points && f.watch_points.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">확인 일정</div>
              <ul className="mt-1 space-y-1">
                {f.watch_points.map((w, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="w-10 shrink-0 tabular-nums font-medium text-status-observe">{mdLabel(w.due)}</span>
                    <span className="text-foreground">{w.source}</span>
                    <span className="truncate text-muted-foreground">{w.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        aria-expanded={open}
      >
        {open ? "전문 접기" : "분석 전문 보기"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap text-foreground">{f.statement}</p>
          {f.basis && f.basis.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {f.basis.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {f.status === "resolved" && f.outcome_note && (
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">복기: {f.outcome_note}</p>
          )}
        </div>
      )}
    </article>
  );
}
