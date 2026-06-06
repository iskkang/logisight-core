import {
  MODULE_LABEL,
  hitRate,
  type Forecast,
  type ForecastModule,
  type ForecastOutcome,
} from "@/lib/api/forecasts";

const CONF_LABEL: Record<string, string> = { high: "높음", medium: "중간", low: "낮음" };
const OUTCOME_META: Record<ForecastOutcome, { label: string; cls: string }> = {
  hit: { label: "적중", cls: "bg-status-normal/10 text-status-normal" },
  partial: { label: "부분", cls: "bg-status-caution/10 text-status-caution" },
  miss: { label: "빗나감", cls: "bg-status-alert/10 text-status-alert" },
};

/** Single published/resolved forecast — provenance + 화주 영향 + 근거. */
export function ForecastItem({ f, showModule = false }: { f: Forecast; showModule?: boolean }) {
  return (
    <article className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {showModule && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
            {MODULE_LABEL[f.module]}
          </span>
        )}
        <span className="rounded bg-status-observe/10 px-1.5 py-0.5 text-status-observe">
          AI 초안 · 에디터 검수
        </span>
        {f.confidence && <span>· 확신도 {CONF_LABEL[f.confidence]}</span>}
        {f.horizon_date && <span>· 판정일 {f.horizon_date}</span>}
        {f.status === "resolved" && f.outcome && (
          <span className={`rounded px-1.5 py-0.5 font-medium ${OUTCOME_META[f.outcome].cls}`}>
            {OUTCOME_META[f.outcome].label}
          </span>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {f.statement}
      </p>

      {f.impact_note && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed">
          <span className="font-medium text-foreground/70">화주 영향 · </span>
          <span className="whitespace-pre-wrap">{f.impact_note}</span>
        </div>
      )}

      {f.basis && f.basis.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">근거: {f.basis.join(" · ")}</p>
      )}
      {f.invalidation_condition && (
        <p className="mt-1 text-[11px] text-muted-foreground">무효 조건: {f.invalidation_condition}</p>
      )}
      {f.status === "resolved" && f.outcome !== "hit" && f.outcome_note && (
        <p className="mt-1 text-[11px] text-muted-foreground">복기: {f.outcome_note}</p>
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
