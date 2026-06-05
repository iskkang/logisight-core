import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceArea,
} from "recharts";

import { resolveFilters, useGlobalFilters, type GlobalFilters } from "@/hooks/useGlobalFilters";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { GlobalContextBar } from "@/components/dashboard/GlobalContextBar";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { IntelTable, type ColDef } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { IntelligenceBrief } from "@/components/dashboard/IntelligenceBrief";
import { RatesBrief } from "@/components/dashboard/RatesBrief";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ConfidenceBadge } from "@/components/dashboard/ConfidenceBadge";

import {
  freightIndicesHistoryQueryOptions,
  indexStatsQueryOptions,
  bunkerPricesQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  latestByRoute,
  computeMoM,
  type IndexStats,
  type KitaAirRateRow,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { latestExchangeRateQueryOptions, type ExchangeRateRow } from "@/lib/api/exchange-rates";
import {
  computeOceanPressureSignal,
  computeGlobalMomentumSignal,
  computeAirModalShiftSignal,
  percentile52wSeries,
  normalRange52w,
  type FreightIndexPoint,
} from "@/server/signals";

export const Route = createFileRoute("/rates")({
  validateSearch: (s: Record<string, unknown>): GlobalFilters => resolveFilters(s),
  loaderDeps: ({ search }) => search,
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(bunkerPricesQueryOptions());
    context.queryClient.ensureQueryData(kitaAirRatesQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions());
    context.queryClient.ensureQueryData(latestExchangeRateQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "운임 인텔리전스 — Logisight" },
      {
        name: "description",
        content:
          "한국발 해상·항공 운임 모니터. KCCI·SCFI·KITA 기반 운임 지수, 52주 백분위, 정상범위 분석.",
      },
    ],
  }),
  component: RatesPage,
});

