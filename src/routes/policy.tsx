import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [{ title: "정책·리스크 — Logisight" }],
  }),
  component: PolicyPage,
});

function PolicyPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <p className="text-sm text-muted-foreground">데이터 수집 중</p>
    </main>
  );
}
