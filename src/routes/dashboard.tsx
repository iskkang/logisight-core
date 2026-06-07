import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { StatusItem } from "@/components/dashboard/StatusStrip";
import { DashboardTicker } from "@/components/dashboard/DashboardTicker";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardKpis, type DashboardKpiData } from "@/components/dashboard/DashboardKpis";
import { FreshnessBadge } from "@/components/dashboard/FreshnessBadge";
import { DIR_META } from "@/components/forecasts/forecastUtils";

import { alertCandidatesQueryOptions, type AlertCandidate } from "@/lib/api/alerts";
import {
  computeMoM,
  indexStatsQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  latestByRoute,
} from "@/lib/api/rates";
import { eurasiaDisruptionsActiveQueryOptions } from "@/lib/api/eurasia-disruptions";
import { eurasiaDelaysQueryOptions } from "@/lib/api/eurasia";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import { publishedForecastsQueryOptions, forecastSeriesQueryOptions } from "@/lib/api/forecasts";
import { HitRateChip } from "@/components/dashboard/ForecastPanel";
import { DashboardJudgmentCard } from "@/components/dashboard/DashboardJudgmentCard";
import { DashboardForecastTiles } from "@/components/dashboard/DashboardForecastTiles";
import { DashboardProcessStrip } from "@/components/dashboard/DashboardProcessStrip";

export const Route = createFileRoute("/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(alertCandidatesQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(kitaAirRatesQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(latestExchangeRateQueryOptions());
    context.queryClient.ensureQueryData(publishedForecastsQueryOptions());
    context.queryClient.ensureQueryData(forecastSeriesQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "종합 Control Tower — Logisight" },
      {
        name: "description",
        content: "오늘의 핵심 변화, 주요 노선 현황, 운임 상승 현황, 정책·장애 요약.",
      },
    ],
  }),
  component: DashboardPage,
});

// --- Severity helpers ---
const SEV_LABEL: Record<string, string> = {
  high: "경고",
  medium: "주의",
  low: "낮음",
  info: "정보",
};
const SEV_COLOR: Record<string, string> = {
  high: "var(--color-status-alert)",
  medium: "var(--color-status-caution)",
  low: "var(--color-status-observe)",
  info: "var(--color-status-observe)",
};
const STATUS_LABEL: Record<string, string> = { new: "신규", escalated: "악화", unchanged: "지속" };

// --- 주요 노선 (MTL 선정) ---
// Fixed, code-defined lanes shown to every visitor — no per-user watchlist.
// admin 편집 기능은 백로그. rate 노선은 해상만(항공 단독 표기는 4요소 제약 위반).
type KeyLane = {
  laneId: string;
  origin: string;
  dest: string;
  mode: "ocean" | "air" | "rail";
  metricType: "rate" | "delay";
  displayOrder: number;
};

const KEY_LANES: KeyLane[] = [
  { laneId: "PUS-LAX", origin: "부산", dest: "로스앤젤레스", mode: "ocean", metricType: "rate", displayOrder: 1 },
  { laneId: "PUS-NYC", origin: "부산", dest: "뉴욕", mode: "ocean", metricType: "rate", displayOrder: 2 },
  { laneId: "PUS-CHI", origin: "부산", dest: "시카고", mode: "ocean", metricType: "rate", displayOrder: 3 },
  { laneId: "KR-ANDIJAN", origin: "한국", dest: "안디잔", mode: "rail", metricType: "delay", displayOrder: 4 },
  { laneId: "CN-ALMATY", origin: "중국", dest: "알마티", mode: "rail", metricType: "delay", displayOrder: 5 },
];

const MODE_LABEL: Record<KeyLane["mode"], string> = { ocean: "해상", air: "항공", rail: "철도" };

