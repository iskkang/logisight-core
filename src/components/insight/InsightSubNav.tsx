// 인사이트 하위 SubNav (8항목) — 포트·종합 등 인사이트 내부 페이지 공용. 현재 경로로 활성 탭 결정.
import { Link, useRouterState } from "@tanstack/react-router";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";

// 스크롤바 숨김 — 페이지별 커스텀 스크롤바(.lsg*-root *{scrollbar-width:thin})에 덮이지 않도록 !important.
const SCROLL_HIDE = `.lsg-insight-sub{scrollbar-width:none !important;-ms-overflow-style:none !important}.lsg-insight-sub::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important}`;

const TABS = [
  { to: "/dashboard", label: "종합" },
  { to: "/forecasts", label: "전망" },
  { to: "/rates", label: "운임" },
  { to: "/rail", label: "철도" },
  { to: "/port-risk", label: "포트 리스크" },
  { to: "/trade", label: "무역" },
  { to: "/industries", label: "산업" },
  { to: "/climate", label: "기후예측" },
] as const;

export function InsightSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b border-[#78a0cd1c] bg-[#0a0f1d]">
      <style>{SCROLL_HIDE}</style>
      <div className={`lsg-insight-sub ${WRAP} flex h-[46px] items-center gap-[22px] overflow-x-auto text-[13.5px]`}>
        <span className="flex-none text-[10.5px] font-bold tracking-[0.18em] text-[#5d6b80]">INSIGHT</span>
        {TABS.map((t) => {
          const active = pathname === t.to || pathname.startsWith(`${t.to}/`);
          return (
            <Link key={t.to} to={t.to} className={active
              ? "relative whitespace-nowrap py-[14px] font-semibold text-white after:absolute after:-bottom-px after:left-0 after:right-0 after:h-0.5 after:bg-[#2dd4bf] after:content-['']"
              : "whitespace-nowrap py-[14px] text-[#93a1b7] transition-colors hover:text-white"}>{t.label}</Link>
          );
        })}
      </div>
    </div>
  );
}
