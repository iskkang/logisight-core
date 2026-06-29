// 철도 허브 지역 탭바 — 미주 · 유라시아. 현재 경로로 active 결정.
import { Link, useRouterState } from "@tanstack/react-router";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";

const TABS = [
  { to: "/rail/americas", label: "미주", ready: true },
  { to: "/rail/eurasia", label: "유라시아", ready: true },
] as const;

export function RailRegionTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b border-[#78a0cd1c] bg-[#0a0f1d]">
      <div className={`${WRAP} flex h-[44px] items-center gap-2 overflow-x-auto`}>
        <span className="mr-1 flex-none text-[10.5px] font-bold tracking-[0.18em] text-[#5d6b80]">권역</span>
        {TABS.map((t) => {
          const active = pathname === t.to || pathname.startsWith(`${t.to}/`);
          const base =
            "whitespace-nowrap rounded-[8px] px-3.5 py-[7px] text-[13px] transition-colors";
          if (active) {
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`${base} bg-[#13203a] font-semibold text-white ring-1 ring-[#2dd4bf]/40`}
              >
                {t.label}
              </Link>
            );
          }
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`${base} ${t.ready ? "text-[#93a1b7] hover:bg-[#101a2e] hover:text-white" : "text-[#5d6b80] hover:text-[#93a1b7]"}`}
            >
              {t.label}
              {!t.ready && (
                <span className="ml-1.5 rounded-full border border-[#78a0cd33] bg-[#0e1626] px-1.5 py-px text-[9.5px] font-semibold text-[#828d9d]">
                  준비 중
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
