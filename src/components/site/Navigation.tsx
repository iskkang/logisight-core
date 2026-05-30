import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "홈" },
  { to: "/news", label: "뉴스" },
  { to: "/rates", label: "운임·지수" },
  { to: "/eurasia", label: "유라시아" },
  { to: "/industries", label: "산업별" },
  { to: "/trade", label: "무역동향" },
] as const;

export function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10"
      style={{ background: "var(--color-navy-900)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 lg:px-6">
        <Logo className="text-lg lg:text-xl" />

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="relative px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{
                className:
                  "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[var(--color-cyan)]",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
            <input
              type="search"
              aria-label="기사·노선·운임 검색"
              placeholder="기사·노선·운임 검색"
              className="h-8 w-64 rounded-md border border-white/15 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/50 outline-none focus:border-[var(--color-cyan)]"
            />
          </div>
          <span
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: "var(--color-cyan)",
              color: "var(--color-navy-900)",
            }}
          >
            매주 업데이트
          </span>
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
            {NAV.map((item) => (
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
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}