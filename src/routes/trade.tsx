import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CalendarDays,
  Database,
  Download,
  Globe2,
  Package,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

import {
  formatPeriod,
  pctChange,
  tradeStatisticsBundleQueryOptions,
  type TradeStatRow,
  type TradeStatisticsBundle,
} from "@/lib/api/trade";
import { indexStatsQueryOptions, formatNumber } from "@/lib/api/rates";
import { ISO2_TO_NUMERIC, flagEmoji } from "@/lib/iso-country-codes";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
        content: "관세청 수출입무역통계 기반 교역액, 국가·품목 랭킹, 월별 추이를 한 화면에서 분석합니다.",
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
type RegionKey = "전체" | "아시아" | "북미" | "유럽" | "중동" | "중남미" | "아프리카" | "오세아니아";

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

const REGIONS: RegionKey[] = ["전체", "아시아", "북미", "유럽", "중동", "중남미", "아프리카", "오세아니아"];
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
  return [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))]
    .sort()
    .at(-1) ?? null;
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

function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function toneFor(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-slate-500";
  return v > 0 ? "text-emerald-600" : "text-red-500";
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
      if (!existing || priodRank(row.priod_dt) >= priodRank(existing.priod_dt)) picked.set(key, row);
    }

    const allExp = picked.get("provisional_exp|ALL");
    const allImp = picked.get("provisional_imp|ALL");
    const countryRows = [...picked.values()].filter((row) => (row.country_code ?? "").toUpperCase() !== "ALL");
    const exportUsd = allExp?.export_usd ?? sum(countryRows.filter((row) => row.stat_type === "provisional_exp").map((row) => row.export_usd ?? 0));
    const importUsd = allImp?.import_usd ?? sum(countryRows.filter((row) => row.stat_type === "provisional_imp").map((row) => row.import_usd ?? 0));
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
    totalYoY: pctChange((current.exportUsd ?? 0) + (current.importUsd ?? 0), (prev.exportUsd ?? 0) + (prev.importUsd ?? 0)),
    exportYoY: pctChange(current.exportUsd, prev.exportUsd),
    importYoY: pctChange(current.importUsd, prev.importUsd),
    balanceYoY: pctChange(current.balanceUsd, prev.balanceUsd),
  };
}

function buildCountryAgg(rows: TradeStatRow[], region: RegionKey, metric: MetricMode): CountryAgg[] {
  const latest = latestPeriod(rows);
  const previous =
    prevYearPeriod(latest) && rows.some((row) => periodKey(row.period) === prevYearPeriod(latest))
      ? prevYearPeriod(latest)
      : [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))]
          .sort()
          .filter((period) => period !== latest)
          .at(-1) ?? null;

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
      : [...new Set(rows.map((row) => periodKey(row.period)).filter(Boolean))]
          .sort()
          .filter((period) => period !== latest)
          .at(-1) ?? null;

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
    .map((item) => ({ ...item, changePct: pctChange(item.tradeUsd, prevByHs.get(item.code) ?? null) }))
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
    const totalCountryTrade = sum(rowsForPeriod(bundle.country, latestCountryPeriod).map((row) => (row.export_usd ?? 0) + (row.import_usd ?? 0)));

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

