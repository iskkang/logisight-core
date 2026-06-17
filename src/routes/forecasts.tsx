import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ForecastCardGrid } from "@/components/forecasts/ForecastCardGrid";
import { ForecastDetailPanel } from "@/components/forecasts/ForecastDetailPanel";
import { ForecastHero } from "@/components/forecasts/ForecastHero";
import { ForecastMethodology } from "@/components/forecasts/ForecastMethodology";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";
import { Collecting, KpiCard, Panel, PBadge, Segment } from "@/components/proto/Kit";
import { MODULE_LABEL } from "@/lib/api/forecasts";
import {
  applyFilter,
  computeKpis,
  hitRateTrend,
  displayOrderOf,
  latestPerMetric,
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
    ]);
  },
  component: ForecastsPage,
});

// 방향 세그먼트 ↔ URL dir[] 매핑
const DIR_SEG = ["전체 방향", "상승", "보합", "하락"] as const;
type DirSeg = (typeof DIR_SEG)[number];
const DIR_TO_QUERY: Record<DirSeg, string[]> = {
  "전체 방향": [],
  상승: ["up"],
  보합: ["flat"],
  하락: ["down"],
};
const CAD_SEG = ["전체", "주간", "월간"] as const;
type CadSeg = (typeof CAD_SEG)[number];

