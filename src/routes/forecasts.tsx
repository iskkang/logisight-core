import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ForecastKpiStrip } from "@/components/forecasts/ForecastKpiStrip";
import { ForecastFilters } from "@/components/forecasts/ForecastFilters";
import { ForecastCardGrid } from "@/components/forecasts/ForecastCardGrid";
import { ForecastDetailPanel } from "@/components/forecasts/ForecastDetailPanel";
import { ForecastAnalystPanel } from "@/components/forecasts/ForecastAnalystPanel";
import { ForecastHero } from "@/components/forecasts/ForecastHero";
import { ForecastMethodology } from "@/components/forecasts/ForecastMethodology";
import { MODULE_LABEL } from "@/lib/api/forecasts";
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
  riskNotesQueryOptions,
  dataUpdatesQueryOptions,
} from "@/lib/api/forecasts";

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];

type Search = {
  cadence?: "weekly" | "monthly";
  dir: string[];
  series: string[];
  sel?: string;
  mod?: string;
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
    mod: typeof s.mod === "string" ? s.mod : undefined,
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
      context.queryClient.ensureQueryData(forecastSeriesQueryOptions()),
      context.queryClient.ensureQueryData(riskNotesQueryOptions()),
      context.queryClient.ensureQueryData(dataUpdatesQueryOptions()),
    ]);
  },
  component: ForecastsPage,
});

function ForecastsPage() {
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const { data: riskNotes } = useSuspenseQuery(riskNotesQueryOptions());
  const { data: dataUpdates } = useSuspenseQuery(dataUpdatesQueryOptions());
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const kpis = computeKpis(forecasts);
  const allOpen = forecasts.filter((f) => f.status === "published");
  const lastUpdated = forecasts.reduce<string | null>(
    (m, f) => (f.published_at && (!m || f.published_at > m) ? f.published_at : m),
    null,
  );
  const modules = [...new Set(allOpen.map((f) => f.module))].map((k) => ({ key: k, label: MODULE_LABEL[k] }));

  const open = search.mod ? allOpen.filter((f) => f.module === search.mod) : allOpen;
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
  const setMod = (key: string | null) =>
    navigate({ search: (prev: Search) => ({ ...prev, mod: key ?? undefined, sel: undefined }), replace: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <ForecastHero
        lastUpdated={lastUpdated}
        modules={modules}
        activeModule={search.mod ?? null}
        onModule={setMod}
      />

      <div className="mt-5">
        <ForecastKpiStrip kpis={kpis} />
      </div>

      {open.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">데이터 수집 중</p>
          <p className="mt-1 text-xs text-muted-foreground">검수를 통과한 전망이 게재되면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[180px_minmax(0,1fr)_320px]">
          <ForecastFilters value={filter} onChange={setFilter} seriesCounts={seriesCounts} />
          <div className="space-y-5">
            <div>
              <div className="mb-3 text-sm font-semibold text-foreground">전망 카드</div>
              <ForecastCardGrid forecasts={filtered} series={series} selectedId={selectedId} onSelect={setSel} />
            </div>
            {selected && <ForecastDetailPanel f={selected} series={series[selected.id]} />}
          </div>
          <div className="lg:col-span-2 xl:col-span-1">
            <div className="mb-3 text-sm font-semibold text-foreground">분석자 패널</div>
            <ForecastAnalystPanel forecast={selected} dataUpdates={dataUpdates} riskNotes={riskNotes} />
          </div>
        </div>
      )}

      <ForecastMethodology />
    </div>
  );
}

export type { SeriesClass };
