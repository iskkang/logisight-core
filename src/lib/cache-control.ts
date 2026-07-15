// 공개 콘텐츠(개인화 없음) 읽기 응답용 CDN 캐시 값 — 1시간 신선 + 1일 stale-while-revalidate.
// 홈(getIndexStats)·rates와 동일. 서버 함수 핸들러 최상단에서 setResponseHeader로 적용한다.
// SSR 문서 응답과 클라이언트 내비게이션 RPC 응답 모두에 CDN(Vercel) 캐시가 걸린다.
export const PUBLIC_SWR_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
