import { createFileRoute, redirect } from "@tanstack/react-router";

// /rail → /rail/americas (기본 지역).
export const Route = createFileRoute("/rail/")({
  beforeLoad: () => {
    throw redirect({ to: "/rail/americas" });
  },
});
