import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, FileText } from "lucide-react";
import {
  inMonthRange,
  monthBounds,
  regionsOf,
  portsOf,
  routeSeries,
  regionPortsLatest,
  topPorts,
  heatmapMoM,
  type PortLatest,
} from "@/lib/rates-search";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHero } from "@/components/site/PageHero";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";
import {
  Collecting,
  DeltaValue,
  FilterSeg,
  Panel,
  PBadge,
  PCard,
  tdStyle,
  thStyle,
} from "@/components/proto/Kit";
import { publishedForecastsQueryOptions } from "@/lib/api/forecasts";
import {
  recentRateReports,
  SERIES_LABEL,
  type RateReport,
} from "@/components/forecasts/forecastUtils";
import {
  bunkerPricesQueryOptions,
  freightIndicesHistoryQueryOptions,
  kitaAirRatesQueryOptions,
  kitaSeaRatesQueryOptions,
  type KitaAirRateRow,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import { publishedPartnerRatesQueryOptions } from "@/lib/api/partner-rates";

export const Route = createFileRoute("/rates")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions()),
      context.queryClient.ensureQueryData(bunkerPricesQueryOptions()),
      context.queryClient.ensureQueryData(kitaAirRatesQueryOptions()),
      context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions()),
      context.queryClient.ensureQueryData(latestExchangeRateQueryOptions()),
      context.queryClient.ensureQueryData(publishedForecastsQueryOptions()),
      context.queryClient.ensureQueryData(publishedPartnerRatesQueryOptions()),
    ]);
  },
  pendingMs: 0,
  pendingComponent: RatesPending,
  head: () => ({
    meta: [
      { title: "운임 조회 - Logisight" },
      {
        name: "description",
        content:
          "저장된 KCCI, SCFI, KITA 해상·항공 운임 데이터를 기반으로 글로벌 운임 동향을 조회합니다.",
      },
    ],
  }),
  component: RatesPage,
});

type Mode2 = "sea" | "air";
const ORIGIN_BY_MODE: Record<Mode2, string> = { sea: "부산", air: "인천" };
const ALL_PORTS = "__all__"; // 도착지 "전체(권역)"
const REGION_MULTILINE_CAP = 8; // 권역 멀티라인 상위 N
const CMP_LINE_COLORS = [
  "var(--navy-600)", "var(--cyan)", "var(--status-caution)", "var(--status-normal)",
  "var(--status-alert)", "oklch(0.55 0.18 300)", "var(--status-observe)", "oklch(0.65 0.15 130)",
];

const INDEX_COLORS: Record<string, string> = {
  KCCI: "#079455",
  SCFI: "#2563eb",
  BDI: "#f97316",
  WCI: "#8b5cf6",
  CCFI: "#0891b2",
};

