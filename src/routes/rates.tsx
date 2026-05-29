import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  freightIndicesHistoryQueryOptions,
  rateFilterOptionsQueryOptions,
  freightRatesQueryOptions,
  bunkerPricesQueryOptions,
  formatNumber,
  formatDate,
  type FreightIndexHistoryRow,
  type FreightRateRow,
} from "@/lib/api/rates";
import {
  indexDisplayLabel,
  isNyfiCode,
  NYFI_LANE_LABELS,
} from "@/lib/api/freight-indices";

type Search = {
  pol?: string;
  pod?: string;
  ctype?: string;
};

export const Route = createFileRoute("/rates")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    pol: typeof s.pol === "string" ? s.pol : undefined,
    pod: typeof s.pod === "string" ? s.pod : undefined,
    ctype: typeof s.ctype === "string" ? s.ctype : undefined,
  }),
  loaderDeps: ({ search }) => ({
    pol: search.pol,
    pod: search.pod,
    ctype: search.ctype,
  }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions());
    context.queryClient.ensureQueryData(rateFilterOptionsQueryOptions());
    context.queryClient.ensureQueryData(bunkerPricesQueryOptions());
    context.queryClient.ensureQueryData(
      freightRatesQueryOptions({
        polCode: deps.pol,
        podCode: deps.pod,
        containerType: deps.ctype,
      }),
    );
  },
  head: () => ({
    meta: [
      { title: "운임·지수 — Logisight" },
      {
        name: "description",
        content:
          "SCFI·FBX·KCCI·CCFI·NYFI 주요 컨테이너 운임 지수와 부산발 해상 운임, 벙커유 가격을 한 화면에서 확인하세요.",
      },
      { property: "og:title", content: "운임·지수 — Logisight" },
      {
        property: "og:description",
        content:
          "공개 데이터 기반 컨테이너 운임 지수, 해상 운임, 벙커유 가격 대시보드.",
      },
    ],
  }),
  component: RatesPage,
});

const CHART_COLORS: Record<string, string> = {
  SCFI: "#0F2D5A",
  FBX: "#38BDF8",
  KCCI: "#0EA5A4",
  CCFI: "#F59E0B",
};

const NYFI_CODES = [
  "NYFI:ASIA-USWC",
  "NYFI:ASIA-USEC",
  "NYFI:ASIA-NEUR",
  "NYFI:TRANS-ATLANTIC_WESTBOUND",
  "NYFI:TRANS-ATLANTIC_EASTBOUND",
] as const;

const NYFI_COLORS: Record<string, string> = {
  "NYFI:ASIA-USWC": "#0F2D5A",
  "NYFI:ASIA-USEC": "#1B4D8C",
  "NYFI:ASIA-NEUR": "#38BDF8",
  "NYFI:TRANS-ATLANTIC_WESTBOUND": "#0EA5A4",
  "NYFI:TRANS-ATLANTIC_EASTBOUND": "#F59E0B",
};

const RANGES = [
  { id: "4w", label: "4주", days: 28 },
  { id: "12w", label: "12주", days: 84 },
  { id: "52w", label: "1년", days: 365 },
  { id: "all", label: "전체", days: 0 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

function RatesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
      <header className="mb-10 border-b border-[var(--color-line)] pb-6">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--color-navy-600)" }}
        >
          Freight Rates & Indices
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--color-ink)] lg:text-4xl">
          운임·지수 대시보드
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)]">
          글로벌 컨테이너 운임 지수와 부산발 해상 운임, 주요 항만의 벙커유 가격을
          한 화면에서 확인합니다. 모든 수치는 공개 데이터 기반이며 주 1회 업데이트됩니다.
        </p>
      </header>

      <IndicesSection />
      <NyfiSection />
      <RatesSection />
      <BunkerSection />

      <footer className="mt-16 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-muted)]">
        공개 데이터 기반 정보 제공용 자료. 출처를 확인하세요.
      </footer>
    </div>
  );
}

/* ============================== Section 1 ============================== */

