// A — 히어로. 배경은 어두운 그라데이션(선박 이미지 에셋 미보유 → 깨진 이미지 대신 그라데이션).
// 최종 업데이트 = max(published_at), 모듈 탭은 데이터가 존재하는 모듈만(빈 탭 금지).
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function kst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}. ${p(d.getUTCMonth() + 1)}. ${p(d.getUTCDate())} (${WEEKDAY[d.getUTCDay()]}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} KST`;
}

type Module = { key: string; label: string };

export function ForecastHero({
  lastUpdated,
  modules,
  activeModule,
  onModule,
}: {
  lastUpdated: string | null;
  modules: Module[];
  activeModule: string | null;
  onModule: (key: string | null) => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-8 lg:px-9 lg:py-10"
      style={{ background: "#0b1f33" }}
    >
      {/* 배경 선박 이미지(public/forecast-hero.jpg) — 부재 시 아래 그라데이션이 폴백 */}
      <div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: "url(/forecast-hero.png)", backgroundPosition: "75% 30%" }}
        aria-hidden
      />
      {/* 좌→우 어두운 오버레이: 좌측 텍스트 가독성, 우측 이미지 노출(선박이 우측) */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(8,20,33,0.94) 0%, rgba(8,20,33,0.80) 42%, rgba(8,20,33,0.30) 100%)" }}
        aria-hidden
      />
      <div className="relative">
        {modules.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {modules.map((m) => {
              const active = activeModule === m.key || (activeModule == null && modules.length === 1);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onModule(active && activeModule != null ? null : m.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active ? "bg-white/90 text-slate-900" : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-white">물류 시장 전망</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          정량 모델(팩터 채점)과 에디터 검수를 결합해 향후 2~4주 방향을 제시합니다. 모든 전망은 단정이
          아닌 확률 표현이며, 판정일에 실측으로 적중을 매깁니다.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80">
          <span aria-hidden>🗓</span>
          최종 업데이트 {lastUpdated ? kst(lastUpdated) : "데이터 수집 중"}
        </div>
      </div>
    </div>
  );
}
