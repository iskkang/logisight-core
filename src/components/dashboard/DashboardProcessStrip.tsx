// 프로세스 스트립 — 실제 파이프라인 문구만. "실시간"·"AI 이상 탐지" 표현 금지.
const STEPS = [
  "공공·공개 데이터 배치 수집 (일·주 단위)",
  "룰 기반 경보 · 스파이크 가드",
  "5팩터 채점 · AI 산문",
  "자동 검증 + 에디터 검수",
  "발행",
];

export function DashboardProcessStrip() {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 text-sm font-semibold text-foreground">데이터 파이프라인</div>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-observe/15 text-[11px] font-bold text-status-observe">
              {i + 1}
            </span>
            <div className="text-[13px] leading-snug text-foreground">{s}</div>
            {i < STEPS.length - 1 && <span className="hidden text-muted-foreground/40 sm:inline">→</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
