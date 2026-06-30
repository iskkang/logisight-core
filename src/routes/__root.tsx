import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Navigation } from "@/components/site/Navigation";
import { Footer } from "@/components/site/Footer";
import LogisightLoader from "@/components/LogisightLoader";

// Minimal shell without IndexBar — safe to use outside QueryClientProvider
function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-surface)" }}>
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function NotFoundComponent() {
  return (
    <MinimalShell>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-lg font-semibold">페이지를 찾을 수 없습니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            홈으로 가기
          </Link>
        </div>
      </div>
    </MinimalShell>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <MinimalShell>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">페이지를 불러오지 못했습니다</h1>
          <p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              다시 시도
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              홈으로
            </a>
          </div>
        </div>
      </div>
    </MinimalShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Logisight — 물류를 읽는 새로운 시선" },
      {
        name: "description",
        content:
          "MTL Shipping Agency가 운영하는 한국 화주·포워더를 위한 물류 인텔리전스 플랫폼. 운임 지수, 물류 뉴스, 유라시아 코리도어, 정책 변화를 매주 한 편의 분석으로.",
      },
      { name: "author", content: "MTL Shipping Agency" },
      { property: "og:title", content: "Logisight — 물류를 읽는 새로운 시선" },
      {
        property: "og:description",
        content: "운임 지수와 물류 뉴스, 정책 변화. 매주 한 편의 분석으로 정리합니다.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Logisight" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Logisight — 물류를 읽는 새로운 시선" },
      {
        name: "twitter:description",
        content: "운임 지수와 물류 뉴스, 정책 변화. 매주 한 편의 분석으로 정리합니다.",
      },
      {
        property: "og:image",
        content: "https://logisight.mtlship.com/og-default.png",
      },
      {
        name: "twitter:image",
        content: "https://logisight.mtlship.com/og-default.png",
      },
    ],
    links: [
      // 폰트는 HTML link로 로드한다. styles.css의 @import url(...)은 Tailwind v4 빌드에서
      // 다른 규칙 뒤에 위치해 드롭되므로(브라우저 미요청) Pretendard가 로드되지 않았다.
      { rel: "preconnect", href: "https://cdn.jsdelivr.net" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Playfair+Display:wght@700;900&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Logisight",
          url: "https://logisight.mtlship.com",
          logo: "https://logisight.mtlship.com/logisight_logo.svg",
          publisher: { "@type": "Organization", name: "MTL Shipping Agency" },
          sameAs: ["https://mtlship.com"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Logisight",
          url: "https://logisight.mtlship.com",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // 최초 풀 로드(SSR→하이드레이션) 동안만 브랜드 로더 노출. SPA 내비게이션엔 RootComponent가
  // 다시 마운트되지 않으므로 재노출되지 않는다(서브내비 클릭마다 깜빡이는 문제 방지).
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LogisightLoader show={loading} />
      <SiteShell>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </SiteShell>
    </QueryClientProvider>
  );
}

// Product pages keep the dark/light toggle; editorial pages are pinned light
// via the .theme-light scope. 종합(/dashboard)은 dashboard.css 라이트 전용 디자인이라
// 토글에서 제외하고 강제 라이트로 둔다(전역 다크가 켜져 있어도 일관 라이트).
const THEME_TOGGLE_PREFIXES = [
  "/rates",
  "/trade",
  "/policy",
  "/eurasia",
  "/forecasts",
  "/industries",
];

function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // 자체 Nav/Footer를 가진 리디자인 페이지(홈·뉴스·기사·포트·종합·전망)는 전체 레이아웃을 스스로
  // 책임진다 → 글로벌 Navigation/Footer/theme-light 래퍼를 건너뛴다. 다른 라우트는 영향 없음.
  // /article/<slug>는 동적 경로라 정확 일치가 안 되므로 prefix로 판별한다.
  if (
    [
      "/",
      "/news",
      "/reports",
      "/policy",
      "/dashboard",
      "/forecasts",
      "/rates",
      "/eurasia",
      "/climate",
      "/trade",
      "/industries",
      "/briefing",
      "/faq",
    ].includes(pathname) ||
    pathname.startsWith("/article/") ||
    pathname.startsWith("/rail") // /rail 허브는 자체 HomeNav/Footer를 가짐 → 글로벌 Navigation 중복 방지
  ) {
    return <>{children}</>;
  }

  const isThemeTogglePage = THEME_TOGGLE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  return (
    <div
      className={`flex min-h-screen flex-col ${isThemeTogglePage ? "" : "theme-light"}`}
      style={{ background: "var(--color-surface)" }}
    >
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