// --- Alert card ---
function AlertCard({ alert }: { alert: AlertCandidate }) {
  const color = SEV_COLOR[alert.severity] ?? SEV_COLOR.info;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
      <span
        className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
        style={{ background: `${color}22`, color }}
      >
        {SEV_LABEL[alert.severity]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{alert.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{alert.sub}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {STATUS_LABEL[alert.status] ?? alert.status}
          </span>
          {alert.asOf && <FreshnessBadge asOf={alert.asOf} />}
        </div>
      </div>
      <Link
        to={alert.deepLink as "/"}
        className="shrink-0 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
      >
        분석 ↗
      </Link>
    </div>
  );
}

// 카드 섹션 헤더(우측 링크 옵션).
function CardHead({ title, note, to }: { title: string; note?: string; to?: "/rates" | "/eurasia" }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold">
        {title}
        {note && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{note}</span>}
      </h2>
      {to && (
        <Link to={to} className="text-[11px] text-muted-foreground hover:underline">
          전체 보기 ↗
        </Link>
      )}
    </div>
  );
}

// --- Main page ---
function DashboardPage() {
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: exRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const openForecasts = forecasts.filter((f) => f.status === "published");

  // --- 주요 노선 현황 (MTL 선정) — code-defined, same for every visitor ---
  const keyLaneRows = useMemo(() => {
    const latestSea = latestByRoute(seaRates);
    return [...KEY_LANES]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((lane) => {
        if (lane.metricType === "rate") {
          const row = latestSea.find((r) => r.origin === lane.origin && r.dest === lane.dest);
          if (!row || row.feu == null) return { lane, value: null as string | null, mom: null as number | null };
          const s = seaRates
            .filter((x) => x.origin === lane.origin && x.dest === lane.dest)
            .map((x) => ({ year_mon: x.year_mon, value: x.feu }));
          return { lane, value: `$${row.feu.toLocaleString("en-US")}/FEU`, mom: computeMoM(s) };
        }
        const laneDelays = delays
          .filter((d) => d.lane_id === lane.laneId)
          .sort((a, b) => a.week_iso.localeCompare(b.week_iso));
        const latest = laneDelays.at(-1);
        if (!latest || latest.median_delay_d == null) return { lane, value: null as string | null, mom: null as number | null };
        return { lane, value: `중위 지연 ${latest.median_delay_d}일`, mom: null as number | null };
      });
  }, [seaRates, delays]);

  // --- Top 3 rising rates (compute MoM from KITA source values; chg fields are absolute deltas) ---
  const topRising = useMemo(() => {
    const latestAir = latestByRoute(airRates);
    const latestSea = latestByRoute(seaRates);

    const airItems = latestAir.flatMap((r) => {
      const s = airRates
        .filter((a) => a.origin === r.origin && a.dest === r.dest)
        .map((a) => ({ year_mon: a.year_mon, value: a.kg300 }));
      const mom = computeMoM(s);
      return mom !== null && mom > 0 ? [{ label: `${r.origin}→${r.dest} (항공)`, mom }] : [];
    });

    const seaItems = latestSea.flatMap((r) => {
      const s = seaRates
        .filter((x) => x.origin === r.origin && x.dest === r.dest)
        .map((x) => ({ year_mon: x.year_mon, value: x.feu }));
      const mom = computeMoM(s);
      return mom !== null && mom > 0 ? [{ label: `${r.origin}→${r.dest} (해상)`, mom }] : [];
    });

    // 스파이크 가드 — |MoM|>50%는 검증 전까지 게이트(노출 보류). admin 해제는 백로그.
    const all = [...airItems, ...seaItems];
    const guardedCount = all.filter((x) => Math.abs(x.mom) > 50).length;
    const shown = all.filter((x) => Math.abs(x.mom) <= 50).sort((a, b) => b.mom - a.mom).slice(0, 3);
    return { shown, guardedCount };
  }, [airRates, seaRates]);

  const kcciStat = stats.find((s) => s.index_code === "KCCI");
  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  const medAlerts = alerts.filter((a) => a.severity === "medium").length;

  const statusItems = useMemo(
    (): StatusItem[] => [
      {
        label: "경보",
        value: highAlerts === 0 && medAlerts === 0 ? "없음" : `${highAlerts}건 경고 / ${medAlerts}건 주의`,
        state: highAlerts > 0 ? "alert" : medAlerts > 0 ? "caution" : "normal",
      },
      {
        label: "KCCI WoW",
        value: kcciStat?.change_pct != null ? `${kcciStat.change_pct >= 0 ? "+" : ""}${kcciStat.change_pct.toFixed(1)}%` : "—",
        state: kcciStat?.change_pct == null ? "normal" : Math.abs(kcciStat.change_pct) >= 5 ? "caution" : "normal",
      },
      {
        label: "유라시아",
        value: disruptions.length === 0 ? "정상" : `${disruptions.length}건`,
        state: disruptions.length === 0 ? "normal" : disruptions.length >= 2 ? "caution" : "observe",
      },
      { label: "기준일", value: kcciStat?.latest_date?.slice(0, 10) ?? "—", state: "normal" },
    ],
    [highAlerts, medAlerts, kcciStat, disruptions],
  );

  const today = new Date().toISOString().slice(0, 10);
  const asOf = kcciStat?.latest_date?.slice(0, 10) ?? "—";

  // 티커 — freight_indices 실데이터만(가공 라벨 금지).
  const tickerItems = stats
    .filter((s) => s.latest_value != null)
    .map((s) => ({ code: s.index_code, value: s.latest_value!.toLocaleString("en-US"), changePct: s.change_pct }));

  // KPI ② 종합 판단 = 대표 전망(KCCI)의 방향 + 밴드.
  const kcciForecast = forecasts.find((f) => f.status === "published" && f.metric_ref === "KCCI");
  const repForecast = kcciForecast ?? openForecasts[0] ?? null;
  const modelVersion = forecasts.find((f) => f.model_version)?.model_version ?? "—";
  const judgment =
    kcciForecast?.direction != null
      ? {
          glyph: DIR_META[kcciForecast.direction].glyph,
          label: DIR_META[kcciForecast.direction].label,
          range: kcciForecast.expected_range_pct ?? null,
          dir: kcciForecast.direction,
        }
      : null;
  const awaiting = forecasts.filter(
    (f) => f.status === "published" && f.horizon_date && f.horizon_date > today,
  ).length;
  const kpiData: DashboardKpiData = {
    alertCount: highAlerts + medAlerts,
    alertState: highAlerts > 0 ? "alert" : medAlerts > 0 ? "caution" : "normal",
    judgment,
    awaiting,
    laneCount: KEY_LANES.length,
    indexCount: tickerItems.length,
  };

  return (
    <>
      <DashboardTicker items={tickerItems} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 lg:px-6">
        <DashboardHero
          titlePrefix="종합"
          titleAccent="Control Tower"
          subtitle="글로벌 해상 운임·무역·정책·유라시아 리스크를 통합 분석해 의사결정을 돕는 인텔리전스 플랫폼"
          chips={[{ label: "오늘", value: today, state: "normal" }, ...statusItems]}
        />

        <DashboardKpis data={kpiData} />

        {/* 3단 그리드 — 좌(핵심 변화·데이터 기준) / 중(종합 판단·지수 타일·주요 노선) / 우(스냅샷·상승 TOP·유라시아) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,290px)] lg:items-start">
          {/* ── LEFT ── */}
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">오늘의 핵심 변화</h2>
                {highAlerts > 0 && (
                  <span className="rounded bg-status-alert/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-alert">경고</span>
                )}
              </div>
              {alerts.length === 0 ? (
                <p className="text-xs text-muted-foreground">경보 없음 — 모든 지표 정상 범위</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <AlertCard key={alert.key} alert={alert} />
                  ))}
                </div>
              )}
            </section>

            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-[13px] font-semibold">데이터 기준</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">기준일</dt>
                  <dd className="font-medium tabular-nums">{asOf}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">데이터 수집</dt>
                  <dd className="font-medium tabular-nums">{today}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">수집 소스</dt>
                  <dd className="font-medium">KCCI·SCFI·KITA·환율 외</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">모델 버전</dt>
                  <dd className="font-medium">{modelVersion}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* ── CENTER ── */}
          <div className="min-w-0 space-y-4">
            {repForecast ? (
              <DashboardJudgmentCard f={repForecast} series={series[repForecast.id]} />
            ) : (
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                발행된 전망 없음 — 검수 후 게재됩니다.
              </div>
            )}

            <DashboardForecastTiles forecasts={forecasts} series={series} />

            <div className="rounded-lg border border-border bg-card p-4">
              <CardHead title="주요 노선 현황" note="MTL 선정" />
              <ul className="space-y-2">
                {keyLaneRows.map((r) => (
                  <li key={r.lane.laneId} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium">
                        {r.lane.origin}→{r.lane.dest}
                      </span>
                      <span className="ml-1.5 text-muted-foreground">{MODE_LABEL[r.lane.mode]}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      {r.value ? (
                        <>
                          <span className="font-medium">{r.value}</span>
                          {r.mom != null && (
                            <span
                              className={
                                r.mom > 0 ? "text-direction-up" : r.mom < 0 ? "text-direction-down" : "text-direction-flat"
                              }
                            >
                              {r.mom > 0 ? "▲" : r.mom < 0 ? "▼" : "▬"} {r.mom >= 0 ? "+" : ""}
                              {r.mom.toFixed(1)}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">데이터 수집 중</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-muted-foreground">
                MTL 선정 고정 노선 · 전체 방문자 공통 · 해상 MoM / 철도 중위 지연
              </p>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <CardHead title="글로벌 지수 스냅샷" to="/rates" />
              <div className="space-y-1.5">
                {stats
                  .filter((s) => s.latest_value !== null)
                  .slice(0, 5)
                  .map((s) => (
                    <div key={s.index_code} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.index_code}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span>{s.latest_value?.toLocaleString("en-US") ?? "—"}</span>
                        <span
                          className={
                            s.change_pct == null
                              ? "text-muted-foreground"
                              : s.change_pct > 0
                                ? "text-direction-up"
                                : s.change_pct < 0
                                  ? "text-direction-down"
                                  : "text-direction-flat"
                          }
                        >
                          {s.change_pct != null
                            ? `${s.change_pct > 0 ? "▲ " : s.change_pct < 0 ? "▼ " : "▬ "}${s.change_pct >= 0 ? "+" : ""}${s.change_pct.toFixed(1)}%`
                            : "—"}
                        </span>
                        {s.pct_52w !== null && (
                          <span
                            className={[
                              "rounded px-1 py-0.5 text-[10px]",
                              s.pct_52w >= 85
                                ? "bg-status-alert/10 text-status-alert"
                                : s.pct_52w >= 70
                                  ? "bg-status-caution/10 text-status-caution"
                                  : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            {s.pct_52w}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">WoW · 52주 백분위 · 기준 {asOf}</p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-[13px] font-semibold">가장 크게 상승한 한국발 운임</h2>
              {topRising.shown.length === 0 ? (
                <p className="text-xs text-muted-foreground">운임 데이터 수집 중</p>
              ) : (
                <ul className="space-y-2.5">
                  {topRising.shown.map((r, i) => (
                    <li key={r.label} className="flex items-center gap-3 text-xs">
                      <span className="w-4 shrink-0 text-center font-mono text-muted-foreground">{i + 1}</span>
                      <span className="flex-1">{r.label}</span>
                      <span className="font-mono font-semibold text-direction-up">▲ +{r.mom.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              )}
              {topRising.guardedCount > 0 && (
                <p className="mt-2 rounded bg-status-caution/10 px-2 py-1 text-[11px] text-status-caution">
                  스파이크 가드: |MoM|&gt;50% {topRising.guardedCount}건 검증 중 — 확인 후 노출
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                MoM 기준 · 환율 기준일 {exRate?.rate_date ?? "—"} · KITA
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <CardHead title="유라시아 활성 장애" to="/eurasia" />
              {disruptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">활성 장애 없음</p>
              ) : (
                <ul className="space-y-2">
                  {disruptions.slice(0, 4).map((d) => (
                    <li key={d.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                        style={{ background: `${SEV_COLOR[d.severity]}22`, color: SEV_COLOR[d.severity] }}
                      >
                        {SEV_LABEL[d.severity]}
                      </span>
                      <div>
                        <p className="font-medium leading-snug">{d.title}</p>
                        {d.delay_contribution_days !== null && (
                          <p className="text-muted-foreground">
                            {d.delay_contribution_days}일 기여 추정 · {d.segment}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                  {disruptions.length > 4 && (
                    <li className="text-[11px] text-muted-foreground">+{disruptions.length - 4}건 더 보기</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DashboardProcessStrip />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>전망 적중률 · published 전수 기준 (표본 제외 없음)</span>
          <HitRateChip forecasts={forecasts} />
        </div>
      </main>
    </>
  );
}
