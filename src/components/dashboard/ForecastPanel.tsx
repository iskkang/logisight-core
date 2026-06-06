import {
  MODULE_LABEL,
  hitRate,
  needsRetrospective,
  type Forecast,
  type FactorScore,
  type ForecastDirection,
  type ForecastModule,
  type ForecastOutcome,
} from "@/lib/api/forecasts";

const CONF: Record<string, { n: number; label: string }> = {
  high: { n: 3, label: "높음" },
  medium: { n: 2, label: "중간" },
  low: { n: 1, label: "낮음" },
};

const OUTCOME_META: Record<ForecastOutcome, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-status-normal/10 text-status-normal" },
  partial: { label: "부분", cls: "bg-status-caution/10 text-status-caution" },
  miss: { label: "빗나감", cls: "bg-status-alert/10 text-status-alert" },
};

// 운임 상승 = 화주 비용 압력(주의색), 하락 = 완화(정상색), 보합 = 중립.
const DIR: Record<
  ForecastDirection,
  { icon: string; tone: string; bar: string; chipBg: string; chipText: string }
> = {
  up: { icon: "▲", tone: "상승", bar: "bg-status-caution", chipBg: "bg-status-caution/10", chipText: "text-status-caution" },
  down: { icon: "▼", tone: "하락", bar: "bg-status-normal", chipBg: "bg-status-normal/10", chipText: "text-status-normal" },
  flat: { icon: "▬", tone: "보합", bar: "bg-muted-foreground/40", chipBg: "bg-muted", chipText: "text-muted-foreground" },
};

