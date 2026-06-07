import { useState } from "react";

import type { Forecast, RiskNote, DataUpdate } from "@/lib/api/forecasts";
import { FACTOR_LABEL, missingNames, displayLabelOf, mdLabel } from "./forecastUtils";

// composite −2~+2 게이지(시나리오 확률 도넛 대체 — 모델은 확률 미산출이라 % 표기 금지).
// 바늘 색 = 방향 구간(≥+0.4 상승=적 / ≤−0.4 하락=청 / 그 외 보합=중립).
function CompositeGauge({ score }: { score: number | null | undefined }) {
  const s = score ?? 0;
  const pct = ((Math.max(-2, Math.min(2, s)) + 2) / 4) * 100; // 0~100
  const needle = s >= 0.4 ? "bg-direction-up" : s <= -0.4 ? "bg-direction-down" : "bg-direction-flat";
  return (
    <div>
      <div className="relative h-2 rounded-full bg-muted">
        {/* 보합 구간 음영(중립) */}
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
      <div className="mt-1 text-center text-xs text-muted-foreground">
        종합 {score != null ? `${score > 0 ? "+" : ""}${score}` : "—"}
      </div>
    </div>
  );
}

// 팩터 다이버징 바(raw −2~+2, 결측 비표시). 단일 청색.
function FactorBars({ f }: { f: Forecast }) {
  const factors = (f.factor_scores ?? []).filter((x) => !x.missing && x.score != null);
  const miss = missingNames(f);
  return (
    <div className="space-y-1.5">
      {factors.map((x) => {
        const sc = x.score as number;
        const w = (Math.min(Math.abs(sc), 2) / 2) * 50; // 한쪽 최대 50%
        // 부호별 방향색: 양(+)=상승 적 / 음(−)=하락 청.
        const barCls = sc >= 0 ? "bg-direction-up" : "bg-direction-down";
        return (
          <div key={x.factor} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">{FACTOR_LABEL[x.factor] ?? x.factor}</span>
            <span className="relative h-2 flex-1 rounded bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <span
                className={`absolute inset-y-0 rounded ${barCls}`}
                style={sc >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-foreground/80">{sc > 0 ? "+" : ""}{sc}</span>
          </div>
        );
      })}
      {miss.length > 0 && <p className="text-[11px] text-muted-foreground/80">{miss.join("·")} 결측</p>}
    </div>
  );
}

type Props = {
  forecast: Forecast | null;
  dataUpdates: DataUpdate[];
  riskNotes: RiskNote[];
};

export function ForecastAnalystPanel({ forecast, dataUpdates, riskNotes }: Props) {
  const [tab, setTab] = useState<"model" | "editor">("model");
  const risk = riskNotes[0] ?? null;

  return (
    <aside className="space-y-5 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {(["model", "editor"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-xs ${tab === t ? "bg-status-observe/15 font-medium text-status-observe" : "text-muted-foreground"}`}
          >
            {t === "model" ? "모델 인사이트" : "에디터 코멘트"}
          </button>
        ))}
      </div>

      {tab === "model" ? (
        <>
          {forecast ? (
            <>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  팩터 스코어 · {displayLabelOf(forecast)}
                </div>
                <FactorBars f={forecast} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">종합 점수</div>
                <CompositeGauge score={forecast.composite_score} />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">카드를 선택하면 팩터 분석이 표시됩니다.</p>
          )}

          {dataUpdates.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">주요 데이터 출처</div>
              <ul className="space-y-1">
                {dataUpdates.map((u) => (
                  <li key={u.dataset} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{u.dataset}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {u.updated_at ? mdLabel(u.updated_at.slice(0, 10)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {risk && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">리스크 노트</div>
              <p className="rounded-lg bg-status-caution/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                ⚠ {risk.note}
              </p>
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">에디터 코멘트</div>
          {forecast?.editor_note ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{forecast.editor_note}</p>
          ) : (
            <p className="text-xs text-muted-foreground">코멘트 없음</p>
          )}
        </div>
      )}
    </aside>
  );
}
