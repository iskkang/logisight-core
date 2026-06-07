// 프로세스 스트립 — 실제 파이프라인 문구만. "실시간"·"AI 이상 탐지" 표현 금지.
const STEPS = [
  "공공·공개 데이터 배치 수집 (일·주 단위)",
  "룰 기반 경보 · 이상치 점검",
  "5팩터 채점 · AI 산문",
  "자동 검증 + 에디터 검수",
  "발행",
];

export function DashboardProcessStrip() {
  return (
    <section className="rounded-lg border border-blue-400 bg-white/95 px-4 py-3 shadow-[0_10px_26px_rgba(16,34,58,0.07)]">
      <div className="grid gap-3 lg:grid-cols-[230px_1fr] lg:items-center">
        <div className="flex items-center gap-2 text-xs font-black text-slate-800">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-blue-700">DB</span>
          데이터 → 인사이트 → 브리핑 프로세스
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s} className="relative flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-100 text-[11px] font-black text-blue-700">
              {i + 1}
            </span>
            <div className="text-[11px] font-extrabold leading-snug text-slate-700">{s}</div>
            {i < STEPS.length - 1 && <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-slate-300 sm:block">→</span>}
          </li>
        ))}
        </ol>
      </div>
    </section>
  );
}
