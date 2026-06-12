import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatPeriod,
  pctChange,
  tradeStatisticsBundleQueryOptions,
  type TradeStatRow,
  type TradeStatisticsBundle,
} from "@/lib/api/trade";
import { indexStatsQueryOptions, formatNumber } from "@/lib/api/rates";
import { PageHero } from "@/components/site/PageHero";
import {
  Collecting,
  DeltaValue,
  Donut,
  FilterSeg,
  Panel,
  PBadge,
  PCard,
  tdStyle,
  thStyle,
  TreemapChart,
} from "@/components/proto/Kit";
import { flagEmoji } from "@/lib/iso-country-codes";

export const Route = createFileRoute("/trade")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(tradeStatisticsBundleQueryOptions()),
      context.queryClient.ensureQueryData(indexStatsQueryOptions()),
    ]);
  },
  pendingMs: 0,
  pendingComponent: TradePending,
  head: () => ({
    meta: [
      { title: "무역 동향 인사이트 - Logisight" },
      {
        name: "description",
        content:
          "관세청 수출입무역통계 기반 교역액, 국가·품목 랭킹, 월별 추이를 한 화면에서 분석합니다.",
      },
    ],
  }),
  component: TradePage,
});

function TradePending() {
  return (
    <main className="flex min-h-[62vh] items-center justify-center bg-[#f5f8fc] px-4 text-slate-900">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-[#d8e3ef] bg-white px-8 py-7 shadow-[0_10px_28px_rgba(15,35,65,0.08)]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-black tracking-normal text-slate-800">Loading</p>
      </div>
    </main>
  );
}

type MetricMode = "total" | "export" | "import" | "balance";
type RegionKey =
  | "전체"
  | "아시아"
  | "북미"
  | "유럽"
  | "중동"
  | "중남미"
  | "아프리카"
  | "오세아니아";

type CountryAgg = {
  code: string;
  name: string;
  region: RegionKey;
  exportUsd: number;
  importUsd: number;
  tradeUsd: number;
  balanceUsd: number;
  changePct: number | null;
};

type ItemAgg = {
  code: string;
  name: string;
  exportUsd: number;
  importUsd: number;
  tradeUsd: number;
  balanceUsd: number;
  changePct: number | null;
};

type ContinentAgg = {
  code: string;
  name: string;
  exportUsd: number;
  importUsd: number;
  tradeUsd: number;
  balanceUsd: number;
};

type MonthlyPoint = {
  period: string;
  label: string;
  exportUsd: number;
  importUsd: number;
  balanceUsd: number;
};

type ProvisionalSnapshot = {
  period: string | null;
  priodDt: string | null;
  exportUsd: number | null;
  importUsd: number | null;
  balanceUsd: number | null;
  totalYoY: number | null;
  exportYoY: number | null;
  importYoY: number | null;
  balanceYoY: number | null;
};

const REGIONS: RegionKey[] = [
  "전체",
  "아시아",
  "북미",
  "유럽",
  "중동",
  "중남미",
  "아프리카",
  "오세아니아",
];
const REGION_BY_CODE: Record<string, RegionKey> = {
  CN: "아시아",
  JP: "아시아",
  VN: "아시아",
  TW: "아시아",
  HK: "아시아",
  SG: "아시아",
  MY: "아시아",
  IN: "아시아",
  TH: "아시아",
  ID: "아시아",
  PH: "아시아",
  BD: "아시아",
  PK: "아시아",
  KH: "아시아",
  MM: "아시아",
  LK: "아시아",
  US: "북미",
  CA: "북미",
  MX: "북미",
  DE: "유럽",
  NL: "유럽",
  PL: "유럽",
  FR: "유럽",
  GB: "유럽",
  IT: "유럽",
  ES: "유럽",
  HU: "유럽",
  CZ: "유럽",
  SK: "유럽",
  RU: "유럽",
  KZ: "유럽",
  AE: "중동",
  SA: "중동",
  TR: "중동",
  IR: "중동",
  IQ: "중동",
  IL: "중동",
  OM: "중동",
  KW: "중동",
  QA: "중동",
  BH: "중동",
  BR: "중남미",
  CL: "중남미",
  PE: "중남미",
  AR: "중남미",
  ZA: "아프리카",
  NG: "아프리카",
  EG: "아프리카",
  MA: "아프리카",
  AU: "오세아니아",
  NZ: "오세아니아",
};

function periodKey(period: string | null | undefined): string {
  return (period ?? "").replace(/\D/g, "").slice(0, 6);
}

function latestPeriod(rows: Pick<TradeStatRow, "period">[]): string | null {
  return (
    [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))].sort().at(-1) ?? null
  );
}