// --- Formatters ---
function fmt(v: number | null | undefined, decimals = 0): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtUsd(v: number | null, decimals = 0): string {
  if (v == null) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: decimals })}`;
}

function statusFromPct(pct: number | null): "normal" | "observe" | "caution" | "alert" | null {
  if (pct === null) return null;
  if (pct >= 85) return "alert";
  if (pct >= 70) return "caution";
  if (pct <= 15) return "observe";
  return "normal";
}

// --- Extended row types ---
type SeaRow = KitaSeaRateRow & {
  mom: number | null;
  pct52w: number | null;
  normalRange: [number, number] | null;
  spark: (number | null)[];
};

type AirRow = KitaAirRateRow & {
  mom: number | null;
  pct52w: number | null;
  normalRange: [number, number] | null;
  spark: (number | null)[];
};

// --- Status badge component ---
function StatusBadge({ pct }: { pct: number | null }) {
  const level = statusFromPct(pct);
  if (!level) return <span className="text-muted-foreground">—</span>;
  const map = {
    alert: { label: "경보", cls: "text-status-alert bg-status-alert/10" },
    caution: { label: "주의", cls: "text-status-caution bg-status-caution/10" },
    observe: { label: "관찰", cls: "text-status-observe bg-status-observe/10" },
    normal: { label: "정상", cls: "text-status-normal bg-status-normal/10" },
  };
  const { label, cls } = map[level];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
  );
}

// --- Main page ---
function RatesPage() {
  const search = Route.useSearch();
  const { filters, setFilters } = useGlobalFilters(search);

  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: bunker } = useSuspenseQuery(bunkerPricesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: exRate } = useSuspenseQuery(latestExchangeRateQueryOptions());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<{ title: string; content: React.ReactNode } | null>(null);

  // Group history by index code
  const byCode = useMemo(() => {
    const m = new Map<string, FreightIndexPoint[]>();
    for (const r of history) {
      const arr = m.get(r.index_code) ?? [];
      arr.push({ week_date: r.week_date, value: r.value, change_pct: r.change_pct });
      m.set(r.index_code, arr);
    }
    return m;
  }, [history]);

  const kcciSeries = useMemo(() => byCode.get("KCCI") ?? [], [byCode]);
  const scfiSeries = useMemo(() => byCode.get("SCFI") ?? [], [byCode]);
  const wciSeries = useMemo(() => byCode.get("WCI") ?? [], [byCode]);

  const kcciStat = stats.find((s) => s.index_code === "KCCI") ?? null;

  // Signals
  const oceanSignal = useMemo(() => computeOceanPressureSignal(kcciSeries), [kcciSeries]);
  const globalSignal = useMemo(
    () => computeGlobalMomentumSignal(scfiSeries, wciSeries),
    [scfiSeries, wciSeries],
  );

  // Air modal shift — pick flagship route (highest MoM in kg300)
  const latestAir = useMemo(() => latestByRoute(airRates), [airRates]);
  const latestSea = useMemo(() => latestByRoute(seaRates), [seaRates]);

  const airModalData = useMemo(() => {
    const candidates = latestAir.map((r) => {
      const series = airRates
        .filter((a) => a.origin === r.origin && a.dest === r.dest)
        .map((a) => ({ year_mon: a.year_mon, value: a.kg300 }));
      const mom = r.chg300 ?? computeMoM(series);
      return { r, mom };
    });
    return (
      candidates
        .filter((c) => c.mom !== null)
        .sort((a, b) => Math.abs(b.mom!) - Math.abs(a.mom!))
        .at(0) ?? null
    );
  }, [latestAir, airRates]);

  const airModalSignal = useMemo(
    () =>
      computeAirModalShiftSignal(
        airModalData?.mom ?? null,
        airModalData ? `인천→${airModalData.r.dest}` : "인천발",
        kcciStat?.pct_52w ?? null,
        airModalData?.r.year_mon ?? null,
      ),
    [airModalData, kcciStat],
  );

  // StatusStrip
  const statusItems = useMemo((): StatusItem[] => {
    const s = oceanSignal?.state ?? "normal";
    const stateMap = { normal: "정상", observe: "관찰", caution: "주의", alert: "경보" } as const;
    return [
      { label: "해상 운임", value: stateMap[s], state: s },
      {
        label: "KCCI WoW",
        value: kcciStat?.change_pct != null ? fmtPct(kcciStat.change_pct) : "—",
        state:
          kcciStat?.change_pct == null
            ? "normal"
            : Math.abs(kcciStat.change_pct) >= 5
            ? "caution"
            : "normal",
      },
      {
        label: "데이터 기준",
        value: kcciStat?.latest_date?.slice(0, 10) ?? "—",
        state: "normal",
      },
      {
        label: "환율 기준",
        value: exRate?.rate_date ?? "—",
        state: exRate ? "normal" : "caution",
      },
    ];
  }, [oceanSignal, kcciStat, exRate]);

  // Sea rows with computed stats
  const seaRows = useMemo((): SeaRow[] => {
    return latestSea.map((r) => {
      const series = seaRates
        .filter((s) => s.origin === r.origin && s.dest === r.dest)
        .map((s) => ({
          week_date: s.year_mon,
          value: s.feu,
          change_pct: s.feu_chg,
        }));
      const mom = r.feu_chg ?? computeMoM(series.map((s) => ({ year_mon: s.week_date, value: s.value })));
      const pct52w = r.feu !== null ? percentile52wSeries(series, r.feu) : null;
      const normalRange = normalRange52w(series);
      const spark = series.slice(-12).map((s) => s.value);
      return { ...r, mom, pct52w, normalRange, spark };
    });
  }, [latestSea, seaRates]);

  // Air rows with computed stats
  const airRows = useMemo((): AirRow[] => {
    return latestAir.map((r) => {
      const series = airRates
        .filter((a) => a.origin === r.origin && a.dest === r.dest)
        .map((a) => ({
          week_date: a.year_mon,
          value: a.kg300,
          change_pct: a.chg300,
        }));
      const mom = r.chg300 ?? computeMoM(series.map((s) => ({ year_mon: s.week_date, value: s.value })));
      const pct52w = r.kg300 !== null ? percentile52wSeries(series, r.kg300) : null;
      const normalRange = normalRange52w(series);
      const spark = series.slice(-12).map((s) => s.value);
      return { ...r, mom, pct52w, normalRange, spark };
    });
  }, [latestAir, airRates]);

  // Chart (KCCI vs compare, normalized to 100 at period start)
  const compareCode = (filters as Record<string, unknown>).compare as string | undefined ?? "SCFI";
  const chartData = useMemo(() => {
    const pts = kcciSeries.slice(-52);
    if (pts.length === 0) return [];
    const base = pts[0].value ?? 1;
    const comparePts = byCode.get(compareCode) ?? [];
    const compareBase = comparePts.find((p) => p.week_date >= pts[0].week_date)?.value ?? 1;
    return pts.map((pt) => {
      const cp = comparePts.find((c) => c.week_date === pt.week_date);
      return {
        date: pt.week_date.slice(5),
        KCCI: pt.value !== null ? Math.round((pt.value / base) * 100) : null,
        [compareCode]: cp?.value != null ? Math.round((cp.value / compareBase) * 100) : null,
      };
    });
  }, [kcciSeries, byCode, compareCode]);

  const kcciNormal = useMemo(() => normalRange52w(kcciSeries), [kcciSeries]);
  const kcciBase = kcciSeries[0]?.value ?? 1;
  const normalBandNorm = kcciNormal
    ? [Math.round((kcciNormal[0] / kcciBase) * 100), Math.round((kcciNormal[1] / kcciBase) * 100)]
    : null;

  // Sea table columns
  const SEA_COLS: ColDef<SeaRow>[] = [
    {
      key: "dest",
      header: "목적지",
      cell: (r) => <span className="font-medium text-foreground">{r.dest}</span>,
    },
    {
      key: "origin",
      header: "출발",
      cell: (r) => <span className="text-muted-foreground">{r.origin}</span>,
    },
    {
      key: "teu",
      header: "USD/TEU",
      cell: (r) => fmtUsd(r.teu),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "feu",
      header: "USD/FEU",
      cell: (r) => fmtUsd(r.feu),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "mom",
      header: "MoM",
      cell: (r) => (
        <span className={r.mom == null ? "" : r.mom > 0 ? "text-status-alert" : r.mom < 0 ? "text-status-normal" : ""}>
          {fmtPct(r.mom)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "spark",
      header: "추세",
      cell: (r) => <Sparkline values={r.spark} color="var(--color-cyan)" />,
    },
    {
      key: "pct52w",
      header: "52주 백분위",
      cell: (r) => r.pct52w !== null ? `${r.pct52w}%` : "—",
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "status",
      header: "상태",
      cell: (r) => <StatusBadge pct={r.pct52w} />,
    },
  ];

  // Air table columns — 4요소 필수: USD/kg + KRW환산 + 적용환율 + 환율기준일
  const AIR_COLS: ColDef<AirRow>[] = [
    {
      key: "dest",
      header: "목적지",
      cell: (r) => <span className="font-medium text-foreground">{r.dest}</span>,
    },
    {
      key: "kg300",
      header: "USD/kg",
      cell: (r) => (r.kg300 != null ? `$${r.kg300.toFixed(2)}` : "—"),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "krw",
      header: "KRW 환산",
      cell: (r) =>
        r.kg300 != null && exRate != null
          ? `₩${Math.round(r.kg300 * exRate.usd_krw).toLocaleString("ko-KR")}`
          : "—",
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "exrate",
      header: "적용환율",
      cell: () =>
        exRate != null
          ? `@${Math.round(exRate.usd_krw).toLocaleString("ko-KR")}`
          : "—",
      className: "text-right text-muted-foreground",
      headerClassName: "text-right",
    },
    {
      key: "ratedate",
      header: "환율기준일",
      cell: () => exRate?.rate_date ?? "—",
      className: "text-muted-foreground",
    },
    {
      key: "mom",
      header: "MoM (USD)",
      cell: (r) => (
        <span className={r.mom == null ? "" : r.mom > 0 ? "text-status-alert" : r.mom < 0 ? "text-status-normal" : ""}>
          {fmtPct(r.mom)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "spark",
      header: "추세",
      cell: (r) => <Sparkline values={r.spark} color="var(--color-cyan)" />,
    },
    {
      key: "status",
      header: "상태",
      cell: (r) => <StatusBadge pct={r.pct52w} />,
    },
  ];

  // Index stats table columns
  const STAT_COLS: ColDef<IndexStats>[] = [
    {
      key: "index_code",
      header: "지수",
      cell: (s) => <span className="font-semibold">{s.index_code}</span>,
    },
    {
      key: "latest_value",
      header: "최신값",
      cell: (s) => fmt(s.latest_value),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "change_pct",
      header: "WoW",
      cell: (s) => (
        <span className={s.change_pct == null ? "" : s.change_pct > 0 ? "text-status-alert" : s.change_pct < 0 ? "text-status-normal" : ""}>
          {fmtPct(s.change_pct)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "mom_pct",
      header: "MoM",
      cell: (s) => fmtPct(s.mom_pct),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "yoy_pct",
      header: "YoY",
      cell: (s) => fmtPct(s.yoy_pct),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "pct_52w",
      header: "52주 백분위",
      cell: (s) => (s.pct_52w !== null ? `${s.pct_52w}%` : "—"),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "normal_range",
      header: "정상범위 ±1σ",
      cell: (s) =>
        s.normal_range ? `${s.normal_range[0].toLocaleString()}–${s.normal_range[1].toLocaleString()}` : "—",
    },
    {
      key: "conf",
      header: "신뢰도",
      cell: (s) => (
        <ConfidenceBadge
          level={
            s.latest_date
              ? (Date.now() - new Date(s.latest_date).getTime()) / 86400000 < 14
                ? "high"
                : "medium"
              : "low"
          }
        />
      ),
    },
  ];

  const vlsfoLatest = bunker.find((b) => b.grade === "VLSFO");

  return (
    <DashboardShell title="운임 인텔리전스" subtitle="한국발 해상·항공 운임 모니터">
      <GlobalContextBar filters={filters} onChange={setFilters} />

      <StatusStrip items={statusItems} />

      {/* 운임 인텔리전스 브리프 — 시그널 종합 헤드라인 */}
      <RatesBrief
        signals={[oceanSignal, globalSignal, airModalSignal]}
        asOf={kcciStat?.latest_date?.slice(0, 10) ?? null}
      />

      {/* Signal cards */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Market Posture
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {oceanSignal ? (
            <SignalCard signal={oceanSignal} />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
              해상 운임 압력 — 데이터 수집 중
            </div>
          )}
          {globalSignal ? (
            <SignalCard signal={globalSignal} />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
              글로벌 모멘텀 — 데이터 수집 중
            </div>
          )}
          {airModalSignal ? (
            <SignalCard signal={airModalSignal} />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
              항공 모달 전환 — 데이터 수집 중
            </div>
          )}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">벙커 비용</p>
            {vlsfoLatest ? (
              <>
                <p className="mt-1 text-sm font-semibold">
                  VLSFO {fmtUsd(vlsfoLatest.price_usd)}/MT
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {vlsfoLatest.port} · {vlsfoLatest.obs_date.slice(0, 10)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  VLSFO MoM 미산출 — 히스토리 엔드포인트 추가 후 활성화 예정
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">데이터 수집 중</p>
            )}
          </div>
        </div>
      </section>

      {/* 해상 운임 — Sea group (mode-group 분리, 항공과 절대 혼합 금지) */}
      <section>
        <h2 className="mb-1 text-[13px] font-semibold">
          해상 운임 <span className="text-[11px] font-normal text-muted-foreground">USD/FEU · KITA · 월간</span>
        </h2>
        {seaRows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">데이터 수집 중</p>
        ) : (
          <IntelTable
            cols={SEA_COLS}
            rows={seaRows}
            rowKey={(r) => `${r.origin}__${r.dest}`}
            onRowClick={(r) => {
              setDrawerRow({
                title: `${r.origin} → ${r.dest} 해상 상세`,
                content: (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <span className="text-muted-foreground">TEU</span><span>{fmtUsd(r.teu)}</span>
                      <span className="text-muted-foreground">FEU</span><span>{fmtUsd(r.feu)}</span>
                      <span className="text-muted-foreground">MoM</span><span>{fmtPct(r.mom)}</span>
                      <span className="text-muted-foreground">52주 백분위</span><span>{r.pct52w !== null ? `${r.pct52w}%` : "—"}</span>
                      <span className="text-muted-foreground">정상범위 ±1σ</span>
                      <span>{r.normalRange ? `${fmtUsd(r.normalRange[0])}–${fmtUsd(r.normalRange[1])}` : "—"}</span>
                      <span className="text-muted-foreground">기준월</span><span>{r.year_mon}</span>
                    </div>
                    <Sparkline values={r.spark} width={220} height={48} color="var(--color-cyan)" />
                  </div>
                ),
              });
              setDrawerOpen(true);
            }}
          />
        )}
      </section>

      {/* 항공 운임 — Air group (해상과 절대 혼합 금지) */}
      <section>
        <h2 className="mb-1 text-[13px] font-semibold">
          항공 운임{" "}
          <span className="text-[11px] font-normal text-muted-foreground">
            USD/kg 원본 + KRW 환산 · KITA 인천발 · 월간
          </span>
        </h2>
        {airRows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">데이터 수집 중</p>
        ) : (
          <>
            <IntelTable
              cols={AIR_COLS}
              rows={airRows}
              rowKey={(r) => `${r.origin}__${r.dest}`}
              onRowClick={(r) => {
                setDrawerRow({
                  title: `${r.origin} → ${r.dest} 항공 상세`,
                  content: (
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <span className="text-muted-foreground">USD/kg (≤100kg)</span><span>{r.kg100 != null ? `$${r.kg100.toFixed(2)}` : "—"}</span>
                        <span className="text-muted-foreground">USD/kg (≤300kg)</span><span>{r.kg300 != null ? `$${r.kg300.toFixed(2)}` : "—"}</span>
                        <span className="text-muted-foreground">USD/kg (≤500kg)</span><span>{r.kg500 != null ? `$${r.kg500.toFixed(2)}` : "—"}</span>
                        <span className="text-muted-foreground">KRW 환산 (300kg)</span>
                        <span>{r.kg300 != null && exRate != null ? `₩${Math.round(r.kg300 * exRate.usd_krw).toLocaleString("ko-KR")}/kg` : "—"}</span>
                        <span className="text-muted-foreground">적용 환율</span>
                        <span>{exRate != null ? `USD/KRW ${Math.round(exRate.usd_krw).toLocaleString("ko-KR")}` : "—"}</span>
                        <span className="text-muted-foreground">환율 기준일</span><span>{exRate?.rate_date ?? "—"}</span>
                        <span className="text-muted-foreground">MoM (USD 기준)</span><span>{fmtPct(r.mom)}</span>
                        <span className="text-muted-foreground">52주 백분위</span><span>{r.pct52w !== null ? `${r.pct52w}%` : "—"}</span>
                        <span className="text-muted-foreground">기준월</span><span>{r.year_mon}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        KITA 원본 단위: USD/kg · 정렬·백분위·MoM은 USD 기준 · KRW 환산은 표시용
                      </p>
                      <Sparkline values={r.spark} width={220} height={48} color="var(--color-cyan)" />
                    </div>
                  ),
                });
                setDrawerOpen(true);
              }}
            />
            {exRate ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                KITA 원본 단위: USD/kg · 적용 환율 USD/KRW {Math.round(exRate.usd_krw).toLocaleString("ko-KR")} · 기준일 {exRate.rate_date} · KRW 환산은 표시용 — 정렬·백분위·변동률은 USD/kg 원본 기준
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-status-caution">
                환율 데이터 없음 — KRW 환산 불가 (exchange_rates 수집 후 활성화)
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              글로벌 지수 선행·후행 비교는 방법론 확정 전까지 비활성
            </p>
          </>
        )}
      </section>

      {/* Comparison chart */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold">
            KCCI vs {compareCode} · 지수화 100
          </h2>
          <div className="flex gap-1">
            {(["SCFI", "CCFI", "FBX", "WCI"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setFilters({ ...filters, compare: code } as GlobalFilters & { compare: string })}
                className={[
                  "rounded border px-2 py-0.5 text-[11px] transition-colors",
                  compareCode === code
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/40",
                ].join(" ")}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">데이터 수집 중</p>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={7} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={36} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {normalBandNorm && (
                  <ReferenceArea
                    y1={normalBandNorm[0]}
                    y2={normalBandNorm[1]}
                    fill="var(--color-status-normal)"
                    fillOpacity={0.08}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="KCCI"
                  stroke="var(--color-cyan)"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey={compareCode}
                  stroke="var(--color-warning)"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[11px] text-muted-foreground">
              지수화: 52주 시작 = 100 · 녹색 밴드: KCCI 정상범위 ±1σ · 기준 {kcciStat?.latest_date?.slice(0, 10) ?? "—"}
            </p>
          </div>
        )}
      </section>

      {/* Global index stats */}
      <IntelligenceBrief title="글로벌 지수 현황">
        <IntelTable
          cols={STAT_COLS}
          rows={stats.filter((s) => s.latest_value !== null)}
          rowKey={(s) => s.index_code}
          onRowClick={(s) => {
            setDrawerRow({
              title: `${s.index_code} 지수 상세`,
              content: (
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-muted-foreground">최신값</span><span>{fmt(s.latest_value)}</span>
                  <span className="text-muted-foreground">기준일</span><span>{s.latest_date?.slice(0, 10) ?? "—"}</span>
                  <span className="text-muted-foreground">WoW</span><span>{fmtPct(s.change_pct)}</span>
                  <span className="text-muted-foreground">MoM</span><span>{fmtPct(s.mom_pct)}</span>
                  <span className="text-muted-foreground">YoY</span><span>{fmtPct(s.yoy_pct)}</span>
                  <span className="text-muted-foreground">52주 백분위</span><span>{s.pct_52w !== null ? `${s.pct_52w}%` : "—"}</span>
                  <span className="text-muted-foreground">정상범위 ±1σ</span>
                  <span>{s.normal_range ? `${s.normal_range[0].toLocaleString()}–${s.normal_range[1].toLocaleString()}` : "—"}</span>
                </div>
              ),
            });
            setDrawerOpen(true);
          }}
          emptyText="데이터 수집 중"
        />
      </IntelligenceBrief>

      <DataQualityBar
        sources={[
          { label: "KCCI·SCFI", asOf: kcciStat?.latest_date?.slice(0, 10) ?? null, expectedDays: 7 },
          { label: "KITA 항공", asOf: latestAir.at(0)?.year_mon ?? null, expectedDays: 35 },
          { label: "KITA 해상", asOf: latestSea.at(0)?.year_mon ?? null, expectedDays: 35 },
          { label: "환율", asOf: exRate?.rate_date ?? null, expectedDays: 3 },
          { label: "벙커유", asOf: vlsfoLatest?.obs_date?.slice(0, 10) ?? null, expectedDays: 7 },
        ]}
      />

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerRow?.title ?? ""}
      >
        {drawerRow?.content}
      </DetailDrawer>
    </DashboardShell>
  );
}
