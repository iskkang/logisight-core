// GA4 이벤트 전송 헬퍼.
// 태그는 정본 호스트에서만 로드되므로(__root.tsx 호스트 가드) 프리뷰·로컬에는 gtag이 없다.
// 없을 때 조용히 넘어가지 않으면 구독 성공 처리까지 같이 죽는다.

type Gtag = (...args: unknown[]) => void;

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const gtag = (globalThis as { gtag?: Gtag }).gtag;
  gtag?.("event", name, params);
}
