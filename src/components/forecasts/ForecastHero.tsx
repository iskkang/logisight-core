// A — 히어로. 다크 네이비 + 컨테이너선 블리드(프로토타입 PageHero 스타일) + 모듈 탭 + 상태 칩.
// 최종 업데이트 = max(published_at), 모듈 탭은 데이터가 존재하는 모듈만(빈 탭 금지).
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function kst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}. ${p(d.getUTCMonth() + 1)}. ${p(d.getUTCDate())} (${WEEKDAY[d.getUTCDay()]}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} KST`;
}

type Module = { key: string; label: string };
type Chip = { label: string; value: string; color: string };

export function ForecastHero({
  lastUpdated,
  modules,
  activeModule,
  onModule,
  chips = [],
}: {
  lastUpdated: string | null;
  modules: Module[];
  activeModule: string | null;
  onModule: (key: string | null) => void;
  chips?: Chip[];
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(100deg, #0a1f3c 0%, #0f2d5a 46%, #173f73 100%)" }}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-[72%] bg-cover opacity-50 lg:w-[56%] lg:opacity-90"
        style={{
          backgroundImage: "url(/dashboard-hero.png)",
          backgroundPosition: "right center",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 42%)",
          maskImage: "linear-gradient(90deg, transparent, #000 42%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-7"
        style={{ background: "linear-gradient(to top, var(--color-surface), transparent)" }}
      />
      <div className="relative mx-auto max-w-[1540px] px-4 pb-9 pt-10 lg:px-12">
        <div
          className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "var(--color-cyan)" }}
        >
          Verified Forecast
        </div>
        <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-white lg:text-[40px]">
          물류 시장 <span style={{ color: "#5bb8f5" }}>전망</span>
        </h1>
        <p className="mt-3 max-w-[640px] text-sm leading-relaxed text-white/80">
          향후 2~4주 운임 방향을 정량 모델 + 에디터 검수로 발행하고, 판정일 실측으로 사후 적중을
          매깁니다. 적중률 분모는 발행된 전망 전수입니다.
        </p>

        {modules.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {modules.map((m) => {
              const active =
                activeModule === m.key || (activeModule == null && modules.length === 1);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onModule(active && activeModule != null ? null : m.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-white/90 text-slate-900"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-[18px] flex flex-wrap gap-2.5">
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] text-white/80 backdrop-blur"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              {c.label}{" "}
              <b className="font-bold text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {c.value}
              </b>
            </span>
          ))}
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] text-white/80 backdrop-blur">
            🗓 최종 업데이트{" "}
            <b className="font-bold text-white" style={{ fontFamily: "var(--font-mono)" }}>
              {lastUpdated ? kst(lastUpdated) : "데이터 수집 중"}
            </b>
          </span>
        </div>
      </div>
    </section>
  );
}
