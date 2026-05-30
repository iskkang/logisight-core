import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  tradeProvisionalQueryOptions,
  tradeByCountryQueryOptions,
  formatUSD,
  formatPeriod,
  prevPeriod,
  pctChange,
  type TradeProvisionalRow,
} from "@/lib/api/trade";
import { TradeMap } from "@/components/trade/TradeMap";
import { CountryMonthlyChart } from "@/components/trade/CountryMonthlyChart";

export const Route = createFileRoute("/trade")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tradeProvisionalQueryOptions()),
      context.queryClient.ensureQueryData(tradeByCountryQueryOptions()),
    ]),
  head: () => ({
    meta: [
      { title: "한국 무역 동향 — Logisight" },
      {
        name: "description",
        content:
          "관세청 공공데이터 기반 한국 수출입 잠정치와 국가별 교역 현황을 실시간으로 확인하세요.",
      },
      { property: "og:title", content: "한국 무역 동향 — Logisight" },
      {
        property: "og:description",
        content: "한국 수출입 잠정치, 국가별 교역 비중, 전월 동기 대비 변화.",
      },
      { property: "og:url", content: "https://logisight-core.lovable.app/trade" },
    ],
    links: [
      { rel: "canonical", href: "https://logisight-core.lovable.app/trade" },
    ],
  }),
  component: TradePage,
});

type Tab = "export" | "import";

function TradePage() {
  const { data: rows } = useSuspenseQuery(tradeProvisionalQueryOptions());
  const { data: countryRows } = useSuspenseQuery(tradeByCountryQueryOptions());
  const [tab, setTab] = useState<Tab>("export");

  const view = useMemo(() => buildView(rows), [rows]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-navy-900)] lg:text-4xl">
            한국 무역 동향
          </h1>
          <p className="mt-2 text-sm text-slate-600 lg:text-base">
            관세청 공공데이터 기반 수출입 실시간 현황
          </p>
          {view && (
            <p className="mt-1 text-xs text-slate-500">
              기준 시점 · {formatPeriod(view.period)} (잠정치 {view.priodDt ?? "—"})
            </p>
          )}
        </header>

        {!view ? (
          <EmptyState />
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryCard
                label="이달 수출 합계"
                value={view.totals.export_usd}
                deltaPct={view.totals.export_mom}
              />
              <SummaryCard
                label="이달 수입 합계"
                value={view.totals.import_usd}
                deltaPct={view.totals.import_mom}
              />
              <SummaryCard
                label="무역수지"
                value={view.totals.balance}
                deltaPct={view.totals.balance_mom}
                emphasizeSign
              />
          </section>
        )}

        {view && (
          <section className="mt-10 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-navy-900)]">
                    국가별 교역 현황
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    전체 대비 비중 및 전월 동기 대비 변화
                  </p>
                </div>
                <div className="inline-flex rounded-md border border-slate-200 p-0.5">
                  <TabButton active={tab === "export"} onClick={() => setTab("export")}>
                    수출
                  </TabButton>
                  <TabButton active={tab === "import"} onClick={() => setTab("import")}>
                    수입
                  </TabButton>
                </div>
              </div>

              <div className="p-5">
                <CountryBars rows={tab === "export" ? view.exportByCountry : view.importByCountry} />
              </div>
          </section>
        )}

        <TradeMap
          rows={countryRows}
          tab={tab}
          onTabChange={setTab}
          period={null}
        />

        <CountryMonthlyChart rows={countryRows} />

        <p className="mt-6 text-xs text-slate-500">
          잠정치 기준 · 매월 11일·21일·익월 1일 갱신 · 관세청 공공데이터
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded px-4 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-[var(--color-navy-900)] text-white"
          : "text-slate-600 hover:text-slate-900")
      }
    >
      {children}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  deltaPct,
  emphasizeSign,
}: {
  label: string;
  value: number | null;
  deltaPct: number | null;
  emphasizeSign?: boolean;
}) {
  const valColor =
    emphasizeSign && value != null
      ? value >= 0
        ? "text-[#0d9488]"
        : "text-amber-600"
      : "text-[var(--color-navy-900)]";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-black tracking-tight ${valColor}`}>
        {formatUSD(value)}
      </div>
      <div className="mt-2 text-xs">
        <DeltaChip pct={deltaPct} />
        <span className="ml-1 text-slate-400">전월 동기 대비</span>
      </div>
    </div>
  );
}

function DeltaChip({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct))
    return <span className="text-slate-400">—</span>;
  const up = pct >= 0;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 font-semibold " +
        (up ? "text-[#0d9488]" : "text-amber-600")
      }
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

type CountryRow = {
  country_code: string;
  country_name: string;
  value: number;
  share: number;
  momPct: number | null;
};

function CountryBars({ rows }: { rows: CountryRow[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-slate-500">표시할 국가 데이터가 없습니다.</p>;
  const max = rows[0]?.value ?? 1;
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => {
        const pctWidth = max > 0 ? Math.max(2, (r.value / max) * 100) : 0;
        const top3 = i < 3;
        return (
          <li key={r.country_code} className="group">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-800">
                <span className="mr-2 inline-block w-5 text-right text-xs text-slate-400">
                  {i + 1}
                </span>
                {r.country_name}
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                <span className="text-slate-500">{r.share.toFixed(1)}%</span>
                <span className="font-bold text-[var(--color-navy-900)]">
                  {formatUSD(r.value)}
                </span>
                <span className="w-16 text-right">
                  <DeltaChip pct={r.momPct} />
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pctWidth}%`,
                  background: top3 ? "#0d9488" : "#5eead4",
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <p className="text-base font-medium text-slate-700">
        데이터 수집 중입니다.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        매월 11일부터 잠정치가 표시됩니다.
      </p>
    </div>
  );
}

