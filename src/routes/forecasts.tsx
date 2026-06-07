import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ForecastKpiStrip } from "@/components/forecasts/ForecastKpiStrip";
import { ForecastFilters } from "@/components/forecasts/ForecastFilters";
import { ForecastCardGrid } from "@/components/forecasts/ForecastCardGrid";
import { ForecastDetailPanel } from "@/components/forecasts/ForecastDetailPanel";
import {
  applyFilter,
  computeKpis,
  seriesClassOf,
  type ForecastFilter,
  type SeriesClass,
} from "@/components/forecasts/forecastUtils";
import {
  publishedForecastsQueryOptions,
  forecastSeriesQueryOptions,
} from "@/lib/api/forecasts";

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];

type Search = {
  cadence?: "weekly" | "monthly";
  dir: string[];
  series: string[];
  sel?: string;
};

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
  validateSearch: (s: Record<string, unknown>): Search => ({
    cadence: s.cadence === "weekly" || s.cadence === "monthly" ? s.cadence : undefined,
    dir: arr(s.dir),
    series: arr(s.series),
    sel: typeof s.sel === "string" ? s.sel : undefined,
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
      context.queryClient.ensureQueryData(forecastSeriesQueryOptions()),
    ]);
  },
  component: ForecastsPage,
});

function ForecastsPage() {
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const kpis = computeKpis(forecasts);
  const open = forecasts.filter((f) => f.status === "published");

  const filter: ForecastFilter = { cadence: search.cadence, dir: search.dir, series: search.series };
  const filtered = applyFilter(open, filter);
  const selectedId = search.sel ?? filtered[0]?.id ?? null;
  const selected = open.find((f) => f.id === selectedId) ?? filtered[0] ?? null;

  // 지표 계열별 건수(필터 전 기준)
  const seriesCounts: Record<string, number> = {};
  for (const f of open) {
    const sc = seriesClassOf(f);
    if (sc) seriesCounts[sc] = (seriesCounts[sc] ?? 0) + 1;
  }

  const setFilter = (next: ForecastFilter) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...next }), replace: true });
  const setSel = (id: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, sel: id }), replace: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-status-observe">AI 인텔리전스</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-heading">물류 시장 전망</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          정량 모델(팩터 채점)과 에디터 검수를 결합해 향후 2~4주 방향을 제시합니다. 모든 전망은 단정이
          아닌 확률 표현이며, 판정일에 실측값으로 사후 적중을 매깁니다.
        </p>
      </header>

      <div className="mt-5">
        <ForecastKpiStrip kpis={kpis} />
      </div>

      {open.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">데이터 수집 중</p>
          <p className="mt-1 text-xs text-muted-foreground">검수를 통과한 전망이 게재되면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[180px_1fr]">
          <ForecastFilters value={filter} onChange={setFilter} seriesCounts={seriesCounts} />
          <div className="space-y-5">
            <div>
              <div className="mb-3 text-sm font-semibold text-foreground">전망 카드</div>
              <ForecastCardGrid forecasts={filtered} series={series} selectedId={selectedId} onSelect={setSel} />
            </div>
            {selected && <ForecastDetailPanel f={selected} series={series[selected.id]} />}
          </div>
        </div>
      )}

      <p className="mt-10 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        방법론: 팩터(모멘텀·공급·수요·비용·가격)를 −2~+2로 채점해 가중 합산한 종합 점수로 방향·예상
        범위를 산출합니다. 결측 팩터는 가중치를 재분배하며, 인과 단정 없이 상관·정합·추정으로만
        기술합니다. 적중률은 발행된 전망 전수를 분모로 합니다.
      </p>
    </div>
  );
}

export type { SeriesClass };
