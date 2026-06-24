// src/components/home/HomeNav.tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";

const WRAP = "mx-auto w-full max-w-[1200px] px-[18px] min-[620px]:px-7";

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

export function HomeNav({ active = "home" }: { active?: "home" | "news" | "insight" | "reports" }) {
  const [open, setOpen] = useState(false);
  const underline = <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded bg-[#2dd4bf]" />;
  const topCls = (key: "home" | "news" | "insight" | "reports") =>
    key === active ? "relative py-1 text-white" : "py-1 text-[#93a1b7] transition-colors hover:text-white";
  return (
    <header className="sticky top-0 z-50 border-b border-[#78a0cd1c] bg-[#070b16cc] backdrop-blur-[14px] backdrop-saturate-150">
      <div className={`${WRAP} flex h-[62px] items-center gap-9`}>
        <Link to="/"><Wordmark /></Link>
        <nav className="hidden gap-[26px] text-[14px] font-medium text-[#93a1b7] min-[620px]:flex">
          <Link to="/" className={topCls("home")}>
            홈{active === "home" && underline}
          </Link>
          <Link to="/news" className={topCls("news")}>뉴스{active === "news" && underline}</Link>
          {active === "insight" ? (
            // 인사이트 내부 페이지 — 하위 SubNav가 이미 있으므로 드롭다운/▼ 없이 활성 표시만.
            <Link to="/dashboard" className="relative py-1 text-white">인사이트{underline}</Link>
          ) : (
            // 홈/뉴스 — 인사이트 호버 드롭다운(기존 SUB_GNB)으로 하위 메뉴 노출.
            <div className="group relative py-1">
              <Link to="/dashboard" className="inline-flex items-center gap-1 text-[#93a1b7] transition-colors hover:text-white">
                인사이트
                <span className="text-[9px] text-[#2dd4bf] transition-transform group-hover:rotate-180" aria-hidden>▼</span>
              </Link>
              <div className="invisible absolute left-0 top-full z-50 min-w-[160px] rounded-[10px] border border-[#78a0cd1c] bg-[#0a0f1d] p-1.5 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100">
                {SUB_GNB.map((s) => (
                  <Link key={s.to} to={s.to} className="block rounded-[7px] px-3 py-2 text-[13px] text-[#93a1b7] hover:bg-white/5 hover:text-white">
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Link to="/reports" className={topCls("reports")}>
            리포트{active === "reports" && underline}
          </Link>
        </nav>
        <div className="ml-auto hidden text-[13px] text-[#5d6b80] min-[620px]:block">
          <b className="text-white">KOR</b> · ENG
        </div>
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#78a0cd33] text-white min-[620px]:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-[#78a0cd1c] px-[18px] py-2 min-[620px]:hidden">
          <Link to="/" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[15px] text-white">홈</Link>
          <Link to="/news" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[15px] text-[#93a1b7]">뉴스</Link>
          {active === "insight" ? (
            // 인사이트 내부 — 하위는 SubNav가 노출하므로 모바일에서도 상위 링크만.
            <Link to="/dashboard" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[15px] text-white">인사이트</Link>
          ) : (
            <>
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d6b80]">Insight</p>
              {SUB_GNB.map((s) => (
                <Link key={s.to} to={s.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-[14px] text-[#93a1b7]">
                  {s.label}
                </Link>
              ))}
            </>
          )}
          <Link to="/reports" onClick={() => setOpen(false)} className={`block rounded-md px-3 py-2 text-[15px] ${active === "reports" ? "text-white" : "text-[#93a1b7]"}`}>리포트</Link>
        </nav>
      )}
    </header>
  );
}
