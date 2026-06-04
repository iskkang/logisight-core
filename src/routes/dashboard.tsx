import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "종합 Control Tower — Logisight" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <p className="text-sm text-muted-foreground">데이터 수집 중</p>
    </main>
  );
}
