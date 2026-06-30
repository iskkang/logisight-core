import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
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