function TradePage() {
  const { data: bundle } = useSuspenseQuery(tradeStatisticsBundleQueryOptions());
  const { data: indexStats } = useSuspenseQuery(indexStatsQueryOptions());
  const [region, setRegion] = useState<RegionKey>("전체");
  const [metric, setMetric] = useState<MetricMode>("total");

  const model = useTradeModel(bundle, region, metric);
  const indexSnapshot = indexStats.filter((s) => s.latest_value != null).slice(0, 6);
  const topCountry = model.countries[0] ?? null;
  const topItem = model.items[0] ?? null;
  const topContinent = model.continents[0] ?? null;
  const topNewnature = [...model.newnatureRows].sort((a, b) => (b.export_usd ?? 0) + (b.import_usd ?? 0) - ((a.export_usd ?? 0) + (a.import_usd ?? 0)))[0] ?? null;

  return (
    <main className="bg-[#f5f8fc] text-slate-900">
      <section className="mx-auto max-w-[1540px] px-4 py-5 lg:px-12">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <h1 className="text-2xl font-black tracking-normal text-slate-950 lg:text-3xl">무역 동향 인사이트</h1>
            <p className="pb-1 text-xs font-semibold text-slate-500">
              실데이터로 국가·대륙·품목·신성질 통계를 표시합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton icon={<Download className="h-4 w-4" />}>리포트 다운로드</ActionButton>
            <ActionButton icon={<Share2 className="h-4 w-4" />}>공유</ActionButton>
          </div>
        </div>

        <FilterBar region={region} metric={metric} onRegion={setRegion} onMetric={setMetric} model={model} />

        <section className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Globe2 className="h-6 w-6" />}
            label="전체 교역액(USD)"
            value={money(model.totalTrade)}
            change={model.totalTradeYoY}
            sub={`잠정 전체 · ${formatPeriod(model.snapshot.period)} ${model.snapshot.priodDt ?? ""}`}
          />
          <KpiCard
            icon={<ArrowUpRight className="h-6 w-6" />}
            label="수출액(USD)"
            value={money(model.snapshot.exportUsd)}
            change={model.snapshot.exportYoY}
            sub="provisional_exp 전체값"
          />
          <KpiCard
            icon={<Box className="h-6 w-6" />}
            label="수입액(USD)"
            value={money(model.snapshot.importUsd)}
            change={model.snapshot.importYoY}
            sub="provisional_imp 전체값"
          />
          <KpiCard
            icon={<Scale className="h-6 w-6" />}
            label="무역수지(USD)"
            value={money(model.snapshot.balanceUsd)}
            change={model.snapshot.balanceYoY}
            sub="수출액 - 수입액"
          />
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
          <Panel className="min-h-[360px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-900">국가별 교역액(USD)</h2>
                <p className="text-[11px] font-semibold text-slate-500">
                  {formatPeriod(model.latestCountryPeriod)} · {model.countries.length}개국
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegion(r)}
                    className={[
                      "rounded-md px-3 py-1.5 text-xs font-black transition",
                      region === r ? "bg-[#061a35] text-white" : "bg-white text-slate-600 hover:bg-blue-50",
                    ].join(" ")}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <TradeMapPanel countries={model.countries} />
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
            <RankingPanel
              title="주요 국가 TOP 10"
              caption={`${metricLabel(metric)} · country`}
              rows={model.countries.slice(0, 10).map((country) => ({
                key: country.code,
                flagCode: country.code,
                name: country.name,
                value: metricValue(country, metric),
                change: country.changePct,
              }))}
            />
            <RankingPanel
              title="상위 품목 TOP 10"
              caption={`${metricLabel(metric)} · item ${formatPeriod(model.latestItemPeriod)}`}
              rows={model.items.slice(0, 10).map((item) => ({
                key: item.code,
                name: item.name,
                value: metricValue(item, metric),
                change: item.changePct,
              }))}
            />
          </div>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_360px]">
          <TrendCard title="월별 수출 추이 (USD)" value={money(model.snapshot.exportUsd)} change={model.snapshot.exportYoY}>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={model.monthly}>
                <CartesianGrid stroke="#e5edf6" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatAxisUsd} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v) => moneyUsd(Number(v))} labelFormatter={(label) => `${label}`} />
                <Line type="monotone" dataKey="exportUsd" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </TrendCard>
          <TrendCard title="월별 수입 추이 (USD)" value={money(model.snapshot.importUsd)} change={model.snapshot.importYoY}>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={model.monthly}>
                <CartesianGrid stroke="#e5edf6" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatAxisUsd} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v) => moneyUsd(Number(v))} />
                <Area type="monotone" dataKey="importUsd" stroke="#0ea5e9" fill="#bfdbfe" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </TrendCard>
          <TrendCard title="무역수지 추이 (USD)" value={money(model.snapshot.balanceUsd)} change={model.snapshot.balanceYoY}>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={model.monthly}>
                <CartesianGrid stroke="#e5edf6" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatAxisUsd} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v) => moneyUsd(Number(v))} />
                <Bar dataKey="balanceUsd" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TrendCard>

          <aside className="space-y-3">
            <InsightPanel
              topContinent={topContinent}
              topCountry={topCountry}
              topItem={topItem}
              topNewnature={topNewnature}
              balance={model.snapshot.balanceUsd}
            />
          </aside>
        </section>

        <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">대륙별 교역 현황</h2>
                <p className="text-[11px] font-semibold text-slate-500">`continent` 확정치 · {formatPeriod(model.latestContinentPeriod)}</p>
              </div>
              <span className="text-[11px] font-bold text-slate-400">{metricLabel(metric)}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {model.continents.map((continent) => (
                <div key={continent.code} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-800">{continent.name}</span>
                    <span className="text-xs font-black text-blue-600">{money(metricValue(continent, metric))}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    수출 {moneyUsd(continent.exportUsd)} · 수입 {moneyUsd(continent.importUsd)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">글로벌 주요 지수</h2>
                <p className="text-[11px] font-semibold text-slate-500">freight_indices 저장 데이터 기준</p>
              </div>
              <span className="text-[11px] font-bold text-slate-400">기준 {indexSnapshot[0]?.latest_date?.slice(0, 10) ?? "-"}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {indexSnapshot.map((row) => (
                <div key={row.index_code} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-500">{row.index_code}</span>
                    <span className={`text-xs font-black ${toneFor(row.change_pct)}`}>{pct(row.change_pct)}</span>
                  </div>
                  <p className="mt-1 text-lg font-black tabular-nums">{formatNumber(row.latest_value, 2)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function FilterBar({
  region,
  metric,
  onRegion,
  onMetric,
  model,
}: {
  region: RegionKey;
  metric: MetricMode;
  onRegion: (r: RegionKey) => void;
  onMetric: (m: MetricMode) => void;
  model: ReturnType<typeof useTradeModel>;
}) {
  return (
    <section className="rounded-lg border border-[#d8e3ef] bg-white p-3 shadow-[0_10px_28px_rgba(15,35,65,0.06)]">
      <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto]">
        <FilterBox label="기간" icon={<CalendarDays className="h-4 w-4" />}>
          확정 {formatPeriod(model.latestCountryPeriod)} · 잠정 {formatPeriod(model.snapshot.period)}
        </FilterBox>
        <FilterSelect label="출발국" value="대한민국" />
        <label className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="block text-[11px] font-bold text-slate-500">목적권역</span>
          <select
            value={region}
            onChange={(event) => onRegion(event.target.value as RegionKey)}
            className="mt-1 w-full bg-transparent text-sm font-black outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="block text-[11px] font-bold text-slate-500">지표</span>
          <select
            value={metric}
            onChange={(event) => onMetric(event.target.value as MetricMode)}
            className="mt-1 w-full bg-transparent text-sm font-black outline-none"
          >
            <option value="total">교역액</option>
            <option value="export">수출액</option>
            <option value="import">수입액</option>
            <option value="balance">무역수지</option>
          </select>
        </label>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#061a35] px-5 text-sm font-black text-white"
        >
          <RefreshCw className="h-4 w-4" />
          적용하기
        </button>
      </div>
    </section>
  );
}

function FilterBox({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
        {icon}
        {label}
      </span>
      <p className="mt-1 text-sm font-black text-slate-800">{children}</p>
    </div>
  );
}

function FilterSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="block text-[11px] font-bold text-slate-500">{label}</span>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function ActionButton({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm"
    >
      {icon}
      {children}
    </button>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[#d8e3ef] bg-white p-4 shadow-[0_10px_28px_rgba(15,35,65,0.06)] ${className}`}>
      {children}
    </section>
  );
}

function KpiCard({ icon, label, value, change, sub }: { icon: ReactNode; label: string; value: string; change: number | null; sub: string }) {
  return (
    <Panel>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-600">{label}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <strong className="text-2xl font-black tracking-normal text-slate-950">{value}</strong>
            <span className={`text-xs font-black ${toneFor(change)}`}>{pct(change)}</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">{sub}</p>
        </div>
      </div>
    </Panel>
  );
}

function RankingPanel({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: { key: string; name: string; value: number; change: number | null; flagCode?: string }[];
}) {
  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">{title}</h2>
        <span className="text-[11px] font-bold text-slate-400">{caption}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[26px_minmax(0,1fr)_auto_auto] items-center gap-2 text-xs">
            <span className="text-center font-black text-slate-500">{index + 1}</span>
            <span className="flex min-w-0 items-center gap-1.5 font-bold text-slate-700">
              {row.flagCode ? (
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                  <img
                    src={`https://flagcdn.com/w40/${row.flagCode.toLowerCase()}.png`}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
              ) : null}
              <span className="min-w-0 truncate">{compactName(row.name, 18)}</span>
            </span>
            <span className="font-black tabular-nums text-slate-900">{money(row.value)}</span>
            <span className={`w-14 text-right font-black tabular-nums ${toneFor(row.change)}`}>{pct(row.change)}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm font-semibold text-slate-500">표시할 저장 데이터가 없습니다.</p>}
      </div>
    </Panel>
  );
}

function TradeMapPanel({ countries }: { countries: CountryAgg[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const byNumeric = useMemo(() => {
    const map = new Map<string, CountryAgg>();
    for (const country of countries) {
      const numeric = ISO2_TO_NUMERIC[country.code];
      if (numeric) map.set(numeric, country);
    }
    return map;
  }, [countries]);
  const max = Math.max(...countries.map((c) => c.tradeUsd), 1);
  const top = countries.slice(0, 6);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
      <div className="relative min-h-[280px] overflow-hidden rounded-lg bg-[#f4f8fd]">
        {mounted ? (
          <ComposableMap projection="geoNaturalEarth1" projectionConfig={{ scale: 165 }} className="h-full w-full">
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const id = String(geo.id).padStart(3, "0");
                  const row = byNumeric.get(id);
                  const ratio = row ? Math.min(Math.max(row.tradeUsd / max, 0.08), 1) : 0;
                  const fill = row ? `rgba(37, 99, 235, ${0.18 + ratio * 0.68})` : "#dfe8f3";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#ffffff"
                      strokeWidth={0.45}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: row ? "#1d4ed8" : "#cbd5e1" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm font-semibold text-slate-400">지도 로딩 중</div>
        )}
        <div className="absolute bottom-4 left-4 rounded-md bg-white/90 p-2 text-[11px] font-bold text-slate-600 shadow-sm">
          <div className="mb-1">교역액 강도</div>
          <div className="flex items-center gap-1">
            {["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"].map((c) => (
              <span key={c} className="h-3 w-5 rounded-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {top.map((country) => (
          <div key={country.code} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-black text-slate-800">
                {flagEmoji(country.code)} {country.name}
              </span>
              <span className={`text-xs font-black ${toneFor(country.changePct)}`}>{pct(country.changePct)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.max((country.tradeUsd / max) * 100, 5)}%` }} />
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-500">교역액 {moneyUsd(country.tradeUsd)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendCard({ title, value, change, children }: { title: string; value: string; change: number | null; children: ReactNode }) {
  return (
    <Panel>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-sm font-black text-slate-900">{title}</h2>
        <div className="text-right">
          <p className="text-sm font-black tabular-nums text-slate-900">{value}</p>
          <p className={`text-xs font-black tabular-nums ${toneFor(change)}`}>{pct(change)}</p>
        </div>
      </div>
      {children}
    </Panel>
  );
}

function InsightPanel({
  topContinent,
  topCountry,
  topItem,
  topNewnature,
  balance,
}: {
  topContinent: ContinentAgg | null;
  topCountry: CountryAgg | null;
  topItem: ItemAgg | null;
  topNewnature: TradeStatRow | null;
  balance: number | null | undefined;
}) {
  const insights = [
    topContinent
      ? {
          title: `${topContinent.name} 교역 비중 우위`,
          body: `continent 기준 교역액 ${moneyUsd(topContinent.tradeUsd)}로 최신 확정 기간의 상위 권역입니다.`,
          icon: <Globe2 className="h-5 w-5" />,
        }
      : null,
    topCountry
      ? {
          title: `${topCountry.name} 국가 교역 상위`,
          body: `country 기준 교역액 ${moneyUsd(topCountry.tradeUsd)}, 변화율 ${pct(topCountry.changePct)}입니다.`,
          icon: <Sparkles className="h-5 w-5" />,
        }
      : null,
    topItem
      ? {
          title: `${topItem.name} 품목 집중`,
          body: `item 기준 교역액 ${moneyUsd(topItem.tradeUsd)}로 최신 품목 통계의 상위 품목입니다.`,
          icon: <Package className="h-5 w-5" />,
        }
      : null,
    topNewnature
      ? {
          title: `${topNewnature.hs_name ?? topNewnature.hs_code} 신성질 분류`,
          body: `newnature 저장 행 기준 ${topNewnature.country_name ?? topNewnature.country_code} 교역액 ${moneyUsd((topNewnature.export_usd ?? 0) + (topNewnature.import_usd ?? 0))}입니다.`,
          icon: <Database className="h-5 w-5" />,
        }
      : null,
    balance != null
      ? {
          title: balance >= 0 ? "무역수지 흑자" : "무역수지 적자",
          body: `잠정 전체 기준 무역수지는 ${moneyUsd(balance)}입니다.`,
          icon: balance >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />,
        }
      : null,
  ].filter((x): x is { title: string; body: string; icon: ReactNode } => Boolean(x));

  return (
    <Panel>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-black text-slate-900">시장 인사이트 요약</h2>
      </div>
      <div className="space-y-4">
        {insights.slice(0, 4).map((insight) => (
          <div key={insight.title} className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              {insight.icon}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">{insight.title}</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