function ForecastsPage() {
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const kpis = computeKpis(forecasts);
  const trend = hitRateTrend(forecasts);
  const hasTrend = trend.some((p) => p.sample > 0);
  // 카드는 지표당 최신 1장만(누적 방지). 적중률·추이 KPI는 아래에서 전수(forecasts)로 계산 — 분리 유지.
  const allOpen = latestPerMetric(forecasts.filter((f) => f.status === "published"));
  const lastUpdated = forecasts.reduce<string | null>(
    (m, f) => (f.published_at && (!m || f.published_at > m) ? f.published_at : m),
    null,
  );
  const modules = [...new Set(allOpen.map((f) => f.module))].map((k) => ({
    key: k,
    label: MODULE_LABEL[k],
  }));

  const open = search.mod ? allOpen.filter((f) => f.module === search.mod) : allOpen;
  const filter: ForecastFilter = {
    cadence: search.cadence,
    dir: search.dir,
    series: search.series,
  };
  // 기본 정렬: displayOrder(중요도 순) — 보드·카드·상세 공통 단일 소스.
  const filtered = applyFilter(open, filter).sort((a, b) => displayOrderOf(a) - displayOrderOf(b));
  const selectedId = search.sel ?? filtered[0]?.id ?? null;
  const selected = open.find((f) => f.id === selectedId) ?? filtered[0] ?? null;

  const dirSeg: DirSeg =
    search.dir.length === 1
      ? search.dir[0] === "up"
        ? "상승"
        : search.dir[0] === "flat"
          ? "보합"
          : search.dir[0] === "down"
            ? "하락"
            : "전체 방향"
      : "전체 방향";
  const cadSeg: CadSeg =
    search.cadence === "weekly" ? "주간" : search.cadence === "monthly" ? "월간" : "전체";

  const setDir = (v: DirSeg) =>
    navigate({ search: (prev: Search) => ({ ...prev, dir: DIR_TO_QUERY[v] }), replace: true });
  const setCadence = (v: CadSeg) =>
    navigate({
      search: (prev: Search) => ({
        ...prev,
        cadence: v === "주간" ? "weekly" : v === "월간" ? "monthly" : undefined,
      }),
      replace: true,
    });
  const setSel = (id: string) =>
    // resetScroll:false — 카드 클릭 시 같은 자리에서 아래 상세 카드만 갱신(맨 위로 점프 방지).
    navigate({ search: (prev: Search) => ({ ...prev, sel: id }), replace: true, resetScroll: false });
  const setMod = (key: string | null) =>
    navigate({
      search: (prev: Search) => ({ ...prev, mod: key ?? undefined, sel: undefined }),
      replace: true,
    });

  const heroChips: { label: string; value: string; color: string }[] = [];
  if (kpis.hitRate.rate != null)
    heroChips.push({
      label: "방향 적중률",
      value: `${kpis.hitRate.rate}%`,
      color: "var(--color-status-normal)",
    });
  heroChips.push({
    label: "이번 주 발행",
    value: `${kpis.publishedThisWeek}건`,
    color: "var(--color-cyan)",
  });
  heroChips.push({
    label: "판정 대기",
    value: `${kpis.awaitingJudgment}건`,
    color: "var(--color-status-caution)",
  });

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <ForecastHero
        lastUpdated={lastUpdated}
        modules={modules}
        activeModule={search.mod ?? null}
        onModule={setMod}
        chips={heroChips}
      />
      <div className="mx-auto max-w-[1540px] px-4 py-[26px] lg:px-12">
        <RouteBreadcrumb className="mb-4" />
        {/* KPI 5칸 — 프로토타입 ls-grid-5, 전부 실데이터 */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            mono={false}
            label="방향 적중률 (12주)"
            value={kpis.hitRate.gate ? "누적 중" : `${kpis.hitRate.rate}%`}
            sub={
              kpis.hitRate.gate
                ? `판정 표본 ${kpis.hitRate.sample}/10`
                : `${kpis.hitRate.sample}건 판정 기준`
            }
            iconColor="var(--status-normal)"
            icon={<span style={{ fontWeight: 700 }}>✓</span>}
          />
          <KpiCard
            mono={false}
            label="이번 주 발행"
            value={`${kpis.publishedThisWeek}건`}
            sub="검수 통과 발행"
            iconColor="var(--cyan)"
            icon={<span style={{ fontWeight: 700 }}>＋</span>}
          />
          <KpiCard
            mono={false}
            label="판정 대기"
            value={`${kpis.awaitingJudgment}건`}
            sub="확인 일정 전"
            iconColor="var(--status-caution)"
            icon={<span style={{ fontWeight: 700 }}>⏱</span>}
          />
          <KpiCard
            mono={false}
            label="근거 데이터 평균"
            value={kpis.avgEvidence != null ? `${kpis.avgEvidence}/5` : "—"}
            sub="발행 전망 기준"
            iconColor="var(--status-observe)"
            icon={<span style={{ fontWeight: 700 }}>◉</span>}
          />
          <KpiCard
            mono={false}
            label="평균 리드타임"
            value={kpis.leadTimeDays != null ? `${kpis.leadTimeDays}일` : "—"}
            sub="발행 → 판정"
            iconColor="var(--ink-muted)"
            icon={<span style={{ fontWeight: 700 }}>→</span>}
          />
        </div>

        {/* 주간 방향 적중률 추이 — 목표 60% 기준선 */}
        <Panel
          title="주간 방향 적중률 추이"
          badge={<PBadge>최근 12주 · 분모 = 발행 전수</PBadge>}
          style={{ marginTop: 16 }}
        >
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  width={40}
                  tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "방향 적중률"]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={60}
                  stroke="var(--ink-muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: "목표 60%",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "var(--ink-muted)",
                  }}
                />
                <Line
                  dataKey="rate"
                  stroke="var(--status-normal)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Collecting note="판정된 전망이 누적되면 주간 적중률 추이가 표시됩니다." />
          )}
        </Panel>

        {open.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">데이터 수집 중</p>
            <p className="mt-1 text-xs text-muted-foreground">
              검수를 통과한 전망이 게재되면 이곳에 표시됩니다.
            </p>
          </div>
        ) : (
          <>
            {/* 필터 세그먼트 — 프로토타입: 주기 + 방향 */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Segment options={CAD_SEG} value={cadSeg} onChange={setCadence} />
              <Segment options={DIR_SEG} value={dirSeg} onChange={setDir} />
              <span className="ml-auto text-xs text-muted-foreground">
                카드 클릭 시 전망 상세 · 팩터 스코어 · 판정 결과
              </span>
            </div>

            {/* 전망 카드 그리드 */}
            <div className="mt-6">
              <h2 className="mb-3 text-[17px] font-extrabold text-foreground">전망 카드</h2>
              <ForecastCardGrid
                forecasts={filtered}
                series={series}
                selectedId={selectedId}
                onSelect={setSel}
              />
            </div>

            {/* 선택 전망 통합 카드 — 그래프 + 종합 신호 + 핵심 인사이트 한 장 */}
            <div className="mt-6">
              {selected && <ForecastDetailPanel f={selected} series={series[selected.id]} />}
            </div>

            {/* 디스클레이머 밴드 */}
            <div
              className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3.5"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
            >
              <span className="text-[13px] text-muted-foreground">
                전망은 정보 제공 목적이며 투자·계약 권유가 아닙니다. 모든 전망은 확률로 표현됩니다.
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                AI 초안 · 에디터 검수
              </span>
            </div>
          </>
        )}

        <ForecastMethodology />
      </div>
    </main>
  );
}

export type { SeriesClass };
