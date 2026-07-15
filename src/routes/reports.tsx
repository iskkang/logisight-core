import { createFileRoute, Outlet } from "@tanstack/react-router";

// /reports 레이아웃 — 목록(index)과 발행물별 영구 페이지(weekly/$week·monthly/$month)의
// 공통 부모. 각 리프가 자체 HomeNav/HomeFooter를 렌더하므로 여기선 <Outlet/>만 둔다.
export const Route = createFileRoute("/reports")({
  component: () => <Outlet />,
});
