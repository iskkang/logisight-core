import { createFileRoute, redirect } from "@tanstack/react-router";

// /rail/europe 폐지 — 유럽 철도 뉴스는 번역 후 철도 뉴스(/news?cat=철도)로 일원화됐다.
// 기존 링크·색인 404 방지를 위해 철도 뉴스로 리다이렉트한다.
export const Route = createFileRoute("/rail/europe")({
  beforeLoad: () => {
    throw redirect({ to: "/news", search: { cat: "철도" } });
  },
});
