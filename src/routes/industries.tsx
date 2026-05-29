import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
} from "recharts";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import {
  tradeStatisticsQueryOptions,
  hsChapter,
  hsChapterName,
  formatPeriod,
  formatUSD,
  formatTon,
  type TradeStatRow,
} from "@/lib/api/industries";

const searchSchema = z.object({
  from: fallback(z.string().optional(), undefined),
  to: fallback(z.string().optional(), undefined),
  metric: fallback(z.enum(["usd", "weight"]), "usd").default("usd"),
  view: fallback(z.enum(["hs", "country"]), "hs").default("hs"),
});

export const Route = createFileRoute("/industries")({
  validateSearch: zodValidator(searchSchema),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tradeStatisticsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "산업별 교역 동향 — Logisight" },
      {
        name: "description",
        content:
          "관세청 수출입무역통계 기준 HS 품목별·국가별 교역량과 무역수지를 한 화면에서 분석합니다.",
      },
      { property: "og:title", content: "산업별 교역 동향 — Logisight" },
      {
        property: "og:description",
        content:
          "HS 챕터 랭킹, 국가별 비중, 월별 추이를 제공하는 한국 교역 대시보드.",
      },
      { property: "og:url", content: "https://logisight-core.lovable.app/industries" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/industries" }],
  }),
  component: IndustriesPage,
  errorComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      페이지를 찾을 수 없습니다.
    </div>
  ),
});

const PIE_COLORS = [
  "#0F2D5A",
  "#1B4D8C",
  "#38BDF8",
  "#0EA5A4",
  "#F59E0B",
  "#94A3B8",
];

function IndustriesPage() {
  const { from, to, metric, view } = Route.useSearch();
  const navigate = useNavigate({ from: "/industries" });
  const { data: allRows } = useSuspenseQuery(tradeStatisticsQueryOptions());

  const periods = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) if (r.period) s.add(r.period);
    return [...s].sort();
  }, [allRows]);

  const periodFrom = from && periods.includes(from) ? from : periods[0];
  const periodTo = to && periods.includes(to) ? to : periods[periods.length - 1];
  const maxPeriod = periods[periods.length - 1];

  const rows = useMemo(() => {
    if (!periodFrom || !periodTo) return [];
    return allRows.filter((r) => r.period >= periodFrom && r.period <= periodTo);
  }, [allRows, periodFrom, periodTo]);

  const expKey = metric === "usd" ? "export_usd" : "export_weight";
  const impKey = metric === "usd" ? "import_usd" : "import_weight";
  const fmt = metric === "usd" ? formatUSD : formatTon;

  const totalExport = useMemo(
    () => sum(rows.map((r) => r[expKey] ?? 0)),
    [rows, expKey],
  );
  const totalImport = useMemo(
    () => sum(rows.map((r) => r[impKey] ?? 0)),
    [rows, impKey],
  );
  const balance = totalExport - totalImport;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
      <Header maxPeriod={maxPeriod} />
      <Filters
        periods={periods}
        from={periodFrom}
        to={periodTo}
        metric={metric}
        view={view}
        onChange={(patch) =>
          navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) })
        }
      />
      <Summary
        from={periodFrom}
        to={periodTo}
        totalExport={totalExport}
        totalImport={totalImport}
        balance={balance}
        fmt={fmt}
        metricLabel={metric === "usd" ? "수출액" : "중량"}
      />

      {view === "hs" ? (
        <ChapterSection rows={rows} expKey={expKey} impKey={impKey} fmt={fmt} />
      ) : (
        <CountrySection rows={rows} expKey={expKey} impKey={impKey} fmt={fmt} />
      )}

      <MonthlyTrend rows={rows} expKey={expKey} impKey={impKey} metric={metric} />

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        출처: 관세청 수출입무역통계 · 기준: {formatPeriod(maxPeriod ?? "")}. 월별 통계는 익월 갱신.
      </footer>
    </main>
  );
}

function sum(arr: number[]) {
  let s = 0;
  for (const v of arr) s += Number.isFinite(v) ? v : 0;
  return s;
}