function IndicesSection() {
  const { data } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const rows = ((data ?? []) as FreightIndexHistoryRow[]).filter(
    (r) => !isNyfiCode(r.index_code),
  );
  const [range, setRange] = useState<RangeId>("all");

  const filtered = useMemo(() => {
    if (range === "all") return rows;
    const days = RANGES.find((r) => r.id === range)?.days ?? 0;
    if (!days) return rows;
    const cutoff = Date.now() - days * 86400000;
    return rows.filter((r) => new Date(r.week_date).getTime() >= cutoff);
  }, [rows, range]);

  // pivot to chart data: [{ week_date, SCFI, WCI, ... }]
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of filtered) {
      if (r.value == null) continue;
      const existing = byDate.get(r.week_date) ?? { week_date: r.week_date };
      existing[r.index_code] = r.value;
      byDate.set(r.week_date, existing);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.week_date).localeCompare(String(b.week_date)),
    );
  }, [filtered]);

  // latest per code
  const latest = useMemo(() => {
    const m = new Map<string, FreightIndexHistoryRow>();
    for (const r of rows) {
      const prev = m.get(r.index_code);
      if (!prev || r.week_date > prev.week_date) m.set(r.index_code, r);
    }
    return [...m.values()].sort((a, b) =>
      a.index_code.localeCompare(b.index_code),
    );
  }, [rows]);

  const codes = Object.keys(CHART_COLORS).filter((c) =>
    chartData.some((d) => d[c] != null),
  );
  const hasTrend = chartData.length > 1;

  return (
    <section className="mb-16">
      <SectionHeader
        eyebrow="Section 1"
        title="주요 지표"
        subtitle="글로벌 컨테이너 운임 지수 (주 1회 업데이트)"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className="rounded-md border px-3 py-1 text-xs font-medium transition"
            style={
              range === r.id
                ? {
                    borderColor: "var(--color-navy-900)",
                    background: "var(--color-navy-900)",
                    color: "#fff",
                  }
                : {
                    borderColor: "var(--color-line)",
                    background: "#fff",
                    color: "var(--color-ink)",
                  }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-white p-4 lg:p-6">
        {hasTrend ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="week_date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {codes.map((c) => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stroke={CHART_COLORS[c]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--color-ink-muted)]">
            현재 단일 시점 데이터만 수집되어 추세선은 다음 업데이트부터 제공됩니다.
          </p>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-4 py-3">지수</th>
              <th className="px-4 py-3 text-right">현재값</th>
              <th className="px-4 py-3 text-right">전주 대비</th>
              <th className="px-4 py-3">기준일</th>
              <th className="px-4 py-3">출처</th>
            </tr>
          </thead>
          <tbody>
            {latest.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-ink-muted)]">
                  수집 예정
                </td>
              </tr>
            ) : (
              latest.map((r) => (
                <tr key={r.index_code} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3 font-semibold text-[var(--color-ink)]">{r.index_code}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.value)}</td>
                  <td className="px-4 py-3 text-right">
                    <ChangeChip change={r.change_pct} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-muted)]">{formatDate(r.week_date)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                    {r.source_url ? (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {r.source ?? "출처"}
                      </a>
                    ) : (
                      r.source ?? "—"
                    )}
                    <span className="ml-1">· 주 1회 업데이트</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ============================== NYFI Section ============================== */

