// 인사이트 하위 SubNav (8항목) — 포트·종합 등 인사이트 내부 페이지 공용. 현재 경로로 활성 탭 결정.
import { Link, useRouterState } from "@tanstack/react-router";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";

// 스크롤바 숨김 — 페이지별 커스텀 스크롤바(.lsg*-root *{scrollbar-width:thin})에 덮이지 않도록 !important.
const SCROLL_HIDE = `.lsg-insight-sub{scrollbar-width:none !important;-ms-overflow-style:none !important}.lsg-insight-sub::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important}`;

const TABS = [
  // to 는 이동할 주소, match 는 "이 메뉴에 속한 경로" 기준이다 ★
  // /rail 은 /rail/americas 로 307 리다이렉트한다. 내비는 모든 페이지에 있어
  // 크롤러가 전 페이지에서 한 홉을 더 탔으므로 링크는 목적지로 직접 건다. 다만
  // 활성 표시는 /rail 하위 전체(americas·eurasia)에서 켜져야 하므로 기준은 /rail 로
  // 남긴다 —— to 를 그대로 기준으로 쓰면 /rail/eurasia 에서 "철도"가 꺼진다.
  { to: "/dashboard", match: "/dashboard", label: "종합" },
  { to: "/forecasts", match: "/forecasts", label: "전망" },
  { to: "/rates", match: "/rates", label: "운임" },
  { to: "/rail/americas", match: "/rail", label: "철도" },
  { to: "/port-risk", match: "/port-risk", label: "포트" },
  { to: "/trade", match: "/trade", label: "무역" },
  { to: "/industries", match: "/industries", label: "산업" },
  { to: "/climate", match: "/climate", label: "기상" },
] as const;

export function InsightSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b border-[#78a0cd1c] bg-[#0a0f1d]">
      <style>{SCROLL_HIDE}</style>
      <div className={`lsg-insight-sub ${WRAP} flex h-[46px] items-center gap-[22px] overflow-x-auto text-[13.5px]`}>
        <span className="flex-none text-[10.5px] font-bold tracking-[0.18em] text-[#5d6b80]">INSIGHT</span>
        {TABS.map((t) => {
          const active = pathname === t.match || pathname.startsWith(`${t.match}/`);
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
