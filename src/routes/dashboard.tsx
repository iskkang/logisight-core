import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { FreshnessBadge } from "@/components/dashboard/FreshnessBadge";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";

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

export const Route = createFileRoute("/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(alertCandidatesQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(kitaAirRatesQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(latestExchangeRateQueryOptions());
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
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
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

// --- Main page ---
function DashboardPage() {
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: exRate } = useSuspenseQuery(latestExchangeRateQueryOptions());

  // --- 주요 노선 현황 (MTL 선정) — code-defined, same for every visitor ---
  const keyLaneRows = useMemo(() => {
    const latestSea = latestByRoute(seaRates);
    return [...KEY_LANES]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((lane) => {
        if (lane.metricType === "rate") {
          const row = latestSea.find((r) => r.origin === lane.origin && r.dest === lane.dest);
          if (!row || row.feu == null) return { lane, value: null as string | null, mom: null as number | null };
          const series = seaRates
            .filter((s) => s.origin === lane.origin && s.dest === lane.dest)
            .map((s) => ({ year_mon: s.year_mon, value: s.feu }));
          return { lane, value: `$${row.feu.toLocaleString("en-US")}/FEU`, mom: computeMoM(series) };
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
      const series = airRates
        .filter((a) => a.origin === r.origin && a.dest === r.dest)
        .map((a) => ({ year_mon: a.year_mon, value: a.kg300 }));
      const mom = computeMoM(series);
      return mom !== null && mom > 0
        ? [
            {
              label: `${r.origin}→${r.dest} (항공)`,
              mom,
              asOf: r.year_mon,
              link: "/rates" as const,
            },
          ]
        : [];
    });

    const seaItems = latestSea.flatMap((r) => {
      const series = seaRates
        .filter((s) => s.origin === r.origin && s.dest === r.dest)
        .map((s) => ({ year_mon: s.year_mon, value: s.feu }));
      const mom = computeMoM(series);
      return mom !== null && mom > 0
        ? [
            {
              label: `${r.origin}→${r.dest} (해상)`,
              mom,
              asOf: r.year_mon,
              link: "/rates" as const,
            },
          ]
        : [];
    });

    return [...airItems, ...seaItems].sort((a, b) => b.mom - a.mom).slice(0, 3);
  }, [airRates, seaRates]);

  // --- StatusStrip ---
  const kcciStat = stats.find((s) => s.index_code === "KCCI");
  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  const medAlerts = alerts.filter((a) => a.severity === "medium").length;

  const statusItems = useMemo(
    (): StatusItem[] => [
      {
        label: "경보",
        value:
          highAlerts === 0 && medAlerts === 0
            ? "없음"
            : `${highAlerts}건 경고 / ${medAlerts}건 주의`,
        state: highAlerts > 0 ? "alert" : medAlerts > 0 ? "caution" : "normal",
      },
      {
        label: "KCCI WoW",
        value:
          kcciStat?.change_pct != null
            ? `${kcciStat.change_pct >= 0 ? "+" : ""}${kcciStat.change_pct.toFixed(1)}%`
            : "—",
        state:
          kcciStat?.change_pct == null
            ? "normal"
            : Math.abs(kcciStat.change_pct) >= 5
              ? "caution"
              : "normal",
      },
      {
        label: "유라시아 장애",
        value: disruptions.length === 0 ? "없음" : `${disruptions.length}건`,
        state:
          disruptions.length === 0 ? "normal" : disruptions.length >= 2 ? "caution" : "observe",
      },
      {
        label: "기준일",
        value: kcciStat?.latest_date?.slice(0, 10) ?? "—",
        state: "normal",
      },
    ],
    [highAlerts, medAlerts, kcciStat, disruptions],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DashboardShell title="종합 Control Tower" subtitle={`${today} 집계`}>
      <StatusStrip items={statusItems} />

      {/* Today's alerts */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          오늘의 핵심 변화
        </h2>
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            경보 없음 — 모든 지표 정상 범위
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.key} alert={alert} />
            ))}
          </div>
        )}
      </section>

      {/* 2-col: 주요 노선 현황 + Top rising rates */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 주요 노선 현황 (MTL 선정) */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">
              주요 노선 현황{" "}
              <span className="text-[11px] font-normal text-muted-foreground">MTL 선정</span>
            </h2>
          </div>
          <ul className="space-y-2">
            {keyLaneRows.map((r) => (
              <li
                key={r.lane.laneId}
                className="flex items-center justify-between gap-2 text-xs"
              >
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
                            r.mom > 0
                              ? "text-status-alert"
                              : r.mom < 0
                                ? "text-status-normal"
                                : "text-muted-foreground"
                          }
                        >
                          {r.mom >= 0 ? "+" : ""}
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

        {/* Top rising rates */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold">가장 크게 상승한 한국발 운임</h2>
          {topRising.length === 0 ? (
            <p className="text-xs text-muted-foreground">운임 데이터 수집 중</p>
          ) : (
            <ul className="space-y-2.5">
              {topRising.map((r, i) => (
                <li key={r.label} className="flex items-center gap-3 text-xs">
                  <span className="w-4 shrink-0 text-center text-muted-foreground font-mono">
                    {i + 1}
                  </span>
                  <span className="flex-1">{r.label}</span>
                  <span className="font-mono font-semibold text-status-alert">
                    +{r.mom.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            MoM 기준 · 환율 기준일 {exRate?.rate_date ?? "—"} · KITA
          </p>
        </div>
      </div>

      {/* 2-col: Index snapshot + Eurasia disruptions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Index snapshot */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">글로벌 지수 스냅샷</h2>
            <Link to="/rates" className="text-[11px] text-muted-foreground hover:underline">
              전체 보기 ↗
            </Link>
          </div>
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
                            ? "text-status-alert"
                            : s.change_pct < 0
                              ? "text-status-normal"
                              : "text-muted-foreground"
                      }
                    >
                      {s.change_pct != null
                        ? `${s.change_pct >= 0 ? "+" : ""}${s.change_pct.toFixed(1)}%`
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
          <p className="mt-2 text-[11px] text-muted-foreground">
            WoW · 52주 백분위 · 기준 {kcciStat?.latest_date?.slice(0, 10) ?? "—"}
          </p>
        </div>

        {/* Eurasia disruptions */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">유라시아 활성 장애</h2>
            <Link to="/eurasia" className="text-[11px] text-muted-foreground hover:underline">
              전체 보기 ↗
            </Link>
          </div>
          {disruptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">활성 장애 없음</p>
          ) : (
            <ul className="space-y-2">
              {disruptions.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-xs">
                  <span
                    className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `${SEV_COLOR[d.severity]}22`,
                      color: SEV_COLOR[d.severity],
                    }}
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
                <li className="text-[11px] text-muted-foreground">
                  +{disruptions.length - 4}건 더 보기
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <DataQualityBar
        sources={[
          {
            label: "KCCI·SCFI",
            asOf: kcciStat?.latest_date?.slice(0, 10) ?? null,
            expectedDays: 7,
          },
          {
            label: "KITA 운임",
            asOf: latestByRoute(airRates).at(0)?.year_mon ?? null,
            expectedDays: 35,
          },
          {
            label: "Eurasia 집계",
            asOf: disruptions.at(0)?.created_at?.slice(0, 10) ?? null,
            expectedDays: 7,
          },
          { label: "환율", asOf: exRate?.rate_date ?? null, expectedDays: 3 },
        ]}
      />
    </DashboardShell>
  );
}
