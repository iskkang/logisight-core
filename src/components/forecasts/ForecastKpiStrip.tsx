import type { Kpis } from "./forecastUtils";

function Cell({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums text-heading">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

// 5칸 — 전부 실데이터. 표본 부족·결측은 게이트 문구(더미 금지).
export function ForecastKpiStrip({ kpis }: { kpis: Kpis }) {
  const { hitRate, publishedThisWeek, awaitingJudgment, avgEvidence, leadTimeDays } = kpis;
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card sm:flex-row sm:divide-x sm:divide-y-0">
      <Cell
        label="방향 적중률 · 최근 12주"
        value={hitRate.gate ? <span className="text-base font-semibold text-muted-foreground">판정 표본 누적 중</span> : `${hitRate.rate}%`}
        sub={hitRate.gate ? `표본 ${hitRate.sample}/10` : "hit+부분 / 전체"}
      />
      <Cell label="Published" value={`${publishedThisWeek}`} sub="이번 주 발행 전망" />
      <Cell label="판정 대기" value={`${awaitingJudgment}`} sub="확인 대기 중인 전망" />
      <Cell label="근거 데이터 평균" value={avgEvidence != null ? `${avgEvidence}/5` : "—"} sub="전망 평균 근거 팩터" />
      <Cell label="평균 리드타임" value={leadTimeDays != null ? `${leadTimeDays}일` : "—"} sub="모델 신호 → 발행" />
    </div>
  );
}
