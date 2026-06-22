import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { useDarkMode } from "@/hooks/useDarkMode";

// 프로토타입 메뉴 구조 — 상단 GNB 3개 + 대시보드 하위 서브메뉴 7개.
// 홈은 로고/홈 버튼(→/), 대시보드 진입 시 서브 GNB가 나타난다.
const GNB = [
  { to: "/", label: "홈" },
  { to: "/news", label: "뉴스" },
  { to: "/dashboard", label: "인사이트" },
] as const;

const SUB_GNB = [
  { to: "/dashboard", label: "종합" },
  { to: "/forecasts", label: "전망" },
  { to: "/rates", label: "운임" },
  { to: "/eurasia", label: "유라시아" },
  { to: "/policy", label: "포트" },
  { to: "/trade", label: "무역" },
  { to: "/industries", label: "산업" },
  { to: "/climate", label: "기후예측" },
] as const;

// 대시보드(다크 토글 허용) 영역
export const DASHBOARD_PREFIXES = SUB_GNB.map((i) => i.to);

function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function Navigation() {
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useDarkMode();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inDash = isDashboardPath(pathname);
  // 종합(/dashboard)은 라이트 전용 디자인(dashboard.css) → 다크 토글 숨김.
  const isInsightHome = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const showThemeToggle = inDash && !isInsightHome;

  const topActive = (to: string): boolean => {
    if (to === "/") return pathname === "/";
    if (to === "/news") return pathname === "/news" || pathname.startsWith("/article");
    return inDash;
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-white/10" style={{ background: "var(--color-navy-900)" }}>
        <div className="mx-auto flex h-14 max-w-[1540px] items-center gap-4 px-4 lg:px-12">
          <Logo className="text-lg lg:text-xl" />

          <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
            {GNB.map((item) => {
              const active = topActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative px-3 py-2 text-sm transition-colors hover:text-white ${
                    active
                      ? "font-bold text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[var(--color-cyan)]"
                      : "font-medium text-white/85"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            {showThemeToggle && (
              <button
                type="button"
                onClick={toggle}
                aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                <span>{dark ? "라이트" : "다크"}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="absolute right-4 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/30 bg-white/15 text-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="메뉴 열기"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-white/10 lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
              {GNB.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-[15px] text-white/85 hover:bg-white/5 hover:text-white"
                  activeProps={{ className: "text-white bg-white/5" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-1 border-t border-white/10 pt-1">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                  Insight
                </p>
                {SUB_GNB.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/5 hover:text-white block"
                    activeProps={{ className: "text-white bg-white/5" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              {showThemeToggle && (
                <div className="mt-2 px-1 pb-2">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    <span>{dark ? "라이트" : "다크"}</span>
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* 대시보드 서브 GNB — 종합 | 전망 | 운임 | 유라시아 | 포트 | 무역 | 산업 */}
      {inDash && (
        <div
          className="hidden border-b border-white/10 lg:block"
          style={{ background: "var(--color-navy-900)" }}
        >
          <div className="mx-auto flex h-11 max-w-[1540px] items-center gap-0.5 overflow-x-auto px-4 lg:px-12">
            <span className="mr-2.5 whitespace-nowrap text-[10.5px] font-bold tracking-[0.14em] text-white/45">
              INSIGHT
            </span>
            {SUB_GNB.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex h-full items-center whitespace-nowrap px-3 text-[13px] transition-colors hover:text-white ${
                    active
                      ? "font-bold text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-sm after:bg-[var(--color-cyan)]"
                      : "font-medium text-white/65"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
