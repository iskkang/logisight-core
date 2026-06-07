import type { Forecast, ForecastSeries } from "@/lib/api/forecasts";
import { ForecastSparkline } from "@/components/forecasts/ForecastSparkline";
import {
  DIR_META,
  dirCls,
  displayLabelOf,
  baseIndexCaption,
  sentences,
  FACTOR_LABEL,
  missingNames,
  dDay,
  mdLabel,
} from "@/components/forecasts/forecastUtils";

// composite −2~+2 게이지(확률 % 금지). 바늘 색 = 방향 구간.
function Gauge({ score }: { score: number | null | undefined }) {
  const s = score ?? 0;
  const pct = ((Math.max(-2, Math.min(2, s)) + 2) / 4) * 100;
  const needle = s >= 0.4 ? "bg-direction-up" : s <= -0.4 ? "bg-direction-down" : "bg-direction-flat";
  return (
    <div>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-foreground/5" style={{ left: "40%", right: "40%" }} />
        {score != null && (
          <div className={`absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded ${needle}`} style={{ left: `${pct}%` }} />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>하락 −2</span>
        <span>보합 0</span>
        <span>상승 +2</span>
      </div>
      <div className="mt-0.5 text-center text-xs text-muted-foreground">
        종합 {score != null ? `${score > 0 ? "+" : ""}${score}` : "—"}
      </div>
    </div>
  );
}

// 5팩터 다이버징 바(raw −2~+2, 결측 비표시 + 캡션).
function FactorBars({ f }: { f: Forecast }) {
  const factors = (f.factor_scores ?? []).filter((x) => !x.missing && x.score != null);
  const miss = missingNames(f);
  return (
    <div className="space-y-1.5">
      {factors.map((x) => {
        const sc = x.score as number;
        const w = (Math.min(Math.abs(sc), 2) / 2) * 50;
        const barCls = sc >= 0 ? "bg-direction-up" : "bg-direction-down";
        return (
          <div key={x.factor} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">{FACTOR_LABEL[x.factor] ?? x.factor}</span>
            <span className="relative h-2 flex-1 rounded bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <span className={`absolute inset-y-0 rounded ${barCls}`} style={sc >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
            </span>
            <span className="w-7 shrink-0 text-right tabular-nums text-foreground/80">{sc > 0 ? "+" : ""}{sc}</span>
          </div>
        );
      })}
      {miss.length > 0 && <p className="text-[11px] text-muted-foreground/80">{miss.join("·")} 결측 — 가중치 재분배</p>}
    </div>
  );
}

function ScenarioBox({ title, text, accent }: { title: string; text: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className={`text-[11px] font-semibold ${accent ?? "text-foreground"}`}>{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text || "데이터 수집 중"}</p>
    </div>
  );
}

// 오늘의 종합 판단 — 대표 전망 1건. 시나리오 3박스는 % 금지(전환 조건 텍스트).
export function DashboardJudgmentCard({ f, series }: { f: Forecast; series: ForecastSeries | undefined }) {
  const d = f.direction ? DIR_META[f.direction] : null;
  const dc = dirCls(f.direction);
  const caption = baseIndexCaption(f);
  const sents = sentences(f.statement || "");
  const lead = sents[0] ?? "";
  const transition = sents.length > 1 ? sents[sents.length - 1] : "";
  const inval = f.invalidation_condition ?? "";
  const dir = f.direction ?? "flat";
  // 단일 전환 조건(invalidation)은 기본 콜을 깨는 반대방향 트리거 → 반대 박스에 배치.
  // statement 말미 전환 문장은 동일방향 가속 단서 → 동일 박스. 분해 불가 시 게이트.
  const up = dir === "down" ? inval : transition;
  const down = dir === "up" ? inval : transition;

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">오늘의 종합 판단</h2>
      <article className="rounded-xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{displayLabelOf(f)} · 대표 전망</div>
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
            <div className="mt-0.5">{dDay(f.horizon_date)}</div>
          </div>
        </div>

        {lead && <p className="mt-2 text-sm leading-relaxed text-foreground">{lead}</p>}

        <div className="mt-4 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
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
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">종합 점수</div>
              <Gauge score={f.composite_score} />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">5팩터 스코어</div>
              <FactorBars f={f} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ScenarioBox title="기본 시나리오" text={lead} />
          <ScenarioBox title="상방 전환 조건" text={up} accent="text-direction-up" />
          <ScenarioBox title="하방 전환 조건" text={down} accent="text-direction-down" />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          모델은 단일 전환 조건을 산출 — 확률 분해가 아닌 조건부 서술. 인과 단정 없이 정합·추정으로만 기술.
        </p>
      </article>
    </section>
  );
}