// ---------- Data shaping ----------

type View = {
  period: string;
  priodDt: string | null;
  totals: {
    export_usd: number | null;
    import_usd: number | null;
    balance: number | null;
    export_mom: number | null;
    import_mom: number | null;
    balance_mom: number | null;
  };
  exportByCountry: CountryRow[];
  importByCountry: CountryRow[];
};

function buildView(rows: TradeProvisionalRow[]): View | null {
  if (!rows || rows.length === 0) return null;

  // Latest period overall
  const periods = Array.from(new Set(rows.map((r) => r.period))).sort((a, b) =>
    b.localeCompare(a),
  );
  const latest = periods[0];
  if (!latest) return null;
  const prev = prevPeriod(latest);

  const inLatest = rows.filter((r) => r.period === latest);
  // Pick most recent priod_dt within latest period
  const latestDt = inLatest
    .map((r) => r.priod_dt)
    .filter((v): v is string => !!v)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const currRows = latestDt
    ? inLatest.filter((r) => r.priod_dt === latestDt)
    : inLatest;
  const prevRows = rows.filter((r) => r.period === prev);
  // For previous comparison, prefer same priod_dt; else latest in prev period
  const prevDt =
    (latestDt && prevRows.find((r) => r.priod_dt === latestDt)?.priod_dt) ||
    prevRows
      .map((r) => r.priod_dt)
      .filter((v): v is string => !!v)
      .sort((a, b) => b.localeCompare(a))[0] ||
    null;
  const prevCmp = prevDt
    ? prevRows.filter((r) => r.priod_dt === prevDt)
    : prevRows;

  const findAll = (
    list: TradeProvisionalRow[],
    type: "provisional_exp" | "provisional_imp",
  ) =>
    list.find((r) => r.stat_type === type && r.country_code === "ALL") ?? null;

  const expAll = findAll(currRows, "provisional_exp");
  const impAll = findAll(currRows, "provisional_imp");
  const expAllPrev = findAll(prevCmp, "provisional_exp");
  const impAllPrev = findAll(prevCmp, "provisional_imp");

  const expVal = expAll?.export_usd ?? null;
  const impVal = impAll?.import_usd ?? null;
  const balance =
    expVal != null && impVal != null ? expVal - impVal : null;
  const balancePrev =
    expAllPrev?.export_usd != null && impAllPrev?.import_usd != null
      ? expAllPrev.export_usd - impAllPrev.import_usd
      : null;

  const byCountry = (
    list: TradeProvisionalRow[],
    type: "provisional_exp" | "provisional_imp",
  ) =>
    list.filter(
      (r) =>
        r.stat_type === type &&
        r.country_code != null &&
        r.country_code !== "ALL",
    );

  const buildCountry = (
    type: "provisional_exp" | "provisional_imp",
  ): CountryRow[] => {
    const valKey = type === "provisional_exp" ? "export_usd" : "import_usd";
    const curr = byCountry(currRows, type);
    const prevMap = new Map(
      byCountry(prevCmp, type).map((r) => [r.country_code!, r[valKey]]),
    );
    const total = curr.reduce((s, r) => s + (r[valKey] ?? 0), 0);
    return curr
      .map((r) => {
        const v = r[valKey] ?? 0;
        return {
          country_code: r.country_code!,
          country_name: r.country_name ?? r.country_code!,
          value: v,
          share: total > 0 ? (v / total) * 100 : 0,
          momPct: pctChange(v, prevMap.get(r.country_code!) ?? null),
        };
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  return {
    period: latest,
    priodDt: latestDt,
    totals: {
      export_usd: expVal,
      import_usd: impVal,
      balance,
      export_mom: pctChange(expVal, expAllPrev?.export_usd ?? null),
      import_mom: pctChange(impVal, impAllPrev?.import_usd ?? null),
      balance_mom: pctChange(balance, balancePrev),
    },
    exportByCountry: buildCountry("provisional_exp"),
    importByCountry: buildCountry("provisional_imp"),
  };
}