function prevYearPeriod(period: string | null): string | null {
  if (!period || period.length < 6) return null;
  return `${Number(period.slice(0, 4)) - 1}${period.slice(4, 6)}`;
}

function priodRank(value: string | null | undefined): number {
  if (!value) return 0;
  if (value.includes("말일")) return 3;
  if (value.includes("20")) return 2;
  if (value.includes("10")) return 1;
  return 0;
}

function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function moneyUsd(v: number | null | undefined): string {
  const m = money(v);
  return m === "-" ? m : `$${m}`;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

function regionOf(code: string | null | undefined): RegionKey {
  if (!code) return "아시아";
  return REGION_BY_CODE[code.toUpperCase()] ?? "아시아";
}

function metricValue(row: CountryAgg | ItemAgg | ContinentAgg, metric: MetricMode): number {
  if (metric === "export") return row.exportUsd;
  if (metric === "import") return row.importUsd;
  if (metric === "balance") return row.balanceUsd;
  return row.tradeUsd;
}

function metricLabel(metric: MetricMode): string {
  if (metric === "export") return "수출액";
  if (metric === "import") return "수입액";
  if (metric === "balance") return "무역수지";
  return "교역액";
}

function formatAxisUsd(v: unknown): string {
  return typeof v === "number" ? money(v) : "";
}

function compactName(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max)}...` : name;
}

function latestRows(rows: TradeStatRow[]): TradeStatRow[] {
  const latest = latestPeriod(rows);
  return latest ? rows.filter((row) => periodKey(row.period) === latest) : [];
}

function rowsForPeriod(rows: TradeStatRow[], period: string | null): TradeStatRow[] {
  return period ? rows.filter((row) => periodKey(row.period) === period) : [];
}

function buildProvisionalSnapshot(rows: TradeStatRow[]): ProvisionalSnapshot {
  const periods = [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))].sort();
  const latest = periods.at(-1) ?? null;
  const previous = prevYearPeriod(latest);

  const aggregate = (period: string | null) => {
    const picked = new Map<string, TradeStatRow>();
    for (const row of rows) {
      if (periodKey(row.period) !== period) continue;
      const key = `${row.stat_type}|${(row.country_code ?? "ALL").toUpperCase()}`;
      const existing = picked.get(key);
      if (!existing || priodRank(row.priod_dt) >= priodRank(existing.priod_dt))
        picked.set(key, row);
    }

    const allExp = picked.get("provisional_exp|ALL");
    const allImp = picked.get("provisional_imp|ALL");
    const countryRows = [...picked.values()].filter(
      (row) => (row.country_code ?? "").toUpperCase() !== "ALL",
    );
    const exportUsd =
      allExp?.export_usd ??
      sum(
        countryRows
          .filter((row) => row.stat_type === "provisional_exp")
          .map((row) => row.export_usd ?? 0),
      );
    const importUsd =
      allImp?.import_usd ??
      sum(
        countryRows
          .filter((row) => row.stat_type === "provisional_imp")
          .map((row) => row.import_usd ?? 0),
      );
    return {
      exportUsd,
      importUsd,
      balanceUsd: exportUsd - importUsd,
      priodDt: allExp?.priod_dt ?? allImp?.priod_dt ?? null,
    };
  };

  const current = aggregate(latest);
  const prev = aggregate(previous);

  return {
    period: latest,
    priodDt: current.priodDt,
    exportUsd: current.exportUsd,
    importUsd: current.importUsd,
    balanceUsd: current.balanceUsd,
    totalYoY: pctChange(
      (current.exportUsd ?? 0) + (current.importUsd ?? 0),
      (prev.exportUsd ?? 0) + (prev.importUsd ?? 0),
    ),
    exportYoY: pctChange(current.exportUsd, prev.exportUsd),
    importYoY: pctChange(current.importUsd, prev.importUsd),
    balanceYoY: pctChange(current.balanceUsd, prev.balanceUsd),
  };
}

function buildCountryAgg(
  rows: TradeStatRow[],
  region: RegionKey,
  metric: MetricMode,
): CountryAgg[] {
  const latest = latestPeriod(rows);
  const previous =
    prevYearPeriod(latest) && rows.some((row) => periodKey(row.period) === prevYearPeriod(latest))
      ? prevYearPeriod(latest)
      : ([...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))]
          .sort()
          .filter((period) => period !== latest)
          .at(-1) ?? null);

  const prevByCode = new Map<string, number>();
  for (const row of rowsForPeriod(rows, previous)) {
    const code = (row.country_code ?? "").toUpperCase();
    if (!code || code === "ALL") continue;
    prevByCode.set(code, (row.export_usd ?? 0) + (row.import_usd ?? 0));
  }

  return rowsForPeriod(rows, latest)
    .filter((row) => row.country_code && row.country_code.toUpperCase() !== "ALL")
    .map((row) => {
      const code = row.country_code!.toUpperCase();
      const exportUsd = row.export_usd ?? 0;
      const importUsd = row.import_usd ?? 0;
      const country: CountryAgg = {
        code,
        name: row.country_name ?? code,
        region: regionOf(code),
        exportUsd,
        importUsd,
        tradeUsd: exportUsd + importUsd,
        balanceUsd: row.trade_balance ?? exportUsd - importUsd,
        changePct: pctChange(exportUsd + importUsd, prevByCode.get(code) ?? null),
      };
      return country;
    })
    .filter((country) => region === "전체" || country.region === region)
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}

function buildItemAgg(rows: TradeStatRow[], metric: MetricMode): ItemAgg[] {
  const latest = latestPeriod(rows);
  const previous =
    prevYearPeriod(latest) && rows.some((row) => periodKey(row.period) === prevYearPeriod(latest))
      ? prevYearPeriod(latest)
      : ([...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))]
          .sort()
          .filter((period) => period !== latest)
          .at(-1) ?? null);

  const prevByHs = new Map<string, number>();
  for (const row of rowsForPeriod(rows, previous)) {
    const code = row.hs_code ?? "미분류";
    prevByHs.set(code, (prevByHs.get(code) ?? 0) + (row.export_usd ?? 0) + (row.import_usd ?? 0));
  }

  const byHs = new Map<string, ItemAgg>();
  for (const row of rowsForPeriod(rows, latest)) {
    const code = row.hs_code ?? "미분류";
    const prev = byHs.get(code) ?? {
      code,
      name: row.hs_name ?? code,
      exportUsd: 0,
      importUsd: 0,
      tradeUsd: 0,
      balanceUsd: 0,
      changePct: null,
    };
    prev.exportUsd += row.export_usd ?? 0;
    prev.importUsd += row.import_usd ?? 0;
    prev.tradeUsd = prev.exportUsd + prev.importUsd;
    prev.balanceUsd = prev.exportUsd - prev.importUsd;
    byHs.set(code, prev);
  }

  return [...byHs.values()]
    .map((item) => ({
      ...item,
      changePct: pctChange(item.tradeUsd, prevByHs.get(item.code) ?? null),
    }))
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}

function buildContinents(rows: TradeStatRow[], metric: MetricMode): ContinentAgg[] {
  return latestRows(rows)
    .map((row) => {
      const exportUsd = row.export_usd ?? 0;
      const importUsd = row.import_usd ?? 0;
      return {
        code: row.country_code ?? row.country_name ?? "권역",
        name: row.country_name ?? row.country_code ?? "권역",
        exportUsd,
        importUsd,
        tradeUsd: exportUsd + importUsd,
        balanceUsd: row.trade_balance ?? exportUsd - importUsd,
      };
    })
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}

function buildMonthly(rows: TradeStatRow[]): MonthlyPoint[] {
  const periods = [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))].sort();
  return periods.map((period) => {
    const rowsInPeriod = rowsForPeriod(rows, period);
    const exportUsd = sum(rowsInPeriod.map((row) => row.export_usd ?? 0));
    const importUsd = sum(rowsInPeriod.map((row) => row.import_usd ?? 0));
    return {
      period,
      label: `${period.slice(2, 4)}.${period.slice(4, 6)}`,
      exportUsd,
      importUsd,
      balanceUsd: exportUsd - importUsd,
    };
  });
}

function useTradeModel(bundle: TradeStatisticsBundle, region: RegionKey, metric: MetricMode) {
  return useMemo(() => {
    const countries = buildCountryAgg(bundle.country, region, metric);
    const items = buildItemAgg(bundle.item, metric);
    const continents = buildContinents(bundle.continent, metric);
    const snapshot = buildProvisionalSnapshot(bundle.provisional);
    const monthly = buildMonthly(bundle.country);
    const latestCountryPeriod = latestPeriod(bundle.country);
    const latestItemPeriod = latestPeriod(bundle.item);
    const latestContinentPeriod = latestPeriod(bundle.continent);
    const latestItemCountryPeriod = latestPeriod(bundle.itemCountry);
    const latestNewnaturePeriod = latestPeriod(bundle.newnature);
    const totalCountryTrade = sum(
      rowsForPeriod(bundle.country, latestCountryPeriod).map(
        (row) => (row.export_usd ?? 0) + (row.import_usd ?? 0),
      ),
    );

    return {
      countries,
      items,
      continents,
      monthly,
      snapshot,
      totalTrade: (snapshot.exportUsd ?? 0) + (snapshot.importUsd ?? 0),
      totalTradeYoY: snapshot.totalYoY,
      latestCountryPeriod,
      latestItemPeriod,
      latestContinentPeriod,
      latestItemCountryPeriod,
      latestNewnaturePeriod,
      totalCountryTrade,
      itemCountryRows: bundle.itemCountry,
      newnatureRows: bundle.newnature,
    };
  }, [bundle, region, metric]);
}

const METRIC_KO = ["교역액", "수출액", "수입액", "무역수지"] as const;
type MetricKo = (typeof METRIC_KO)[number];
const METRIC_BY_KO: Record<MetricKo, MetricMode> = {
  교역액: "total",
  수출액: "export",
  수입액: "import",
  무역수지: "balance",
};

function TradePage() {
  const { data: bundle } = useSuspenseQuery(tradeStatisticsBundleQueryOptions());
  const { data: indexStats } = useSuspenseQuery(indexStatsQueryOptions());
  const [region, setRegion] = useState<RegionKey>("전체");
  const [metricKo, setMetricKo] = useState<MetricKo>("교역액");
  const metric = METRIC_BY_KO[metricKo];

  const model = useTradeModel(bundle, region, metric);
  const indexSnapshot = indexStats.filter((s) => s.latest_value != null).slice(0, 6);

  const donutSegments = useMemo(() => {
    const tops = model.continents
      .slice(0, 4)
      .map((c) => ({ label: c.name, value: Math.max(0, metricValue(c, metric)) }));
    const rest = model.continents
      .slice(4)
      .reduce((s, c) => s + Math.max(0, metricValue(c, metric)), 0);
    return rest > 0 ? [...tops, { label: "기타", value: rest }] : tops;
  }, [model.continents, metric]);

  const provisionalBadge = model.snapshot.period
    ? `잠정 ${formatPeriod(model.snapshot.period)}`
    : "수집 중";
  const monthly = model.monthly.slice(-12);

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <PageHero
        eyebrow="Trade Insight"
        titleMain="무역 동향"
        titleAccent="인사이트"
        subtitle="관세청 수출입무역통계 기반 국가·대륙·품목 교역 흐름. 확정·잠정 데이터를 명확히 구분합니다."
        chips={[
          {
            label: "기준",
            value: formatPeriod(model.snapshot.period),
            color: "var(--color-cyan)",
          },
          {
            label: "무역수지",
            value: money(model.snapshot.balanceUsd),
            color: "var(--color-status-normal)",
          },
        ]}
      />
      <section className="mx-auto max-w-[1540px] space-y-4 px-4 py-[26px] lg:px-12">
        {/* 필터 — 목적 권역 + 지표 */}
        <PCard pad="md">
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <FilterSeg label="목적 권역" options={REGIONS} value={region} onChange={setRegion} />
            <FilterSeg label="지표" options={METRIC_KO} value={metricKo} onChange={setMetricKo} />
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11.5,
                color: "var(--ink-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              확정 {formatPeriod(model.latestCountryPeriod)} · 잠정{" "}
              {formatPeriod(model.snapshot.period)}
            </span>
          </div>
        </PCard>

        {/* KPI — 잠정 스냅샷 (provisional_exp/imp) */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <TradeKpi
            label="전체 교역액"
            value={moneyUsd(model.totalTrade)}
            yoy={model.totalTradeYoY}
            badge={provisionalBadge}
          />
          <TradeKpi
            label="수출액"
            value={moneyUsd(model.snapshot.exportUsd)}
            yoy={model.snapshot.exportYoY}
            badge={provisionalBadge}
          />
          <TradeKpi
            label="수입액"
            value={moneyUsd(model.snapshot.importUsd)}
            yoy={model.snapshot.importYoY}
            badge={provisionalBadge}
          />
          <TradeKpi
            label="무역수지"
            value={moneyUsd(model.snapshot.balanceUsd)}
            yoy={model.snapshot.balanceYoY}
            badge={provisionalBadge}
            sub={
              model.snapshot.balanceUsd != null
                ? model.snapshot.balanceUsd >= 0
                  ? "흑자"
                  : "적자"
                : undefined
            }
          />
        </div>

        {/* 월별 콤보 차트 + 대륙별 도넛 */}
        <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Panel title="월별 수출·수입·무역수지" badge={<PBadge>country 확정 집계 · USD</PBadge>}>
            {monthly.length >= 2 ? (
              <ResponsiveContainer width="100%" height={236}>
                <ComposedChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAxisUsd}
                    width={52}
                    tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => moneyUsd(Number(v))}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="수출" dataKey="exportUsd" fill="var(--navy-600)" radius={[3, 3, 0, 0]} />
                  <Bar name="수입" dataKey="importUsd" fill="#b6c5dc" radius={[3, 3, 0, 0]} />
                  <Line
                    name="무역수지"
                    type="monotone"
                    dataKey="balanceUsd"
                    stroke="var(--status-caution)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Collecting note="월별 확정 집계가 누적되면 추이가 표시됩니다." />
            )}
          </Panel>
          <Panel
            title="대륙별 교역 비중"
            badge={<PBadge>continent 확정 · {formatPeriod(model.latestContinentPeriod)}</PBadge>}
          >
            <Donut
              segments={donutSegments}
              centerLabel={moneyUsd(donutSegments.reduce((s, x) => s + x.value, 0))}
              centerSub={metricKo}
              format={(v) => moneyUsd(v)}
            />
          </Panel>
        </div>

        {/* 국가별 트리맵 */}
        <Panel
          title="국가별 교역액 트리맵"
          badge={<PBadge>상위 10개국 · 면적 = {metricKo}</PBadge>}
        >
          {model.countries.length === 0 ? (
            <Collecting />
          ) : (
            <TreemapChart
              items={model.countries
                .slice(0, 10)
                .map((c) => ({ label: c.name, value: metricValue(c, metric) }))}
              height={300}
              format={(v) => moneyUsd(v)}
            />
          )}
        </Panel>

        {/* 주요국 TOP 10 + 잠정 안내 / 상위 품목 */}
        <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Panel
            title="주요국 교역 TOP 10"
            badge={
              <PBadge>
                {metricKo} 기준 · {formatPeriod(model.latestCountryPeriod)}
              </PBadge>
            }
            bodyPad={0}
          >
            {model.countries.length === 0 ? (
              <Collecting />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={thStyle("left")}>순위</th>
                      <th style={thStyle("left")}>국가</th>
                      <th style={thStyle("right")}>{metricKo} (USD)</th>
                      <th style={thStyle("right")}>전년대비</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.countries.slice(0, 10).map((c, i) => (
                      <tr key={c.code}>
                        <td style={{ ...tdStyle("left"), fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                          {i + 1}
                        </td>
                        <td style={{ ...tdStyle("left"), fontWeight: 600, color: "var(--ink)" }}>
                          <span style={{ marginRight: 8 }}>{flagEmoji(c.code)}</span>
                          {c.name}
                          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-muted)" }}>{c.region}</span>
                        </td>
                        <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink)" }}>
                          {moneyUsd(metricValue(c, metric))}
                        </td>
                        <td style={tdStyle("right")}>
                          <DeltaValue value={c.changePct} size={12} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="space-y-4">
            <Panel title="잠정 데이터 안내" bodyPad={16}>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-muted)" }}>
                {formatPeriod(model.snapshot.period)} 데이터는{" "}
                <b style={{ color: "var(--ink)" }}>
                  잠정{model.snapshot.priodDt ? ` (${model.snapshot.priodDt} 집계)` : ""}
                </b>
                으로 부분집계입니다. 확정치는 익월 갱신됩니다. 수출액 − 수입액 = 무역수지가
                화면에서 일치합니다.
              </p>
            </Panel>
            <Panel
              title="상위 품목 TOP 5"
              badge={<PBadge>item · {formatPeriod(model.latestItemPeriod)}</PBadge>}
              bodyPad={16}
            >
              {model.items.length === 0 ? (
                <Collecting />
              ) : (
                <>
                  {model.items.slice(0, 5).map((item, i) => (
                    <div
                      key={item.code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "9px 0",
                        borderTop: i ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--ink)",
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {compactName(item.name, 16)}
                      </span>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink)" }}>
                          {moneyUsd(metricValue(item, metric))}
                        </span>
                        <DeltaValue value={item.changePct} size={11} />
                      </span>
                    </div>
                  ))}
                  <Link
                    to="/industries"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    산업별(HS) 랭킹 보기
                  </Link>
                </>
              )}
            </Panel>
          </div>
        </div>

        {/* 글로벌 주요 지수 */}
        <Panel
          title="글로벌 주요 지수"
          badge={
            <PBadge>
              freight_indices · 기준 {indexSnapshot[0]?.latest_date?.slice(0, 10) ?? "—"}
            </PBadge>
          }
        >
          {indexSnapshot.length === 0 ? (
            <Collecting />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {indexSnapshot.map((row) => (
                <PCard key={row.index_code} pad="md">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)" }}>
                    {row.index_code}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 18,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink)",
                    }}
                  >
                    {formatNumber(row.latest_value, 2)}
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <DeltaValue value={row.change_pct} size={11} />
                  </div>
                </PCard>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function TradeKpi({
  label,
  value,
  yoy,
  badge,
  sub,
}: {
  label: string;
  value: string;
  yoy: number | null;
  badge: string;
  sub?: string;
}) {
  return (
    <PCard pad="md">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</span>
        <PBadge variant="secondary">{badge}</PBadge>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: "var(--ink)",
          marginTop: 8,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 8 }}>
        {yoy != null ? (
          <DeltaValue value={yoy} size={12} />
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>—</span>
        )}
        <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>
          전년동기{sub ? ` · ${sub}` : ""}
        </span>
      </div>
    </PCard>
  );
}