function NyfiSection() {
  const { data } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const rows = ((data ?? []) as FreightIndexHistoryRow[]).filter((r) =>
    isNyfiCode(r.index_code),
  );
  const [range, setRange] = useState<RangeId>("all");

  const filtered = useMemo(() => {
    if (range === "all") return rows;
    const days = RANGES.find((r) => r.id === range)?.days ?? 0;
    if (!days) return rows;
    const cutoff = Date.now() - days * 86400000;
    return rows.filter((r) => new Date(r.week_date).getTime() >= cutoff);
  }, [rows, range]);

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of filtered) {
      if (r.value == null) continue;
      const existing = byDate.get(r.week_date) ?? { week_date: r.week_date };
      existing[r.index_code] = r.value;
      byDate.set(r.week_date, existing);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.week_date).localeCompare(String(b.week_date)),
    );
  }, [filtered]);

  const latest = useMemo(() => {
    const m = new Map<string, FreightIndexHistoryRow>();
    for (const r of rows) {
      const prev = m.get(r.index_code);
      if (!prev || r.week_date > prev.week_date) m.set(r.index_code, r);
    }
    return NYFI_CODES.map(
      (code) =>
        m.get(code) ?? {
          index_code: code,
          value: null,
          change_pct: null,
          week_date: "",
          source: null,
          source_url: null,
        },
    );
  }, [rows]);

  const activeCodes = NYFI_CODES.filter((c) =>
    chartData.some((d) => d[c] != null),
  );
  const hasTrend = chartData.length > 1;

  return (
    <section className="mb-16">
      <SectionHeader
        eyebrow="NYFI"
        title="NYSHEX NYFI 노선별 지수"
        subtitle="아시아·미주·유럽·대서양 주요 노선의 컨테이너 운임 지수"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className="rounded-md border px-3 py-1 text-xs font-medium transition"
            style={
              range === r.id
                ? {
                    borderColor: "var(--color-navy-900)",
                    background: "var(--color-navy-900)",
                    color: "#fff",
                  }
                : {
                    borderColor: "var(--color-line)",
                    background: "#fff",
                    color: "var(--color-ink)",
                  }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-white p-4 lg:p-6">
        {hasTrend ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="week_date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) => indexDisplayLabel(String(v))}
                />
                {activeCodes.map((c) => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    name={c}
                    stroke={NYFI_COLORS[c]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--color-ink-muted)]">
            추세선은 데이터 누적 후 제공됩니다.
          </p>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-4 py-3">노선</th>
              <th className="px-4 py-3 text-right">현재값 (USD)</th>
              <th className="px-4 py-3 text-right">전주 대비</th>
              <th className="px-4 py-3">기준일</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((r) => (
              <tr key={r.index_code} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-3 font-semibold text-[var(--color-ink)]">
                  {NYFI_LANE_LABELS[r.index_code] ?? r.index_code}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.value != null ? `$${formatNumber(r.value, 0)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <ChangeChip change={r.change_pct} />
                </td>
                <td className="px-4 py-3 text-[var(--color-ink-muted)]">
                  {r.week_date ? formatDate(r.week_date) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
        출처: NYSHEX NYFI · 주 1회 갱신
      </p>
    </section>
  );
}

/* ============================== Section 2 ============================== */

function RatesSection() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/rates" });
  const { data: opts } = useSuspenseQuery(rateFilterOptionsQueryOptions());
  const { data: rates } = useSuspenseQuery(
    freightRatesQueryOptions({
      polCode: search.pol,
      podCode: search.pod,
      containerType: search.ctype,
    }),
  );
  const rows = (rates ?? []) as FreightRateRow[];

  const update = (patch: Partial<Search>) =>
    navigate({
      search: (prev: Search) => ({ ...prev, ...patch }),
      replace: true,
    });

  // detect multiple snapshots per (carrier+route) for trend chart
  const trendData = useMemo(() => {
    if (!search.pol || !search.pod || !search.ctype) return [];
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const dateKey = r.source_updated_at?.slice(0, 10) ?? r.valid_from ?? "";
      if (!dateKey || r.rate_usd == null || !r.carrier) continue;
      const existing = byDate.get(dateKey) ?? { date: dateKey };
      existing[r.carrier] = r.rate_usd;
      byDate.set(dateKey, existing);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [rows, search.pol, search.pod, search.ctype]);
  const hasTrend = trendData.length > 1;

  return (
    <section className="mb-16">
      <SectionHeader
        eyebrow="Section 2"
        title="해상 운임 추이"
        subtitle="data.go.kr 화물운임공표 기반 부산발 컨테이너 운임"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          label="출발항 (POL)"
          value={search.pol ?? ""}
          onChange={(v) => update({ pol: v || undefined })}
          options={opts.pols.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
        />
        <Select
          label="도착항 (POD)"
          value={search.pod ?? ""}
          onChange={(v) => update({ pod: v || undefined })}
          options={opts.pods.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
        />
        <Select
          label="컨테이너"
          value={search.ctype ?? ""}
          onChange={(v) => update({ ctype: v || undefined })}
          options={opts.containerTypes.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {hasTrend && (
        <div className="mb-4 rounded-lg border border-[var(--color-line)] bg-white p-4 lg:p-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {Object.keys(trendData[0])
                  .filter((k) => k !== "date")
                  .slice(0, 8)
                  .map((carrier, i) => (
                    <Line
                      key={carrier}
                      type="monotone"
                      dataKey={carrier}
                      stroke={Object.values(CHART_COLORS)[i % 5]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-4 py-3">선사</th>
              <th className="px-4 py-3">노선</th>
              <th className="px-4 py-3">박스</th>
              <th className="px-4 py-3 text-right">운임</th>
              <th className="px-4 py-3 text-right">주간 변동</th>
              <th className="px-4 py-3 text-right">소요일</th>
              <th className="px-4 py-3">유효기간</th>
              <th className="px-4 py-3">출처</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--color-ink-muted)]">
                  조건에 맞는 운임 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-ink)]">{r.carrier ?? "—"}</span>
                      {r.is_partner_rate && (
                        <span
                          className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: "var(--color-cyan)", color: "var(--color-navy-900)" }}
                        >
                          Partner
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                    {r.pol_name ?? r.pol_code} → {r.pod_name ?? r.pod_code}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.container_type}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {r.rate_usd != null ? `${formatNumber(r.rate_usd, 0)} ${r.currency ?? "USD"}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChangeChip change={r.weekly_change_pct} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {r.transit_days != null ? `${r.transit_days}일` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                    {formatDate(r.valid_until)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                    {r.data_source}
                    <span className="ml-1">· 주 1회 업데이트</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
        본 서비스는 공개 데이터 기반 참고 자료입니다. 실제 운임은 별도 확인 후 이용해 주세요.
      </p>
    </section>
  );
}

/* ============================== Section 3 ============================== */

function BunkerSection() {
  const { data } = useSuspenseQuery(bunkerPricesQueryOptions());
  const rows = data ?? [];

  return (
    <section>
      <SectionHeader
        eyebrow="Section 3"
        title="벙커유 가격"
        subtitle="주요 항만 선박연료유 가격 (Ship & Bunker)"
      />
      <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-4 py-3">항만</th>
              <th className="px-4 py-3">유종</th>
              <th className="px-4 py-3 text-right">가격 (USD/MT)</th>
              <th className="px-4 py-3">관측일</th>
              <th className="px-4 py-3">출처</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-ink-muted)]">
                  수집 예정
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.port}-${r.grade}`} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{r.port}</td>
                  <td className="px-4 py-3">{r.grade}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.price_usd, 0)}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-muted)]">{formatDate(r.obs_date)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                    {r.source_url ? (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {r.source}
                      </a>
                    ) : (
                      r.source
                    )}
                    <span className="ml-1">· 주 1회 업데이트</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ============================== UI helpers ============================== */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--color-navy-600)" }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold text-[var(--color-ink)] lg:text-2xl">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
      )}
    </div>
  );
}

function ChangeChip({ change }: { change: number | null | undefined }) {
  if (change == null)
    return <span className="text-xs text-[var(--color-ink-muted)]">—</span>;
  const pos = change >= 0;
  return (
    <span
      className="text-xs font-semibold tabular-nums"
      style={{ color: pos ? "var(--color-success)" : "var(--color-danger)" }}
    >
      {pos ? "+" : ""}
      {change.toFixed(2)}%
    </span>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-ink-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-[var(--color-line)] bg-white px-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-600)]"
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}