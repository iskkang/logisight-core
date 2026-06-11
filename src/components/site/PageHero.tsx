// 공통 페이지 히어로 — 다크 네이비 그라데이션 + 컨테이너선 풀블리드 + 상태 칩.
// 프로토타입(Logisight 인터랙티브 프로토타입)의 .ls-pagehero를 React로 구현.
import type { ReactNode } from "react";

export type HeroChip = { label: string; value: string; color: string };

export function PageHero({
  eyebrow,
  titleMain,
  titleAccent,
  subtitle,
  chips = [],
  action,
}: {
  eyebrow?: string;
  titleMain: string;
  titleAccent?: string;
  subtitle?: string;
  chips?: HeroChip[];
  action?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(100deg, #0a1f3c 0%, #0f2d5a 46%, #173f73 100%)" }}
    >
      {/* 컨테이너선 블리드 (우측) */}
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
      {/* 하단 페이드 → 페이지 배경 */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-7"
        style={{ background: "linear-gradient(to top, var(--color-surface), transparent)" }}
      />
      <div className="relative mx-auto flex max-w-[1540px] flex-col items-start justify-between gap-6 px-4 pb-9 pt-10 lg:flex-row lg:items-end lg:px-12">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--color-cyan)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-white lg:text-[40px]">
            {titleMain}
            {titleAccent && (
              <>
                {" "}
                <span style={{ color: "#5bb8f5" }}>{titleAccent}</span>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-[620px] text-sm leading-relaxed text-white/80">{subtitle}</p>
          )}
          {chips.length > 0 && (
            <div className="mt-[18px] flex flex-wrap gap-2.5">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] text-white/80 backdrop-blur"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.color }}
                    aria-hidden
                  />
                  {c.label}{" "}
                  <b className="font-bold text-white" style={{ fontFamily: "var(--font-mono)" }}>
                    {c.value}
                  </b>
                </span>
              ))}
            </div>
          )}
        </div>
        {action && <div className="relative flex shrink-0 gap-2.5">{action}</div>}
      </div>
    </section>
  );
}

/** 히어로 안에서 쓰는 흰색/아웃라인 버튼 */
export function HeroBtn({
  children,
  onClick,
  variant,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "outline";
  href?: string;
}) {
  const cls =
    variant === "outline"
      ? "inline-flex h-10 items-center whitespace-nowrap rounded-md border border-white/30 bg-white/10 px-[18px] text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
      : "inline-flex h-10 items-center whitespace-nowrap rounded-md bg-white px-[18px] text-[13.5px] font-bold text-[var(--color-navy-900)] transition-opacity hover:opacity-90";
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
