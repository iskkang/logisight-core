// 공통 브레드크럼 — GNB 정보구조(홈 · 뉴스 · 대시보드>서브)를 경로에서 도출.
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; to?: string };

// 대시보드 서브 페이지 라벨(서브 GNB와 동일 소스).
const DASH_SUB: Record<string, string> = {
  "/forecasts": "전망",
  "/rates": "운임",
  "/eurasia": "유라시아",
  "/policy": "포트",
  "/trade": "무역",
  "/industries": "산업",
};

const HOME: Crumb = { label: "홈", to: "/" };

// 경로 → 크럼 배열. 홈/관리자/기사는 null(기사는 제목 필요 → 페이지에서 직접 렌더).
export function crumbsFor(pathname: string): Crumb[] | null {
  const p = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (p === "/" || p.startsWith("/admin") || p.startsWith("/article")) return null;

  if (p === "/news") return [HOME, { label: "뉴스" }];
  if (p === "/briefing") return [HOME, { label: "주간 브리핑" }];
  if (p === "/dashboard") return [HOME, { label: "인사이트" }];

  const dash: Crumb = { label: "인사이트", to: "/dashboard" };
  for (const [path, label] of Object.entries(DASH_SUB)) {
    if (p === path || p.startsWith(`${path}/`)) return [HOME, dash, { label }];
  }
  return null;
}

// 프레젠테이션 — 마지막 항목은 현재 페이지(비링크 · aria-current).
export function Breadcrumb({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="브레드크럼" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11.5px] leading-none">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-x-1">
              {i > 0 && (
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-muted-foreground/40"
                  aria-hidden
                />
              )}
              {c.to && !last ? (
                <Link
                  to={c.to}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-medium text-foreground/90" : "text-muted-foreground"}
                  aria-current={last ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// 경로 자동 도출 래퍼 — 각 페이지 콘텐츠 영역 상단(히어로 아래)에 배치.
// 컨테이너 없이 nav만 렌더 → 페이지의 좌우 패딩을 그대로 상속.
export function RouteBreadcrumb({ className = "" }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = crumbsFor(pathname);
  if (!items) return null;
  return <Breadcrumb items={items} className={className} />;
}
