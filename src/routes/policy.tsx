import { createFileRoute, redirect } from "@tanstack/react-router";

// 옛 URL 보존 — /policy → /port-risk (IA 정리: 메뉴·제목·URL을 "포트 리스크"로 일치).
// SPA 내비게이션용 라우터 리다이렉트. 외부/직접 진입의 301은 vercel.json redirects가 처리.
export const Route = createFileRoute("/policy")({
  beforeLoad: () => {
    throw redirect({ to: "/port-risk" });
  },
});
