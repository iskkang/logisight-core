// 히어로 — 배경 이미지(public/dashboard-hero.png) + 좌→우 어두운 오버레이 + 상태 칩.
// 상태 칩은 위험 체계 색(정상 녹/경고 황/주의 관찰/장애 적) — 방향 색과 혼용 금지.
export type HeroChip = { label: string; value: string; state: "normal" | "observe" | "caution" | "alert" };

const CHIP_COLOR: Record<HeroChip["state"], string> = {
  normal: "var(--color-status-normal)",
  observe: "var(--color-status-observe)",
  caution: "var(--color-status-caution)",
  alert: "var(--color-status-alert)",
};

export function DashboardHero({
  title,
  subtitle,
  chips,
}: {
  title: string;
  subtitle: string;
  chips: HeroChip[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl px-6 py-7 lg:px-9 lg:py-9" style={{ background: "#0b1f33" }}>
      <div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: "url(/dashboard-hero.png)", backgroundPosition: "70% 35%" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(8,20,33,0.94) 0%, rgba(8,20,33,0.82) 45%, rgba(8,20,33,0.35) 100%)" }}
        aria-hidden
      />
      <div className="relative">
        <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm text-white/70">{subtitle}</p>
        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHIP_COLOR[c.state] }} aria-hidden />
                <span className="text-white/60">{c.label}</span>
                <span className="font-semibold text-white">{c.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
