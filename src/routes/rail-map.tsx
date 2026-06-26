import { createFileRoute, redirect } from "@tanstack/react-router";

// 옛 URL 보존 — /rail-map → /rail/americas (철도 허브로 이관). 지도는 RailAmericasMap로 재사용.
export const Route = createFileRoute("/rail-map")({
  beforeLoad: () => {
    throw redirect({ to: "/rail/americas" });
  },
});
