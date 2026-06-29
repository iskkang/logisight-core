import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

// /admin 공통 레이아웃 — 상단 탭 바 + 아래 Outlet(선택한 도구 내용).
// 로그인 페이지(/admin/login)는 탭 없이 그대로 노출. 인증은 각 하위 페이지가 처리.
const TABS = [
  { to: "/admin", label: "개요" },
  { to: "/admin/subscribers", label: "뉴스레터 구독자" },
  { to: "/admin/routes", label: "노선 관리" },
  { to: "/admin/policies", label: "정책 관리" },
  { to: "/admin/forecasts", label: "전망 검수" },
  { to: "/admin/partner-rates", label: "실측 운임" },
] as const;

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/admin/login") return <Outlet />;

  return (
    <div>
      <div className="border-b border-[var(--color-line)] bg-white">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 lg:px-6">
          {TABS.map((t) => {
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[var(--color-navy-900)] text-[var(--color-navy-900)]"
                    : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
