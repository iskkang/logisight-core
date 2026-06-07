import type { Kpis } from "./forecastUtils";

// 장식 아이콘(목업 우측 페인트) — 데이터 무관 시각 장식. 24px 라인, muted.
const ICON: Record<string, React.ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h7l5 5v13H6z" />
      <path d="M13 3v5h5" />
      <path d="M9 13h6M9 16.5h6" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M7 3c0 4 5 6 5 9s-5 5-5 9" />
      <path d="M17 3c0 4-5 6-5 9s5 5 5 9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICON }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8 shrink-0 text-muted-foreground/30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON[name]}
    </svg>
  );
}

function Cell({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: keyof typeof ICON;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-2xl font-bold tabular-nums text-heading">{value}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <Icon name={icon} />
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
        icon="target"
      />
      <Cell label="Published" value={`${publishedThisWeek}`} sub="이번 주 발행 전망" icon="doc" />
      <Cell label="판정 대기" value={`${awaitingJudgment}`} sub="확인 대기 중인 전망" icon="hourglass" />
      <Cell label="근거 데이터 평균" value={avgEvidence != null ? `${avgEvidence}/5` : "—"} sub="전망 평균 근거 팩터" icon="shield" />
      <Cell label="평균 리드타임" value={leadTimeDays != null ? `${leadTimeDays}일` : "—"} sub="모델 신호 → 발행" icon="clock" />
    </div>
  );
}
