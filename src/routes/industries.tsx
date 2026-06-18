import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

import { PageHero } from "@/components/site/PageHero";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";
import {
  Collecting,
  DivergingBars,
  Donut,
  FilterSeg,
  Panel,
  PBadge,
  PCard,
  tdStyle,
  thStyle,
  TreemapChart,
} from "@/components/proto/Kit";

import {
  tradeStatisticsQueryOptions,
  chapterPartnersQueryOptions,
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
        content: "HS 챕터 랭킹, 국가별 비중, 월별 추이를 제공하는 한국 교역 대시보드.",
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

  const totalExport = useMemo(() => sum(rows.map((r) => r[expKey] ?? 0)), [rows, expKey]);
  const totalImport = useMemo(() => sum(rows.map((r) => r[impKey] ?? 0)), [rows, impKey]);
  const balance = totalExport - totalImport;

  const chapterAggs = useMemo(
    () => aggregateByChapter(rows, expKey, impKey),
    [rows, expKey, impKey],
  );
  const surplusChapters = chapterAggs.filter((a) => a.balance > 0).length;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <Header maxPeriod={maxPeriod} />
      <main className="mx-auto max-w-[1540px] space-y-4 px-4 py-[26px] lg:px-12">
        <RouteBreadcrumb />
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

        {/* KPI — 프로토타입 4분할 */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <IndustryKpi label="총수출" value={fmt(totalExport)} />
          <IndustryKpi label="총수입" value={fmt(totalImport)} />
          <IndustryKpi
            label="무역수지"
            value={fmt(balance)}
            valueColor={balance >= 0 ? "var(--direction-up)" : "var(--direction-down)"}
            sub={balance >= 0 ? "흑자" : "적자"}
          />
          <IndustryKpi
            label="흑자 챕터"
            value={chapterAggs.length > 0 ? `${surplusChapters} / ${chapterAggs.length}` : "—"}
            sub="무역수지 > 0 기준"
          />
        </div>

        {view === "hs" ? (
          <ChapterSection rows={rows} expKey={expKey} impKey={impKey} fmt={fmt} />
        ) : (
          <CountrySection rows={rows} expKey={expKey} impKey={impKey} fmt={fmt} />
        )}

        <MonthlyTrend rows={rows} expKey={expKey} impKey={impKey} metric={metric} />

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          출처: 관세청 수출입무역통계 · 기준: {formatPeriod(maxPeriod ?? "")}. 월별 통계는 익월
          갱신.
        </footer>
      </main>
    </div>
  );
}

function sum(arr: number[]) {
  let s = 0;
  for (const v of arr) s += Number.isFinite(v) ? v : 0;
  return s;
}

function IndustryKpi({
  label,
  value,
  sub,
  valueColor = "var(--ink)",
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <PCard pad="md">
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: valueColor,
          marginTop: 6,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>{sub}</div>}
    </PCard>
  );
}

