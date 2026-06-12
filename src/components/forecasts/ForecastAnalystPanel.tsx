import { useState } from "react";

import type { Forecast, RiskNote, DataUpdate } from "@/lib/api/forecasts";
import {
  FACTOR_LABEL,
  missingNames,
  displayLabelOf,
  mdLabel,
  sentences,
  directionStrength,
  upcomingEvents,
} from "./forecastUtils";

// data_updates.dataset → 화면 표기명(소스 원본 키 비노출).
const DATASET_LABEL: Record<string, string> = {
  trade_provisional: "무역데이터",
  kita_fare: "RADIS",
  monthly_analysis: "Logisight분석",
  freight_rates: "운임인덱스",
};
const datasetLabel = (d: string) => DATASET_LABEL[d] ?? d;

// 방향 강도 도넛(확률 아님 — composite |점수|/2). 링 색 = 방향(상승 적/하락 녹/보합 황).
function DirectionDonut({ score, direction }: { score: number | null | undefined; direction: string | null | undefined }) {
  const { dir, pct, label } = directionStrength(score, direction);
  const stroke = `var(--direction-${dir})`;
  const R = 40;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" className="stroke-border" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          style={{ stroke }}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
        />
      </svg>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">방향 강도</div>
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

// 팩터 다이버징 바(raw −2~+2, 결측 비표시).
function FactorBars({ f }: { f: Forecast }) {
  const factors = (f.factor_scores ?? []).filter((x) => !x.missing && x.score != null);
  const miss = missingNames(f);
  return (
    <div className="space-y-1.5">
      {factors.map((x) => {
        const sc = x.score as number;
        const w = (Math.min(Math.abs(sc), 2) / 2) * 50; // 한쪽 최대 50%
        // 부호별 방향색: 양(+)=상승 적 / 음(−)=하락 녹.
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

type Props = {
  forecast: Forecast | null;
  forecasts: Forecast[];
  dataUpdates: DataUpdate[];
  riskNotes: RiskNote[];
};

export function ForecastAnalystPanel({ forecast, forecasts, dataUpdates, riskNotes }: Props) {
  const [tab, setTab] = useState<"model" | "editor">("model");
  const insights = forecast ? sentences(forecast.statement || "").slice(0, 4) : [];
  const events = upcomingEvents(forecasts);

  return (
    <aside className="rounded-xl border border-border bg-card p-4 text-sm">
      {/* 전체폭 3단: 왼쪽 신호 · 가운데 인사이트 · 오른쪽 출처/캘린더 */}
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {/* 왼쪽: 종합 신호 도넛 + 모델/에디터 탭 + 팩터 스코어/에디터 코멘트 */}
        <div className="space-y-5">
          {forecast ? (
            <div>
              <SectionLabel>{displayLabelOf(forecast)} · 종합 신호</SectionLabel>
              <DirectionDonut score={forecast.composite_score} direction={forecast.direction} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">카드를 선택하면 종합 신호가 표시됩니다.</p>
          )}

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

          {tab === "model"
            ? forecast && (
                <div>
                  <SectionLabel>팩터 스코어</SectionLabel>
                  <FactorBars f={forecast} />
                </div>
              )
            : (
              <div>
                <SectionLabel>에디터 코멘트</SectionLabel>
                {forecast?.editor_note ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{forecast.editor_note}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">코멘트 없음</p>
                )}
              </div>
            )}
        </div>

        {/* 가운데: 핵심 인사이트(모델 탭) + 리스크 노트 */}
        <div className="space-y-5">
          {tab === "model" && forecast && insights.length > 0 && (
            <div>
              <SectionLabel>핵심 인사이트</SectionLabel>
              <ul className="space-y-1.5">
                {insights.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 리스크 노트 — 실 입력 전수(admin). 없으면 미표시. */}
          {riskNotes.length > 0 && (
            <div>
              <SectionLabel>리스크 노트</SectionLabel>
              <div className="space-y-1.5 rounded-lg bg-status-caution/10 px-3 py-2.5">
                {riskNotes.map((r) => (
                  <p key={r.id} className="flex gap-2 text-xs leading-relaxed text-foreground">
                    <span aria-hidden className="text-status-caution">⚠</span>
                    {r.note}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 주요 출처 + 이벤트 캘린더 */}
        <div className="space-y-5">
          {/* 주요 데이터 출처 — 실 갱신일(data_updates). dataset 원본 키 비노출, 표기명 매핑. */}
          {dataUpdates.length > 0 && (
            <div>
              <SectionLabel>주요 데이터 출처</SectionLabel>
              <div className="grid grid-cols-1 gap-1.5">
                {dataUpdates.map((u) => {
                  const label = datasetLabel(u.dataset);
                  return (
                    <div key={u.dataset} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                          {label.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs text-foreground">{label}</span>
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {u.updated_at ? `업데이트 ${mdLabel(u.updated_at.slice(0, 10))}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 이벤트 캘린더 — 전 전망 watch_points 통합. 없으면 게이트. */}
          <div>
            <SectionLabel>이벤트 캘린더</SectionLabel>
            {events.length > 0 ? (
              <ul className="space-y-1.5">
                {events.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="w-10 shrink-0 tabular-nums font-semibold text-foreground">{mdLabel(e.due)}</span>
                    <div className="min-w-0">
                      <span className="text-foreground">{e.source}</span>
                      <span className="ml-1.5 text-muted-foreground">{e.label}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">데이터 수집 중</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
