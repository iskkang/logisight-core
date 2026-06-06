import { useState } from "react";

import {
  type Forecast,
  type ForecastSeries,
  type ForecastOutcome,
  MODULE_LABEL,
} from "@/lib/api/forecasts";
import { ForecastSparkline } from "./ForecastSparkline";

// 방향 글리프는 중립색(적·녹은 위험 상태 전용). 콘·게이지·바는 단일 청색.
const DIR = {
  up: { glyph: "▲", label: "상승" },
  down: { glyph: "▼", label: "하락" },
  flat: { glyph: "▬", label: "보합권" },
} as const;

const FACTOR_LABEL: Record<string, string> = {
  momentum: "모멘텀",
  supply: "공급",
  demand: "수요",
  cost: "비용",
  pricing: "가격행동",
};
const MISSING_LABEL: Record<string, string> = {
  cost: "유가",
  pricing: "운임공시",
  demand: "수요",
  supply: "공급",
  momentum: "모멘텀",
};
const OUTCOME: Record<ForecastOutcome, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-status-normal/10 text-status-normal" },
  partial: { label: "부분", cls: "bg-status-caution/10 text-status-caution" },
  miss: { label: "빗나감", cls: "bg-status-alert/10 text-status-alert" },
};

// statement → 첫 문장(lead)·끝 문장(outlook) 폴백(v1.5 lead/outlook 필드 신설 전까지).
function sentences(s: string): string[] {
  return s.split(/(?<=[.!?。])\s+/).map((x) => x.trim()).filter(Boolean);
}
function dDay(horizon: string | null | undefined): string | null {
  if (!horizon) return null;
  const d = Math.round((Date.parse(`${horizon}T00:00:00Z`) - Date.now()) / 86400000);
  return d >= 0 ? `D-${d}` : `D+${-d}`;
}
const mdLabel = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function ForecastCardV2({ f, series }: { f: Forecast; series: ForecastSeries | undefined }) {
  const [open, setOpen] = useState(false);
  const dir = f.direction ? DIR[f.direction] : null;
  const sents = sentences(f.statement || "");
  const lead = sents[0] ?? "";
  const outlook = sents.length > 1 ? sents[sents.length - 1] : "";

  const factors = (f.factor_scores ?? []).filter((x) => !x.missing && x.score != null && x.score !== 0);
  const present = (f.factor_scores ?? []).filter((x) => !x.missing && x.score != null).length;
  const total = (f.factor_scores ?? []).length || 5;
  const missingNames = (f.factor_scores ?? [])
    .filter((x) => x.missing)
    .map((x) => MISSING_LABEL[x.factor] ?? x.factor);
  const chinaAdj = (f.data_quality_flags ?? []).some((s) => /중국 수급 보정/.test(s));

  return (
    <article
      id={`fc-${f.id}`}
      className="scroll-mt-20 rounded-xl border border-border bg-card p-5 lg:p-6"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {f.basis && f.basis[0] ? routeName(f) : MODULE_LABEL[f.module]} ·{" "}
          {f.cadence === "monthly" ? "월간" : "주간"}
        </div>
        <div className="text-xs text-muted-foreground">
          {f.horizon_date && <>판정 {mdLabel(f.horizon_date)} · </>}
          {f.status === "resolved" && f.outcome ? (
            <span className={`rounded px-1.5 py-0.5 font-medium ${OUTCOME[f.outcome].cls}`}>
              {OUTCOME[f.outcome].label}
              {f.realized_pct != null ? ` ${f.realized_pct > 0 ? "+" : ""}${f.realized_pct}%` : ""}
            </span>
          ) : (
            dDay(f.horizon_date)
          )}
        </div>
      </div>

      {/* 큰 판정줄 — 글리프 중립색 */}
      <div className="mt-1 flex items-baseline gap-2">
        {dir && <span className="text-2xl font-bold text-foreground/80">{dir.glyph}</span>}
        <h3 className="text-2xl font-bold tracking-tight text-heading">
          {dir ? dir.label : "전망"}
          {f.expected_range_pct ? ` ${f.expected_range_pct}%` : ""}
        </h3>
      </div>
      {lead && <p className="mt-1 text-sm text-muted-foreground">{lead}</p>}

      {/* 스파크라인 + 콘 */}
      <div className="mt-3">
        <ForecastSparkline
          series={series}
          valueAtPublish={f.metric_value_at_publish}
          rangeLowPct={f.range_low_pct}
          rangeHighPct={f.range_high_pct}
        />
      </div>

      {/* outlook 한 줄 박스 */}
      {outlook && (
        <p className="mt-2 rounded-lg bg-status-observe/10 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
          {outlook}
        </p>
      )}

      {/* 근거 데이터 N/5 게이지 + 결측 항목명 */}
      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">근거 데이터 {present}/{total}</span>
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full border ${
                i < present ? "border-status-observe bg-status-observe" : "border-muted-foreground/40"
              }`}
            />
          ))}
        </span>
        {missingNames.length > 0 && (
          <span className="text-muted-foreground/80">{missingNames.join("·")} 결측</span>
        )}
      </div>

      {/* 팩터 기여 미니 바(0점·결측 비표시), 단일 청색 */}
      <div className="mt-3 space-y-1.5">
        {factors.map((x) => (
          <div key={x.factor} className="flex items-center gap-2 text-xs">
            <span className="w-12 shrink-0 text-muted-foreground">{FACTOR_LABEL[x.factor] ?? x.factor}</span>
            <span
              className="h-2 rounded bg-status-observe"
              style={{ width: `${Math.min(Math.abs(x.score as number) / 2, 1) * 120}px` }}
            />
            <span className="tabular-nums text-foreground/80">
              {(x.score as number) > 0 ? "+" : ""}{x.score}
              {x.factor === "supply" && chinaAdj ? " 중국 보정" : ""}
            </span>
          </div>
        ))}
      </div>

      {/* 다음 확인 */}
      {f.watch_points && f.watch_points.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          다음 확인{" "}
          {f.watch_points.map((w, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {mdLabel(w.due)} {w.source}
            </span>
          ))}
        </p>
      )}

      {/* 전문 토글 */}
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
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
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

      {/* 메타 */}
      <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        AI 작성 · 에디터 검수 완료
        {f.model_version ? ` · ${f.model_version}` : ""}
        {metaSources(f).map((s) => ` · ${s}`).join("")}
      </p>
    </article>
  );
}

// 노선명 — kita 항로면 "부산 → 도착지", 지수면 metric_ref/라벨.
function routeName(f: Forecast): string {
  const ref = f.metric_ref ?? "";
  if (ref.startsWith("kita_sea_rates:")) {
    const lane = ref.slice("kita_sea_rates:".length);
    const i = lane.indexOf("-");
    return i >= 0 ? `${lane.slice(0, i)} → ${lane.slice(i + 1)}` : lane;
  }
  return ref || MODULE_LABEL[f.module];
}
// 데이터 출처 — watch_points의 출처를 메타로(중복 제거).
function metaSources(f: Forecast): string[] {
  const set = new Set<string>();
  for (const w of f.watch_points ?? []) if (w.source) set.add(w.source);
  return [...set];
}

export { routeName };