function Header({ maxPeriod }: { maxPeriod: string | undefined }) {
  return (
    <PageHero
      eyebrow="Industries"
      titleMain="산업"
      titleAccent="교역 동향"
      subtitle="관세청 무역통계를 HS 챕터 단위로 랭킹·분석합니다. 실제 데이터가 있는 챕터만 표시합니다."
      chips={[{ label: "기준", value: formatPeriod(maxPeriod ?? "—"), color: "var(--color-cyan)" }]}
    />
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
  onChange: (
    patch: Partial<{ from: string; to: string; metric: "usd" | "weight"; view: "hs" | "country" }>,
  ) => void;
}) {
  return (
    <PCard pad="md">
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <FilterSeg
          label="보기"
          options={["HS 품목별", "국가별"] as const}
          value={view === "hs" ? "HS 품목별" : "국가별"}
          onChange={(v) => onChange({ view: v === "HS 품목별" ? "hs" : "country" })}
        />
        <FilterSeg
          label="구분"
          options={["수출액(USD)", "중량(t)"] as const}
          value={metric === "usd" ? "수출액(USD)" : "중량(t)"}
          onChange={(v) => onChange({ metric: v === "수출액(USD)" ? "usd" : "weight" })}
        />
        <Field label="기간 시작">
          <select
            value={from ?? ""}
            onChange={(e) => onChange({ from: e.target.value })}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
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
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {formatPeriod(p)}
              </option>
            ))}
          </select>
        </Field>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: "var(--ink-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          기간 {formatPeriod(from ?? "—")} ~ {formatPeriod(to ?? "—")} (확정)
        </span>
      </div>
    </PCard>
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

  const top5Exp = useMemo(() => buildTopWithOther(aggs, "exp"), [aggs]);

  const divergingRows = useMemo(
    () =>
      aggs.slice(0, 6).map((a) => ({
        label: `HS ${a.chapter}`,
        left: a.imp,
        right: a.exp,
      })),
    [aggs],
  );

  const treemapItems = useMemo(
    () => aggs.map((a) => ({ label: `HS ${a.chapter} ${a.name}`, value: a.exp })),
    [aggs],
  );

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="수출 vs 수입 — 상위 HS 챕터"
          badge={<PBadge variant="outline">상위 {divergingRows.length}개 챕터</PBadge>}
        >
          {divergingRows.length === 0 ? (
            <Collecting />
          ) : (
            <DivergingBars
              rows={divergingRows}
              leftLabel="수입"
              rightLabel="수출"
              format={(v) => fmt(v)}
            />
          )}
        </Panel>
        <Panel title="수출 비중 (HS)" badge={<PBadge variant="outline">Top 5 + 기타</PBadge>}>
          {top5Exp.length === 0 ? (
            <Collecting />
          ) : (
            <Donut
              segments={top5Exp.map((d) => ({ label: d.name, value: d.value }))}
              centerLabel={fmt(top5Exp.reduce((s, d) => s + d.value, 0))}
              centerSub="수출 합계"
              format={(v) => fmt(v)}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="HS 챕터 수출 트리맵"
        badge={<PBadge variant="secondary">{aggs.length}개 챕터</PBadge>}
      >
        <TreemapChart items={treemapItems} format={(v) => fmt(v)} height={440} />
      </Panel>

      <Panel
        title="HS 챕터 랭킹"
        badge={<PBadge variant="secondary">{aggs.length}개 챕터 · 상세 클릭 시 드릴다운</PBadge>}
        bodyPad={0}
      >
        {aggs.length === 0 ? (
          <div style={{ padding: 18 }}>
            <Collecting />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle()}>#</th>
                  <th style={thStyle()}>품목 (HS 챕터)</th>
                  <th style={thStyle("right")}>수출</th>
                  <th style={thStyle("right")}>수입</th>
                  <th style={thStyle("right")}>무역수지</th>
                  <th style={thStyle("right")}>상세</th>
                </tr>
              </thead>
              <tbody>
                {aggs.map((a, i) => {
                  const open = expanded === a.chapter;
                  return (
                    <Row key={a.chapter} open={open}>
                      <tr style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ ...tdStyle(), color: "var(--ink-muted)" }}>{i + 1}</td>
                        <td style={tdStyle()}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              color: "var(--navy-600)",
                              fontWeight: 700,
                              marginRight: 8,
                            }}
                          >
                            HS {a.chapter}
                          </span>
                          {a.name}
                        </td>
                        <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)" }}>
                          {fmt(a.exp)}
                        </td>
                        <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)" }}>
                          {fmt(a.imp)}
                        </td>
                        <td
                          style={{
                            ...tdStyle("right"),
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color:
                              a.balance >= 0 ? "var(--direction-up)" : "var(--direction-down)",
                          }}
                        >
                          {fmt(a.balance)}
                        </td>
                        <td style={tdStyle("right")}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((cur) => (cur === a.chapter ? null : a.chapter))
                            }
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--navy-600)",
                              cursor: "pointer",
                            }}
                          >
                            {open ? "닫기" : "상세"}
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr style={{ borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
                          <td colSpan={6} style={{ padding: "18px 16px" }}>
                            <ChapterDetail
                              chapter={a.chapter}
                              chapterName={a.name}
                              rows={rows.filter((r) => hsChapter(r.hs_code) === a.chapter)}
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
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border)",
                fontSize: 11.5,
                color: "var(--ink-muted)",
              }}
            >
              ※ HS 챕터 무역수지 = 수출 − 수입. 실제 데이터가 있는 챕터만 표시됩니다.
            </div>
          </div>
        )}
      </Panel>
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
  // 상위 교역국: item_country(HS10×국가)를 챕터별로 서버 집계(RPC). item 행은 국가 차원이
  // 없어 여기선 쓰지 않는다. 활성 지표(expKey: USD/중량) 기준 상위 5개국.
  const { data: partnerRows = [] } = useQuery(chapterPartnersQueryOptions(chapter));
  const partners = useMemo(
    () =>
      partnerRows
        .map((p) => ({ country: p.country_name, value: p[expKey] ?? 0 }))
        .filter((p) => p.country && p.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [partnerRows, expKey],
  );

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
                  <Line
                    type="monotone"
                    dataKey="exp"
                    name="수출"
                    stroke="#0F2D5A"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="imp"
                    name="수입"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
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
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Panel
        title="국가별 교역 랭킹"
        badge={<PBadge variant="secondary">상위 30개국 · 수출액 내림차순</PBadge>}
        bodyPad={0}
      >
        {aggs.length === 0 ? (
          <div style={{ padding: 18 }}>
            <Collecting />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle()}>#</th>
                  <th style={thStyle()}>국가</th>
                  <th style={thStyle("right")}>수출</th>
                  <th style={thStyle("right")}>수입</th>
                  <th style={thStyle("right")}>무역수지</th>
                </tr>
              </thead>
              <tbody>
                {aggs.slice(0, 30).map((a, i) => (
                  <tr key={a.country} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle(), color: "var(--ink-muted)" }}>{i + 1}</td>
                    <td style={{ ...tdStyle(), fontWeight: 600 }}>{a.country}</td>
                    <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)" }}>
                      {fmt(a.exp)}
                    </td>
                    <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)" }}>
                      {fmt(a.imp)}
                    </td>
                    <td
                      style={{
                        ...tdStyle("right"),
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: a.balance >= 0 ? "var(--direction-up)" : "var(--direction-down)",
                      }}
                    >
                      {fmt(a.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="국가별 수출 비중" badge={<PBadge variant="outline">Top 5 + 기타</PBadge>}>
        {top5Exp.length === 0 ? (
          <Collecting />
        ) : (
          <Donut
            segments={top5Exp.map((d) => ({ label: d.name, value: d.value }))}
            centerLabel={fmt(top5Exp.reduce((s, d) => s + d.value, 0))}
            centerSub="수출 합계"
            format={(v) => fmt(v)}
          />
        )}
      </Panel>
    </div>
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
    <Panel
      title="월별 교역 추이"
      badge={<PBadge variant="outline">막대=수출·수입 · 선=합계</PBadge>}
    >
      {data.length < 2 ? (
        <Collecting note="월별 추이는 2개 이상 기간 데이터 확보 후 표시됩니다." />
      ) : (
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => fmt(v)}
                tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                axisLine={false}
                tickLine={false}
                width={76}
              />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="수출" fill="var(--navy-600)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="수입" fill="#b6c5dc" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="합계"
                stroke="var(--status-caution)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
