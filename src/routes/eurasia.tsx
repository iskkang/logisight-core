import { createFileRoute, redirect } from "@tanstack/react-router";

// 옛 URL 보존 — /eurasia → /rail/eurasia (철도 허브로 이관). 콘텐츠는 RailEurasiaContent로 재사용.
export const Route = createFileRoute("/eurasia")({
  beforeLoad: () => {
    throw redirect({ to: "/rail/eurasia" });
  },
});
