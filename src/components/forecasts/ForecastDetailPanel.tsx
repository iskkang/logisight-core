import type { Forecast, ForecastSeries, ForecastOutcome } from "@/lib/api/forecasts";
import { ForecastSparkline } from "./ForecastSparkline";
import { DIR_META, dirCls, displayLabelOf, baseIndexCaption, sentences, dDay, mdLabel, directionStrength } from "./forecastUtils";

const OUTCOME: Record<ForecastOutcome, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-status-normal/10 text-status-normal" },
  partial: { label: "부분", cls: "bg-status-caution/10 text-status-caution" },
  miss: { label: "빗나감", cls: "bg-status-alert/10 text-status-alert" },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

// 방향 강도 도넛(확률 아님 — composite |점수|/2). 링 색 = 방향(상승 적/하락 녹/보합 황).
function DirectionDonut({ score, direction }: { score: number | null | undefined; direction: string | null | undefined }) {
  const { dir, pct, label } = directionStrength(score, direction);
  const stroke = `var(--direction-${dir})`;
  const R = 40;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" className="stroke-border" strokeWidth="10" />
        <circle cx="50" cy="50" r={R} fill="none" style={{ stroke }} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} />
      </svg>
      <div>
        <div className="text-2xl font-bold" style={{ color: stroke }}>
          {label} {pct}%
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          종합 {score != null ? `${score > 0 ? "+" : ""}${score}` : "—"} · |점수|/2 환산
        </div>
      </div>
    </div>
  );
}

// 선택 타깃 통합 카드: 그래프(가로 축소) + 종합 신호 + 핵심 인사이트 한 장.
export function ForecastDetailPanel({ f, series }: { f: Forecast; series: ForecastSeries | undefined }) {
  const d = f.direction ? DIR_META[f.direction] : null;
  const dc = dirCls(f.direction);
  const caption = baseIndexCaption(f);
  const insights = sentences(f.statement || "").slice(0, 4);

  return (
    <article className="rounded-xl border border-border bg-card p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {displayLabelOf(f)} · {f.cadence === "monthly" ? "월간" : "주간"}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            {d && <span className={`text-2xl font-bold ${dc.text}`}>{d.glyph}</span>}
            <h3 className={`text-2xl font-bold tracking-tight ${d ? dc.text : "text-heading"}`}>
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

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* 왼쪽: 그래프(가로 축소) */}
        <div>
          <ForecastSparkline
            series={series}
            valueAtPublish={f.metric_value_at_publish}
            rangeLowPct={f.range_low_pct}
            rangeHighPct={f.range_high_pct}
            colorClass={dc.spark}
          />
          {caption && <p className="mt-1 text-[11px] text-muted-foreground/70">{caption}</p>}
        </div>

        {/* 오른쪽: 종합 신호 + 핵심 인사이트 */}
        <div className="space-y-5">
          <div>
            <SectionLabel>종합 신호</SectionLabel>
            <DirectionDonut score={f.composite_score} direction={f.direction} />
          </div>
          {insights.length > 0 && (
            <div>
              <SectionLabel>핵심 인사이트</SectionLabel>
              <ul className="space-y-1.5">
                {insights.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
