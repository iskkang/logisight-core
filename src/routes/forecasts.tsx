import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ForecastItem } from "@/components/dashboard/ForecastPanel";
import { publishedForecastsQueryOptions, hitRate } from "@/lib/api/forecasts";

export const Route = createFileRoute("/forecasts")({
  head: () => ({
    meta: [
      { title: "물류 시장 전망 — Logisight" },
      {
        name: "description",
        content:
          "한국발 해상 운임 지수·노선의 향후 2~4주 방향을 정량 모델로 채점하고 에디터가 검수해 발행하는 AI 전망. 판정일 실측으로 사후 적중을 매깁니다.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(publishedForecastsQueryOptions());
  },
  component: ForecastsPage,
});

function ForecastsPage() {
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const hr = hitRate(forecasts);
  const open = forecasts.filter((f) => f.status === "published");
  const resolved = forecasts.filter((f) => f.status === "resolved");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-status-observe">
          AI 인텔리전스
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-heading">물류 시장 전망</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          한국발 해상 지수·노선 운임의 향후 2~4주 방향을 정량 모델(팩터 채점)로 산출하고, 에디터가
          검수해 발행합니다. 모든 전망은 단정이 아닌 확률 표현이며, 판정일에 실측값으로 사후 적중을
          매깁니다.
        </p>

        <div className="mt-5 inline-flex items-stretch gap-5 rounded-xl border border-border bg-card px-5 py-3.5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              적중률 · published 전수
            </div>
            <div className="mt-0.5 text-3xl font-bold tabular-nums text-heading">
              {hr.rate != null ? `${hr.rate}%` : "—"}
            </div>
          </div>
          <div className="w-px self-stretch bg-border" />
          <div className="self-center text-xs leading-relaxed text-muted-foreground">
            {hr.resolved > 0 ? (
              <>
                적중 {hr.hit} · 부분 {hr.partial} · 빗나감 {hr.miss}
                <br />
                판정 완료 {hr.resolved}건
              </>
            ) : (
              "판정 표본 누적 중"
            )}
          </div>
        </div>
      </header>

      {forecasts.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">데이터 수집 중</p>
          <p className="mt-1 text-xs text-muted-foreground">
            검수를 통과한 전망이 게재되면 이곳에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className="mt-9">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                진행 중인 전망 <span className="text-muted-foreground">{open.length}</span>
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {open.map((f) => (
                  <ForecastItem key={f.id} f={f} showModule />
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="mt-9">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                트랙 레코드 · 판정 완료 <span className="text-muted-foreground">{resolved.length}</span>
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {resolved.map((f) => (
                  <ForecastItem key={f.id} f={f} showModule />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="mt-10 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        방법론: 팩터(모멘텀·공급·수요·비용·가격)를 −2~+2로 채점해 가중 합산한 종합 점수로 방향·예상
        범위를 산출합니다. 결측 팩터는 가중치를 재분배하며, 인과 단정 없이 상관·정합·추정으로만
        기술합니다. 적중률은 발행된 전망 전수를 분모로 합니다.
      </p>
    </div>
  );
}
