// 히어로 — 배경 이미지(public/dashboard-hero.png) + 좌→우 어두운 오버레이 + 상태 칩.
// 제목 투톤: "종합"=흰색 / "Control Tower"=시안. 상태 칩은 위험 체계 색(방향 색과 혼용 금지).
export type HeroChip = { label: string; value: string; state: "normal" | "observe" | "caution" | "alert" };

const CHIP_COLOR: Record<HeroChip["state"], string> = {
  normal: "var(--color-status-normal)",
  observe: "var(--color-status-observe)",
  caution: "var(--color-status-caution)",
  alert: "var(--color-status-alert)",
};

export function DashboardHero({
  titlePrefix,
  titleAccent,
  subtitle,
  chips,
}: {
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  chips: HeroChip[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl px-6 py-7 lg:px-9 lg:py-8" style={{ background: "#0a2a4a" }}>
      <div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: "url(/dashboard-hero.png)", backgroundPosition: "75% 30%" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(8,30,56,0.96) 0%, rgba(8,30,56,0.82) 42%, rgba(8,30,56,0.25) 100%)" }}
        aria-hidden
      />
      <div className="relative">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          <span className="text-white">{titlePrefix} </span>
          <span style={{ color: "var(--color-cyan)" }}>{titleAccent}</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{subtitle}</p>
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
