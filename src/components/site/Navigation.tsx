import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { useDarkMode } from "@/hooks/useDarkMode";

const DASHBOARD_NAV = [
  { to: "/dashboard", label: "종합" },
  { to: "/rates", label: "운임" },
  { to: "/trade", label: "무역" },
  { to: "/policy", label: "정책" },
  { to: "/eurasia", label: "유라시아" },
] as const;

const CONTENT_NAV = [
  { to: "/", label: "홈" },
  { to: "/news", label: "뉴스" },
  { to: "/industries", label: "산업별" },
] as const;

export function Navigation() {
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useDarkMode();

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10"
      style={{ background: "var(--color-navy-900)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 lg:px-6">
        <Logo className="text-lg lg:text-xl" />

        <nav className="hidden flex-1 items-center lg:flex">
          {/* Dashboard group */}
          <div className="flex items-center gap-0.5">
            {DASHBOARD_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
                activeOptions={{ exact: false }}
                activeProps={{
                  className:
                    "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[var(--color-cyan)]",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Separator */}
          <div className="mx-3 h-4 w-px bg-white/20" />

          {/* Content group */}
          <div className="flex items-center gap-0.5">
            {CONTENT_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative px-3 py-2 text-sm text-white/70 transition-colors hover:text-white/90"
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{
                  className:
                    "text-white/90 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-white/40",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
            <input
              type="search"
              aria-label="기사·노선·운임 검색"
              placeholder="기사·노선·운임 검색"
              className="h-8 w-56 rounded-md border border-white/15 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/50 outline-none focus:border-[var(--color-cyan)]"
            />
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴 열기"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              대시보드
            </p>
            {DASHBOARD_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/5 hover:text-white"
                activeProps={{ className: "text-white bg-white/5" }}
              >
                {item.label}
              </Link>
            ))}
            <p className="mt-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              콘텐츠
            </p>
            {CONTENT_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/5 hover:text-white"
                activeProps={{ className: "text-white bg-white/5" }}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 px-1 pb-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
                <input
                  type="search"
                  aria-label="기사·노선·운임 검색"
                  placeholder="기사·노선·운임 검색"
                  className="h-9 w-full rounded-md border border-white/15 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/50 outline-none focus:border-[var(--color-cyan)]"
                />
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
