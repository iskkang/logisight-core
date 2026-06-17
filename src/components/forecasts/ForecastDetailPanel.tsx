import type { Forecast, ForecastSeries, ForecastOutcome } from "@/lib/api/forecasts";
import { ForecastSparkline } from "./ForecastSparkline";
import { DIR_META, dirCls, displayLabelOf, baseIndexCaption, sentences, dDay, mdLabel, directionStrength } from "./forecastUtils";

const OUTCOME: Record<ForecastOutcome, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-status-normal/10 text-status-normal" },
  partial: { label: "부분", cls: "bg-status-caution/10 text-status-caution" },
  miss: { label: "빗나감", cls: "bg-status-alert/10 text-status-alert" },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</div>;
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
      <div className="relative shrink-0">
        <svg viewBox="0 0 100 100" className="h-[72px] w-[72px] -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" className="stroke-border" strokeWidth="9" />
          <circle cx="50" cy="50" r={R} fill="none" style={{ stroke }} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums" style={{ color: stroke }}>
          {pct}%
        </span>
      </div>
      <div>
        <div className="text-xl font-bold leading-tight" style={{ color: stroke }}>
          {label} 우세
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
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
  const dirColor = `var(--direction-${f.direction ?? "flat"})`;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* 헤더 밴드 — 방향색 좌측 액센트 + 타이틀 + 판정 배지 */}
      <div className="relative flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4 lg:px-6">
        <span className="pointer-events-none absolute inset-y-0 left-0 w-1" style={{ background: dirColor }} aria-hidden />
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {displayLabelOf(f)} · {f.cadence === "monthly" ? "월간" : "주간"}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            {d && <span className={`text-[26px] font-extrabold leading-none ${dc.text}`}>{d.glyph}</span>}
            <h3 className={`text-[26px] font-extrabold leading-none tracking-tight ${d ? dc.text : "text-heading"}`}>
              {d ? d.label : "전망"}
              {f.expected_range_pct ? ` ${f.expected_range_pct}%` : ""}
            </h3>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {f.status === "resolved" && f.outcome ? (
            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME[f.outcome].cls}`}>
              {OUTCOME[f.outcome].label}
              {f.realized_pct != null ? ` ${f.realized_pct > 0 ? "+" : ""}${f.realized_pct}%` : ""}
            </span>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {f.horizon_date && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                  판정 {mdLabel(f.horizon_date)}
                </span>
              )}
              <span className="text-[11px] font-semibold text-muted-foreground">{dDay(f.horizon_date)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 본문 — 그래프(좁게) | 종합 신호 + 핵심 인사이트, 구획선으로 분리 */}
      <div className="grid lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* 왼쪽: 그래프(인셋 패널, 가로 축소) */}
        <div className="border-b border-border/60 p-5 lg:border-b-0 lg:border-r lg:p-6">
          <div className="rounded-xl bg-muted/30 p-3">
            <ForecastSparkline
              series={series}
              valueAtPublish={f.metric_value_at_publish}
              rangeLowPct={f.range_low_pct}
              rangeHighPct={f.range_high_pct}
              colorClass={dc.spark}
            />
          </div>
          {caption && <p className="mt-2 text-[11px] text-muted-foreground/70">{caption}</p>}
        </div>

        {/* 오른쪽: 종합 신호 + 핵심 인사이트 */}
        <div className="p-5 lg:p-6">
          <div>
            <SectionLabel>종합 신호</SectionLabel>
            <DirectionDonut score={f.composite_score} direction={f.direction} />
          </div>
          {insights.length > 0 && (
            <div className="mt-5 border-t border-border/60 pt-4">
              <SectionLabel>핵심 인사이트</SectionLabel>
              <ul className="space-y-2.5">
                {insights.map((s, i) => (
                  <li
                    key={i}
                    className={`flex gap-2.5 leading-relaxed ${i === 0 ? "text-[15px] font-medium text-foreground" : "text-sm text-muted-foreground"}`}
                  >
                    <span
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: i === 0 ? dirColor : "var(--border)" }}
                      aria-hidden
                    />
                    <span>{s}</span>
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