function RatesPending() {
  return (
    <main className="flex min-h-[62vh] items-center justify-center bg-[#edf3fb] px-4 text-slate-900">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-[#d8e3ef] bg-white px-8 py-7 shadow-[0_10px_28px_rgba(15,35,65,0.08)]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-black tracking-normal text-slate-800">Loading</p>
      </div>
    </main>
  );
}

function fmtNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function fmtPct(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtMonth(value: string | null | undefined) {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
}

function RatesPage() {
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: bunker } = useSuspenseQuery(bunkerPricesQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: exchangeRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: partnerRates } = useSuspenseQuery(publishedPartnerRatesQueryOptions());

  const [mode, setMode] = useState<Mode2>("sea");
  const [region, setRegion] = useState<string>("");
  const [port, setPort] = useState<string>(ALL_PORTS);
  const [metric, setMetric] = useState<"feu" | "teu">("feu");

  const activeRows = mode === "sea" ? seaRates : airRates;
  const valueOf = (r: KitaSeaRateRow | KitaAirRateRow): number | null =>
    mode === "sea"
      ? metric === "feu"
        ? (r as KitaSeaRateRow).feu
        : (r as KitaSeaRateRow).teu
      : (r as KitaAirRateRow).kg300;

  const bounds = useMemo(() => monthBounds(activeRows), [activeRows]);
  const [startYM, setStartYM] = useState<string>("");
  const [endYM, setEndYM] = useState<string>("");

  // 기본값: 권역=북미(없으면 첫 권역), 기간=최신 13개월
  const regions = useMemo(() => regionsOf(activeRows), [activeRows]);
  useEffect(() => {
    if (!regions.length) return;
    setRegion((r) => (regions.includes(r) ? r : regions.includes("북미") ? "북미" : regions[0]));
  }, [regions]);
  useEffect(() => {
    if (!bounds) return;
    const max = bounds.max;
    const y = Number(max.slice(0, 4));
    const m = Number(max.slice(4, 6));
    const d = new Date(Date.UTC(y, m - 1 - 12, 1));
    const start = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    setEndYM(max);
    setStartYM(start < bounds.min ? bounds.min : start);
  }, [bounds]);

  const scoped = useMemo(
    () => (startYM && endYM ? inMonthRange(activeRows, startYM, endYM) : activeRows),
    [activeRows, startYM, endYM],
  );
  const ports = useMemo(() => portsOf(scoped, region), [scoped, region]);
  const portSelected = port !== ALL_PORTS && ports.includes(port);

  // 차트 라인 대상: 항만 선택 → 그 항만 1개 / 권역만 → 상위 N 항만
  const regionLatest = useMemo(
    () => regionPortsLatest(scoped, region, valueOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, region, metric, mode],
  );
  const chartPorts = useMemo(
    () => (portSelected ? [port] : topPorts(regionLatest, REGION_MULTILINE_CAP)),
    [portSelected, port, regionLatest],
  );
  const chartData = useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string>>();
    for (const p of chartPorts) {
      for (const pt of routeSeries(scoped, p, valueOf)) {
        const row = byMonth.get(pt.ym) ?? { month: pt.ym };
        row[p] = pt.value;
        byMonth.set(pt.ym, row);
      }
    }
    return [...byMonth.values()]
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((r) => ({ ...r, label: fmtMonth(String(r.month)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPorts, scoped, metric, mode]);

  // 전월대비 변동률 히트맵 — 검색 노선(chartPorts)에 연동, 최근 6개월 실측 MoM
  const heatmap = useMemo(
    () => heatmapMoM(scoped, chartPorts, valueOf, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, chartPorts, metric, mode],
  );

  // 글로벌 지수 추이 — 최신 주 기준 최근 6개월, week_date로 정렬(연말 버킷 오류 방지)
  const trendData = useMemo(() => {
    const codes = ["SCFI", "KCCI", "BDI", "WCI"];
    const rows = history.filter((item) => codes.includes(item.index_code) && item.value != null);
    const latest = rows
      .map((row) => row.week_date)
      .sort()
      .at(-1);
    if (!latest) return [];
    const cutoff = new Date(latest);
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const byDate = new Map<string, Record<string, number | string>>();
    for (const row of rows) {
      if (row.week_date < cutoffIso) continue;
      const point = byDate.get(row.week_date) ?? {
        label: row.week_date.slice(5, 10),
        date: row.week_date,
      };
      point[row.index_code] = row.value ?? 0;
      byDate.set(row.week_date, point);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [history]);

  const ratesReports = recentRateReports(forecasts);
  const latestBunker = bunker.at(0);

  const fxDate = exchangeRate?.rate_date?.slice(0, 10) ?? null;

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <PageHero
        eyebrow="Rates Control Tower"
        titleMain="운임"
        titleAccent="Control Tower"
        subtitle="저장된 KITA 운임과 글로벌 지수를 기준으로 해상·항공 운임 동향을 한눈에 확인합니다."
        chips={[
          { label: "기준월", value: fmtMonth(bounds?.max ?? null), color: "var(--color-cyan)" },
          {
            label: "권역",
            value: `${regions.length}개`,
            color: "var(--color-status-normal)",
          },
        ]}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1540px] flex-col gap-4 px-4 py-[26px] lg:px-12">
        <RouteBreadcrumb />
        <RateSearchBar
          mode={mode} setMode={(m) => { setMode(m); setPort(ALL_PORTS); }}
          origin={ORIGIN_BY_MODE[mode]}
          region={region} setRegion={(r) => { setRegion(r); setPort(ALL_PORTS); }} regions={regions}
          port={port} setPort={setPort} ports={ports}
          bounds={bounds} startYM={startYM} endYM={endYM} setStartYM={setStartYM} setEndYM={setEndYM}
          onReset={() => {
            setMode("sea"); setMetric("feu"); setPort(ALL_PORTS);
            setRegion(regions.includes("북미") ? "북미" : regions[0] ?? "");
            if (bounds) { setEndYM(bounds.max); const y = Number(bounds.max.slice(0, 4)); const mo = Number(bounds.max.slice(4, 6)); const d = new Date(Date.UTC(y, mo - 1 - 12, 1)); const s = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; setStartYM(s < bounds.min ? bounds.min : s); }
          }}
        />

        <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
          <RateResultChart
            title={portSelected ? `운임 추이 — ${ORIGIN_BY_MODE[mode]} → ${port}` : `권역별 운임 추이 — ${region}`}
            mode={mode} metric={metric} setMetric={setMetric} lines={chartPorts} data={chartData}
          />
          <Panel title="전월대비 변동률 히트맵" badge={<PBadge variant="secondary">{mode === "sea" ? "해상" : "항공"} · 최근 {heatmap.months.length}개월</PBadge>}>
            {heatmap.rows.length === 0 || heatmap.months.length < 2 ? (
              <Collecting note="월별 MoM 산출에 필요한 시계열이 확보되면 표시됩니다." />
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `120px repeat(${heatmap.months.length}, 1fr)`,
                    gap: 4,
                    fontSize: 11,
                  }}
                >
                  <span />
                  {heatmap.months.map((month) => (
                    <span
                      key={month}
                      style={{
                        textAlign: "center",
                        color: "var(--ink-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {fmtMonth(month)}
                    </span>
                  ))}
                  {heatmap.rows.map((row) => (
                    <HeatmapRow
                      key={row.dest}
                      row={{ label: `${ORIGIN_BY_MODE[mode]} → ${row.dest}`, cells: row.cells }}
                    />
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-muted)" }}>
                  상승=녹 · 하락=적. 데이터 없는 달은 — 로 표시됩니다.
                </div>
              </>
            )}
          </Panel>
        </div>

        <RateResultTable
          mode={mode} origin={ORIGIN_BY_MODE[mode]} region={region}
          portSelected={portSelected} port={port}
          rows={scoped as KitaSeaRateRow[] | KitaAirRateRow[]} regionLatest={regionLatest}
        />

        <PartnerRatesPanel rows={partnerRates as PartnerRateRow[]} />

        <div className="grid items-start gap-4 xl:grid-cols-[1.16fr_1.5fr]">
          <Panel
            title="글로벌 지수 추이"
            badge={<PBadge variant="secondary">SCFI · KCCI · BDI · WCI</PBadge>}
          >
            {trendData.length < 2 ? (
              <Collecting />
            ) : (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {["SCFI", "KCCI", "BDI", "WCI"].map((code) => (
                      <Line
                        key={code}
                        type="monotone"
                        dataKey={code}
                        stroke={INDEX_COLORS[code]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
          <Panel title="최근 리포트" badge={<PBadge variant="outline">운임 전망</PBadge>}>
            <ReportCards reports={ratesReports} bunkerLabel={latestBunker?.grade ?? null} />
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-alt)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-muted)",
              }}
            >
              환율 기준 USD/KRW {fmtNumber(exchangeRate?.usd_krw, 2)} · {fxDate ?? "-"}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

// ── Task 3: Search bar ────────────────────────────────────────────────────────

function Sel({ value, onChange, items, width }: {
  value: string; onChange: (v: string) => void; items: { v: string; label: string }[]; width?: number;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ height: 32, width, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", padding: "0 8px", fontSize: 12.5, color: "var(--ink)" }}
    >
      {items.map((it) => <option key={it.v} value={it.v}>{it.label}</option>)}
    </select>
  );
}

function ymItems(bounds: { min: string; max: string } | null, part: "y" | "m") {
  if (!bounds) return [] as { v: string; label: string }[];
  if (part === "y") {
    const y0 = Number(bounds.min.slice(0, 4)), y1 = Number(bounds.max.slice(0, 4));
    return Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ v: String(y0 + i), label: `${y0 + i}년` }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1).padStart(2, "0"), label: `${i + 1}월` }));
}

function RateSearchBar(props: {
  mode: Mode2; setMode: (m: Mode2) => void;
  origin: string;
  region: string; setRegion: (r: string) => void; regions: string[];
  port: string; setPort: (p: string) => void; ports: string[];
  bounds: { min: string; max: string } | null;
  startYM: string; endYM: string; setStartYM: (s: string) => void; setEndYM: (s: string) => void;
  onReset: () => void;
}) {
  const sy = props.startYM.slice(0, 4), sm = props.startYM.slice(4, 6);
  const ey = props.endYM.slice(0, 4), em = props.endYM.slice(4, 6);
  const setStart = (y: string, m: string) => props.setStartYM(`${y}${m}`);
  const setEnd = (y: string, m: string) => props.setEndYM(`${y}${m}`);
  return (
    <PCard pad="md">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "var(--ink-muted)" }}>
        <FilterSeg label="분류" options={["해상", "항공"] as const} value={props.mode === "sea" ? "해상" : "항공"} onChange={(v) => props.setMode(v === "해상" ? "sea" : "air")} />
        <span>출발지</span><Sel value={props.origin} onChange={() => {}} items={[{ v: props.origin, label: props.origin }]} width={86} />
        <span>도착지</span>
        <Sel value={props.region} onChange={props.setRegion} items={props.regions.map((r) => ({ v: r, label: r }))} width={110} />
        <Sel value={props.port} onChange={props.setPort} items={[{ v: ALL_PORTS, label: "전체(권역)" }, ...props.ports.map((p) => ({ v: p, label: p }))]} width={130} />
        <span style={{ marginLeft: 6 }}>기간</span>
        <Sel value={sy} onChange={(y) => setStart(y, sm)} items={ymItems(props.bounds, "y")} width={84} />
        <Sel value={sm} onChange={(m) => setStart(sy, m)} items={ymItems(props.bounds, "m")} width={68} />
        <span>~</span>
        <Sel value={ey} onChange={(y) => setEnd(y, em)} items={ymItems(props.bounds, "y")} width={84} />
        <Sel value={em} onChange={(m) => setEnd(ey, m)} items={ymItems(props.bounds, "m")} width={68} />
        <button type="button" onClick={props.onReset}
          style={{ marginLeft: "auto", height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer" }}>
          초기화
        </button>
      </div>
    </PCard>
  );
}

// ── Task 4: Result chart + result table ───────────────────────────────────────

function RateResultChart(props: {
  title: string; mode: Mode2; metric: "feu" | "teu"; setMetric: (m: "feu" | "teu") => void;
  lines: string[]; data: Record<string, number | string>[];
}) {
  const cur = props.mode === "sea" ? "$" : "₩";
  const unit = props.mode === "sea" ? (props.metric === "feu" ? "$/FEU" : "$/TEU") : "₩/kg (kg300)";
  return (
    <Panel
      title={props.title}
      badge={<PBadge variant="secondary">{props.mode === "sea" ? "해상" : "항공"} · {unit}</PBadge>}
      action={props.mode === "sea" ? (
        <div style={{ display: "inline-flex", gap: 4 }}>
          {(["feu", "teu"] as const).map((m) => (
            <button key={m} type="button" onClick={() => props.setMetric(m)}
              style={{ height: 26, padding: "0 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                border: "1px solid var(--border)", background: props.metric === m ? "var(--navy-600)" : "var(--card)",
                color: props.metric === m ? "#fff" : "var(--ink-muted)" }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}
    >
      {props.data.length < 2 || props.lines.length === 0 ? (
        <Collecting note="선택 조건의 시계열이 2개월 이상 확보되면 표시됩니다." />
      ) : (
        <>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={props.data} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} width={52}
                  tickFormatter={(v: number) => `${cur}${Math.round(v).toLocaleString()}`} />
                <Tooltip formatter={(v: number) => `${cur}${Math.round(v).toLocaleString()}`}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                {props.lines.map((p, i) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={CMP_LINE_COLORS[i % CMP_LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11.5, color: "var(--ink-muted)" }}>
            {props.lines.map((p, i) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: CMP_LINE_COLORS[i % CMP_LINE_COLORS.length] }} />
                {p}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function RateResultTable(props: {
  mode: Mode2; origin: string; region: string; portSelected: boolean; port: string;
  rows: KitaSeaRateRow[] | KitaAirRateRow[]; regionLatest: PortLatest[];
}) {
  const isSea = props.mode === "sea";
  return (
    <Panel title="세부 운임 동향" badge={<PBadge variant="secondary">{props.portSelected ? `${props.origin} → ${props.port}` : `${props.region} 권역`}</PBadge>} bodyPad={0}>
      <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr>
              <th style={thStyle()}>{props.portSelected ? "년·월" : "노선"}</th>
              {isSea
                ? (<><th style={thStyle("right")}>TEU</th><th style={thStyle("right")}>FEU</th></>)
                : (<><th style={thStyle("right")}>kg100</th><th style={thStyle("right")}>kg300</th><th style={thStyle("right")}>kg500</th></>)}
              {!props.portSelected && <th style={thStyle("right")}>전월대비</th>}
            </tr>
          </thead>
          <tbody>
            {props.portSelected
              ? [...props.rows]
                  .filter((r) => r.dest === props.port)
                  .sort((a, b) => String(b.year_mon).localeCompare(String(a.year_mon)))
                  .map((r) => (
                    <tr key={r.year_mon} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...tdStyle(), fontWeight: 600 }}>{fmtMonth(r.year_mon)}</td>
                      {isSea
                        ? (<><td style={tdStyle("right")}>{fmtNumber((r as KitaSeaRateRow).teu)}</td><td style={tdStyle("right")}>{fmtNumber((r as KitaSeaRateRow).feu)}</td></>)
                        : (<><td style={tdStyle("right")}>{fmtNumber((r as KitaAirRateRow).kg100, 2)}</td><td style={tdStyle("right")}>{fmtNumber((r as KitaAirRateRow).kg300, 2)}</td><td style={tdStyle("right")}>{fmtNumber((r as KitaAirRateRow).kg500, 2)}</td></>)}
                    </tr>
                  ))
              : props.regionLatest.map((p) => {
                  const row = props.rows.find((r) => r.dest === p.dest && String(r.year_mon).replace(/\D/g, "").slice(0, 6) === p.ym);
                  return (
                    <tr key={p.dest} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...tdStyle(), fontWeight: 600 }}>{props.origin} → {p.dest}<div style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 500 }}>{fmtMonth(p.ym)}</div></td>
                      {isSea
                        ? (<><td style={tdStyle("right")}>{fmtNumber((row as KitaSeaRateRow | undefined)?.teu)}</td><td style={tdStyle("right")}>{fmtNumber((row as KitaSeaRateRow | undefined)?.feu)}</td></>)
                        : (<><td style={tdStyle("right")}>{fmtNumber((row as KitaAirRateRow | undefined)?.kg100, 2)}</td><td style={tdStyle("right")}>{fmtNumber((row as KitaAirRateRow | undefined)?.kg300, 2)}</td><td style={tdStyle("right")}>{fmtNumber((row as KitaAirRateRow | undefined)?.kg500, 2)}</td></>)}
                      <td style={tdStyle("right")}><span style={{ display: "inline-flex", justifyContent: "flex-end" }}><DeltaValue value={p.mom} size={12} /></span></td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {(props.portSelected ? props.rows.filter((r) => r.dest === props.port).length : props.regionLatest.length) === 0 && (
          <div style={{ padding: 18 }}><Collecting note="검색 결과가 없습니다." /></div>
        )}
      </div>
    </Panel>
  );
}

function heatColor(value: number) {
  const intensity = Math.min(85, 22 + Math.abs(value) * 2.4);
  return value >= 0
    ? `color-mix(in oklch, var(--direction-up) ${intensity}%, var(--card))`
    : `color-mix(in oklch, var(--direction-down) ${intensity}%, var(--card))`;
}

function HeatmapRow({ row }: { row: { label: string; cells: (number | null)[] } }) {
  return (
    <>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          color: "var(--ink)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.label}
      >
        {row.label}
      </span>
      {row.cells.map((cell, index) => (
        <span
          key={index}
          title={cell == null ? "데이터 없음" : fmtPct(cell)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 32,
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            fontWeight: 600,
            color: cell != null && Math.abs(cell) >= 18 ? "#fff" : "var(--ink)",
            background: cell == null ? "var(--surface-alt)" : heatColor(cell),
          }}
        >
          {cell == null ? "—" : fmtPct(cell, 0)}
        </span>
      ))}
    </>
  );
}

function ReportCards({
  reports,
  bunkerLabel,
}: {
  reports: RateReport[];
  bunkerLabel: string | null;
}) {
  if (reports.length === 0) {
    return (
      <div>
        <EmptyState>발행된 운임 전망 리포트가 아직 없습니다.</EmptyState>
        {bunkerLabel ? (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--ink-muted)",
            }}
          >
            최신 유가 데이터: {bunkerLabel}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}

function ReportCard({ report }: { report: RateReport }) {
  const [open, setOpen] = useState(false);
  const hasOutlook = report.outlook.trim().length > 0;
  const chip = report.indexCode ? SERIES_LABEL[report.indexCode] : null;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => hasOutlook && setOpen((value) => !value)}
        aria-expanded={hasOutlook ? open : undefined}
        disabled={!hasOutlook}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          border: "none",
          background: "transparent",
          padding: "12px 14px",
          cursor: hasOutlook ? "pointer" : "default",
          font: "inherit",
          color: "inherit",
          touchAction: "manipulation",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={15} color="var(--ink-muted)" style={{ flex: "none" }} />
          <span
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {report.title}
          </span>
          {chip ? (
            <PBadge variant="secondary" style={{ flex: "none" }}>
              {chip}
            </PBadge>
          ) : null}
          <span
            style={{
              flex: "none",
              fontSize: 11.5,
              color: "var(--ink-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {report.date}
          </span>
          {hasOutlook ? (
            <ChevronDown
              size={16}
              color="var(--ink-muted)"
              style={{
                flex: "none",
                transition: "transform 0.18s ease",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          ) : null}
        </div>
        {report.lead ? (
          <p
            style={{
              margin: "6px 0 0 23px",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--ink-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {report.lead}
          </p>
        ) : null}
      </button>
      {open && hasOutlook ? (
        <div
          style={{
            padding: "0 14px 12px 37px",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--ink)",
          }}
        >
          {report.outlook}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: 120,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "1px dashed var(--border)",
        background: "var(--surface-alt)",
        padding: "0 16px",
        textAlign: "center",
        fontSize: 13,
        color: "var(--ink-muted)",
      }}
    >
      {children}
    </div>
  );
}

// 선사별 실시간 운임 — 업로드·발행된 실측 파트너 운임(getPublishedPartnerRates)
type PartnerRateRow = {
  id: string;
  pol: string | null;
  pod: string | null;
  carrier: string | null;
  rate_20: number | null;
  rate_40: number | null;
  sheet?: { source: string | null; valid_until: string | null } | null;
};

function PartnerRatesPanel({ rows }: { rows: PartnerRateRow[] }) {
  return (
    <Panel
      title="선사별 실시간 운임"
      badge={<PBadge variant="secondary">실측 · 파트너</PBadge>}
      bodyPad={0}
    >
      {rows.length === 0 ? (
        <div style={{ padding: 18 }}>
          <Collecting note="업로드·발행된 실측 운임이 아직 없습니다. (/admin/partner-rates 에서 업로드)" />
        </div>
      ) : (
        <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr>
                <th style={thStyle()}>노선</th>
                <th style={thStyle()}>선사</th>
                <th style={thStyle("right")}>20&apos;</th>
                <th style={thStyle("right")}>40&apos;/HQ</th>
                <th style={thStyle()}>VALID UNTIL</th>
                <th style={thStyle()}>출처</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...tdStyle(), fontWeight: 600 }}>
                    {(r.pol ?? "-")} → {(r.pod ?? "-")}
                  </td>
                  <td style={tdStyle()}>{r.carrier ?? "-"}</td>
                  <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                    {r.rate_20 != null ? `$${fmtNumber(r.rate_20)}` : "-"}
                  </td>
                  <td style={{ ...tdStyle("right"), fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                    {r.rate_40 != null ? `$${fmtNumber(r.rate_40)}` : "-"}
                  </td>
                  <td style={{ ...tdStyle(), whiteSpace: "nowrap", color: "var(--ink-muted)" }}>
                    {r.sheet?.valid_until ? `~ ${r.sheet.valid_until}` : "-"}
                  </td>
                  <td style={{ ...tdStyle(), color: "var(--ink-muted)" }}>{r.sheet?.source ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