function Header({ maxPeriod }: { maxPeriod: string | undefined }) {
  return (
    <header className="border-b border-border pb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-cyan)]">
        Industries
      </p>
      <h1 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
        산업별 교역 동향
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground lg:text-base">
        관세청 수출입무역통계 기준 교역량 상위 품목 · 기준: {formatPeriod(maxPeriod ?? "—")}
      </p>
    </header>
  );
}

function Filters({
  periods,
  from,
  to,
  metric,
  view,
  onChange,
}: {
  periods: string[];
  from: string | undefined;
  to: string | undefined;
  metric: "usd" | "weight";
  view: "hs" | "country";
  onChange: (patch: Partial<{ from: string; to: string; metric: "usd" | "weight"; view: "hs" | "country" }>) => void;
}) {
  return (
    <section className="mt-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
      <Field label="기간 시작">
        <select
          value={from ?? ""}
          onChange={(e) => onChange({ from: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriod(p)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="기간 종료">
        <select
          value={to ?? ""}
          onChange={(e) => onChange({ to: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriod(p)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="구분">
        <Toggle
          options={[
            { value: "usd", label: "수출액(USD)" },
            { value: "weight", label: "중량(t)" },
          ]}
          value={metric}
          onChange={(v) => onChange({ metric: v as "usd" | "weight" })}
        />
      </Field>
      <Field label="보기">
        <Toggle
          options={[
            { value: "hs", label: "HS 품목별" },
            { value: "country", label: "국가별" },
          ]}
          value={view}
          onChange={(v) => onChange({ view: v as "hs" | "country" })}
        />
      </Field>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex h-9 rounded-md border border-border bg-background p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-[5px] px-3 text-xs font-medium transition-colors ${
              active
                ? "bg-[var(--color-navy-900)] text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Summary({
  from,
  to,
  totalExport,
  totalImport,
  balance,
  fmt,
  metricLabel,
}: {
  from: string | undefined;
  to: string | undefined;
  totalExport: number;
  totalImport: number;
  balance: number;
  fmt: (n: number | null) => string;
  metricLabel: string;
}) {
  const data = [
    { name: "수출", value: Math.max(totalExport, 0) },
    { name: "수입", value: Math.max(totalImport, 0) },
  ];
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          {formatPeriod(from ?? "—")} ~ {formatPeriod(to ?? "—")} · {metricLabel} 합계
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="총 수출" value={fmt(totalExport)} tone="positive" />
          <Stat label="총 수입" value={fmt(totalImport)} tone="neutral" />
          <Stat
            label="무역수지"
            value={fmt(balance)}
            tone={balance >= 0 ? "positive" : "negative"}
          />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">
          수출 vs 수입
        </p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={36} outerRadius={60}>
                <Cell fill="#0F2D5A" />
                <Cell fill="#38BDF8" />
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

type MetricKey = "export_usd" | "import_usd" | "export_weight" | "import_weight";

type ChapterAgg = {
  chapter: string;
  name: string;
  exp: number;
  imp: number;
  balance: number;
};

function ChapterSection({
  rows,
  expKey,
  impKey,
  fmt,
}: {
  rows: TradeStatRow[];
  expKey: MetricKey;
  impKey: MetricKey;
  fmt: (n: number | null) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const aggs = useMemo(() => aggregateByChapter(rows, expKey, impKey), [rows, expKey, impKey]);

  const top5Exp = useMemo(
    () => buildTopWithOther(aggs, "exp"),
    [aggs],
  );
  const top5Imp = useMemo(
    () => buildTopWithOther(aggs, "imp"),
    [aggs],
  );

  return (
    <>
      <section className="mt-10">
        <SectionTitle title="HS 챕터 랭킹" subtitle="선택된 지표 내림차순. 실제 데이터가 있는 챕터만 표시됩니다." />
        {aggs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">HS 챕터</th>
                  <th className="px-4 py-3 text-right font-medium">수출</th>
                  <th className="px-4 py-3 text-right font-medium">수입</th>
                  <th className="px-4 py-3 text-right font-medium">무역수지</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aggs.map((a, i) => {
                  const open = expanded === a.chapter;
                  return (
                    <Row key={a.chapter} open={open}>
                      <tr className="bg-card">
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            HS {a.chapter} · {a.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{fmt(a.exp)}</td>
                        <td className="px-4 py-3 text-right">{fmt(a.imp)}</td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${
                            a.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {fmt(a.balance)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((cur) => (cur === a.chapter ? null : a.chapter))
                            }
                            className="text-xs font-medium text-[var(--color-navy-600)] hover:underline"
                          >
                            {open ? "닫기" : "상세"}
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-muted/20">
                          <td colSpan={6} className="px-4 py-5">
                            <ChapterDetail
                              chapter={a.chapter}
                              chapterName={a.name}
                              rows={rows.filter(
                                (r) => hsChapter(r.hs_code) === a.chapter,
                              )}
                              expKey={expKey}
                              impKey={impKey}
                              fmt={fmt}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Row>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <DonutCard
          title="수출 비중 (HS 챕터)"
          data={top5Exp}
          fmt={fmt}
        />
        <DonutCard
          title="수입 비중 (HS 챕터)"
          data={top5Imp}
          fmt={fmt}
        />
      </section>
    </>
  );
}

function Row({ open: _open, children }: { open: boolean; children: React.ReactNode }) {
  return <>{children}</>;
}

function aggregateByChapter(
  rows: TradeStatRow[],
  expKey: MetricKey,
  impKey: MetricKey,
): ChapterAgg[] {
  const map = new Map<string, ChapterAgg>();
  for (const r of rows) {
    const ch = hsChapter(r.hs_code);
    if (ch === "—") continue;
    const cur = map.get(ch) ?? {
      chapter: ch,
      name: hsChapterName(ch),
      exp: 0,
      imp: 0,
      balance: 0,
    };
    cur.exp += r[expKey] ?? 0;
    cur.imp += r[impKey] ?? 0;
    map.set(ch, cur);
  }
  const arr = [...map.values()].map((a) => ({ ...a, balance: a.exp - a.imp }));
  arr.sort((a, b) => b.exp - a.exp);
  return arr;
}

function buildTopWithOther(
  aggs: ChapterAgg[],
  key: "exp" | "imp",
): { name: string; value: number }[] {
  const sorted = [...aggs].sort((a, b) => b[key] - a[key]).filter((a) => a[key] > 0);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const result = top.map((a) => ({
    name: `HS ${a.chapter} ${a.name}`,
    value: a[key],
  }));
  const restSum = rest.reduce((s, a) => s + a[key], 0);
  if (restSum > 0) result.push({ name: "기타", value: restSum });
  return result;
}

function DonutCard({
  title,
  data,
  fmt,
}: {
  title: string;
  data: { name: string; value: number }[];
  fmt: (n: number | null) => string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">수집 예정</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={1}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                wrapperStyle={{ fontSize: 10, maxWidth: 160 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ChapterDetail({
  chapter,
  chapterName,
  rows,
  expKey,
  impKey,
  fmt,
}: {
  chapter: string;
  chapterName: string;
  rows: TradeStatRow[];
  expKey: MetricKey;
  impKey: MetricKey;
  fmt: (n: number | null) => string;
}) {
  const partners = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.country_name ?? "—";
      map.set(k, (map.get(k) ?? 0) + (r[expKey] ?? 0));
    }
    return [...map.entries()]
      .map(([country, value]) => ({ country, value }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [rows, expKey]);

  const monthly = useMemo(() => {
    const map = new Map<string, { period: string; exp: number; imp: number }>();
    for (const r of rows) {
      if (!r.period) continue;
      const cur = map.get(r.period) ?? { period: r.period, exp: 0, imp: 0 };
      cur.exp += r[expKey] ?? 0;
      cur.imp += r[impKey] ?? 0;
      map.set(r.period, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((d) => ({ ...d, period: formatPeriod(d.period) }));
  }, [rows, expKey, impKey]);

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        HS {chapter} · {chapterName} — 상위 교역국 및 월별 추이
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">상위 수출 대상국 Top 5</p>
          <div className="h-56">
            {partners.length === 0 ? (
              <p className="pt-6 text-center text-sm text-muted-foreground">수집 예정</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partners} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={(v) => fmt(v)} fontSize={10} />
                  <YAxis dataKey="country" type="category" fontSize={11} width={70} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" fill="#1B4D8C" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">월별 수출입 추이</p>
          <div className="h-56">
            {monthly.length === 0 ? (
              <p className="pt-6 text-center text-sm text-muted-foreground">수집 예정</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" fontSize={10} />
                  <YAxis tickFormatter={(v) => fmt(v)} fontSize={10} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="exp" name="수출" stroke="#0F2D5A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="imp" name="수입" stroke="#38BDF8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountrySection({
  rows,
  expKey,
  impKey,
  fmt,
}: {
  rows: TradeStatRow[];
  expKey: MetricKey;
  impKey: MetricKey;
  fmt: (n: number | null) => string;
}) {
  const aggs = useMemo(() => {
    const map = new Map<string, { country: string; exp: number; imp: number }>();
    for (const r of rows) {
      const k = r.country_name ?? "—";
      const cur = map.get(k) ?? { country: k, exp: 0, imp: 0 };
      cur.exp += r[expKey] ?? 0;
      cur.imp += r[impKey] ?? 0;
      map.set(k, cur);
    }
    return [...map.values()]
      .map((a) => ({ ...a, balance: a.exp - a.imp }))
      .sort((a, b) => b.exp - a.exp);
  }, [rows, expKey, impKey]);

  const top5Exp = useMemo(() => {
    const sorted = [...aggs].filter((a) => a.exp > 0).slice(0, 5);
    const rest = aggs.filter((a) => a.exp > 0).slice(5);
    const result = sorted.map((a) => ({ name: a.country, value: a.exp }));
    const restSum = rest.reduce((s, a) => s + a.exp, 0);
    if (restSum > 0) result.push({ name: "기타", value: restSum });
    return result;
  }, [aggs]);

  return (
    <>
      <section className="mt-10">
        <SectionTitle title="국가별 교역 랭킹" subtitle="선택된 지표 내림차순." />
        {aggs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">국가</th>
                  <th className="px-4 py-3 text-right font-medium">수출</th>
                  <th className="px-4 py-3 text-right font-medium">수입</th>
                  <th className="px-4 py-3 text-right font-medium">무역수지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aggs.slice(0, 30).map((a, i) => (
                  <tr key={a.country} className="bg-card">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{a.country}</td>
                    <td className="px-4 py-3 text-right">{fmt(a.exp)}</td>
                    <td className="px-4 py-3 text-right">{fmt(a.imp)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        a.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {fmt(a.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <DonutCard title="국가별 수출 비중 Top 5 + 기타" data={top5Exp} fmt={fmt} />
      </section>
    </>
  );
}

function MonthlyTrend({
  rows,
  expKey,
  impKey,
  metric,
}: {
  rows: TradeStatRow[];
  expKey: MetricKey;
  impKey: MetricKey;
  metric: "usd" | "weight";
}) {
  const fmt = metric === "usd" ? formatUSD : formatTon;
  const data = useMemo(() => {
    const map = new Map<string, { period: string; exp: number; imp: number }>();
    for (const r of rows) {
      if (!r.period) continue;
      const cur = map.get(r.period) ?? { period: r.period, exp: 0, imp: 0 };
      cur.exp += r[expKey] ?? 0;
      cur.imp += r[impKey] ?? 0;
      map.set(r.period, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((d) => ({
        period: formatPeriod(d.period),
        수출: d.exp,
        수입: d.imp,
        합계: d.exp + d.imp,
      }));
  }, [rows, expKey, impKey]);

  return (
    <section className="mt-10">
      <SectionTitle title="월별 교역 추이" subtitle="기간 전체 합산. 막대=수출/수입, 선=합계." />
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 h-80 rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" fontSize={11} />
              <YAxis tickFormatter={(v) => fmt(v)} fontSize={11} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="수출" fill="#0F2D5A" />
              <Bar dataKey="수입" fill="#38BDF8" />
              <Line type="monotone" dataKey="합계" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="mt-4 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      수집 예정
    </p>
  );
}