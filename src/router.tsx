import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteSkeleton } from "./components/ui/RouteSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // hover/touch로 의도를 보이면 라우트 loader를 미리 실행 → 클릭 시 데이터가 대개 준비돼
    // 라우트 전환 시 흰 화면 깜빡임(useSuspenseQuery 재suspend)을 줄인다. CDN 캐시(배치 B)로
    // 프리로드 요청도 저렴하다. defaultPreloadStaleTime:0이라 React Query 캐시가 신선도를 관리.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // 라우트 전환이 늦어질 때 보여줄 뼈대. 라우트마다 붙이지 않고 여기서 한 번에 건다 ——
    // useSuspenseQuery 를 24곳에서 쓰는데 pendingComponent 가 어느 라우트에도 없어서,
    // 느린 회선에서는 화면이 멈춰 있다가 갑자기 바뀌었다(눌린 건지 아닌지가 안 보였다).
    // 개별 라우트가 자기 뼈대를 갖고 싶으면 그 라우트에서 pendingComponent 로 덮으면 된다.
    defaultPendingComponent: RouteSkeleton,
    // 300ms 안에 끝나는 전환에는 뼈대를 띄우지 않는다 —— 깜빡임이 없느니만 못하다.
    // 일단 띄웠으면 최소 400ms 는 유지한다(떴다 말면 그게 더 어수선하다).
    defaultPendingMs: 300,
    defaultPendingMinMs: 400,
    // SSR 쿼리 캐시 전수: 서버 loader가 ensureQueryData로 채운 React Query 캐시를
    // 직렬화(dehydrate)해 클라이언트에서 복원(hydrate)한다. 이 배선이 없으면 클라이언트는
    // 빈 QueryClient로 시작 → 하이드레이션 시점에 모든 useSuspenseQuery가 다시 suspend되고,
    // 앱에 Suspense 경계가 없어 라우트 전체가 흰 배경으로 깜빡이며 스크롤이 최상단으로 리셋된다.
    // @ts-expect-error DehydratedState의 query data가 unknown 타입이라 TanStack 직렬화 검증만 통과 못 함 — 런타임 값은 전부 JSON 직렬화 가능.
    dehydrate: () => ({ queryClientState: dehydrate(queryClient) }),
    hydrate: (dehydrated) => hydrate(queryClient, dehydrated.queryClientState),
  });

  return router;
};