const FACTOR_LABEL: Record<string, string> = {
  momentum: "모멘텀",
  supply: "공급",
  demand: "수요",
  cost: "비용",
  pricing: "가격",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function ConfidenceMeter({ level }: { level: "high" | "medium" | "low" }) {
  const n = CONF[level].n;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
      title={`확신도 ${CONF[level].label}`}
    >
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 w-1 rounded-sm ${i <= n ? "bg-foreground/70" : "bg-muted"}`} />
        ))}
      </span>
      <span>확신도 {CONF[level].label}</span>
    </span>
  );
}

/** Factor contribution bars (-2..+2, centred axis) — the "근거" centrepiece. */
function FactorBars({ scores }: { scores: FactorScore[] }) {
  return (
    <div className="mt-1.5 space-y-1">
      {scores.map((fs) => {
        const label = FACTOR_LABEL[fs.factor] ?? fs.factor;
        const missing = fs.missing || fs.score == null;
        const s = fs.score ?? 0;
        const mag = Math.min(Math.abs(s), 2) * 25; // % of full track (half = 50)
        const pos = s >= 0;
        return (
          <div key={fs.factor} className={`flex items-center gap-2 ${missing ? "opacity-50" : ""}`}>
            <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{label}</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-muted/60">
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
              {!missing && mag > 0 && (
                <span
                  className={`absolute top-0 h-full rounded-full ${pos ? "bg-status-caution" : "bg-status-normal"}`}
                  style={pos ? { left: "50%", width: `${mag}%` } : { right: "50%", width: `${mag}%` }}
                />
              )}
            </div>
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {missing ? "결측" : signed(s)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Single published/resolved forecast — provenance + 판정 + 화주 영향 + 근거. */
export function ForecastItem({ f, showModule = false }: { f: Forecast; showModule?: boolean }) {
  const dir = f.direction ? DIR[f.direction] : null;
  const retro = needsRetrospective(f);
  const factors = f.factor_scores ?? null;

  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      {dir && <span className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${dir.bar}`} />}

      {/* headline row */}
      <div className="flex flex-wrap items-center gap-2">
        {showModule && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/70">
            {MODULE_LABEL[f.module]}
          </span>
        )}
        {dir && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${dir.chipBg} ${dir.chipText}`}
          >
            <span aria-hidden>{dir.icon}</span>
            {f.strength ?? dir.tone}
          </span>
        )}
        {f.expected_range_pct && (
          <span className="text-sm font-bold tabular-nums text-foreground">{f.expected_range_pct}%</span>
        )}
        {f.confidence && <ConfidenceMeter level={f.confidence} />}
        <span className="ml-auto rounded bg-status-observe/10 px-1.5 py-0.5 text-[11px] text-status-observe">
          AI 초안 · 에디터 검수
        </span>
      </div>

      {/* meta line */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {f.metric_ref && <span className="font-mono text-foreground/60">{f.metric_ref}</span>}
        {f.cadence && <span>· {f.cadence === "weekly" ? "주간" : "월간"}</span>}
        {f.horizon_date && <span>· 판정일 {f.horizon_date}</span>}
        {f.status === "resolved" && f.outcome && (
          <span className={`rounded px-1.5 py-0.5 font-medium ${OUTCOME_META[f.outcome].cls}`}>
            {OUTCOME_META[f.outcome].label}
          </span>
        )}
        {retro && (
          <span className="rounded bg-status-caution/10 px-1.5 py-0.5 font-medium text-status-caution">
            복기 작성 중
          </span>
        )}
      </div>

      <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{f.statement}</p>

      {f.impact_note && (
        <div className="mt-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed">
          <span className="font-semibold text-foreground/70">화주 영향 · </span>
          <span className="whitespace-pre-wrap">{f.impact_note}</span>
        </div>
      )}

      {factors && factors.length > 0 && (
        <div className="mt-3">
          <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>판단 근거 · 팩터 기여도</span>
            {f.composite_score != null && (
              <span className="tabular-nums">종합 {signed(f.composite_score)}</span>
            )}
          </div>
          <FactorBars scores={factors} />
        </div>
      )}

      {f.status === "resolved" && f.realized_pct != null && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          실측 변화{" "}
          <span className="font-semibold tabular-nums text-foreground">{signed(f.realized_pct)}%</span>
          {f.expected_range_pct && <span> · 예상 {f.expected_range_pct}%</span>}
        </p>
      )}

      {f.basis && f.basis.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {f.basis.map((b, i) => (
            <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {b}
            </span>
          ))}
        </div>
      )}
      {f.data_quality_flags && f.data_quality_flags.length > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">{f.data_quality_flags.join(" · ")}</p>
      )}
      {f.invalidation_condition && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">무효 조건: {f.invalidation_condition}</p>
      )}
      {f.status === "resolved" && f.outcome !== "hit" && f.outcome_note && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">복기: {f.outcome_note}</p>
      )}
    </article>
  );
}

/** Hit-rate chip (over the passed forecast set — published 전수 기준). */
export function HitRateChip({ forecasts }: { forecasts: Forecast[] }) {
  const hr = hitRate(forecasts);
  if (hr.resolved === 0) {
    return <span className="text-[11px] text-muted-foreground">적중률 — 판정 표본 누적 중</span>;
  }
  return (
    <span className="text-[11px] text-muted-foreground">
      적중률 <span className="font-semibold text-foreground">{hr.rate}%</span> · 적중 {hr.hit}·부분{" "}
      {hr.partial}·빗나감 {hr.miss} / 판정 {hr.resolved}건
    </span>
  );
}

/** Module-scoped forecast tracking module (Rates·Eurasia 우선 배치). */
export function ForecastTracking({
  forecasts,
  module,
  title = "전망 트래킹",
}: {
  forecasts: Forecast[];
  module: ForecastModule;
  title?: string;
}) {
  const scoped = forecasts.filter((f) => f.module === module);
  const open = scoped.filter((f) => f.status === "published");
  const done = scoped.filter((f) => f.status === "resolved");

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {scoped.length > 0 && <HitRateChip forecasts={scoped} />}
      </div>
      {scoped.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          발행된 전망이 아직 없습니다 — 검수 후 게재됩니다.
        </p>
      ) : (
        <div className="space-y-2">
          {open.map((f) => (
            <ForecastItem key={f.id} f={f} />
          ))}
          {done.slice(0, 3).map((f) => (
            <ForecastItem key={f.id} f={f} />
          ))}
        </div>
      )}
    </section>
  );
}
