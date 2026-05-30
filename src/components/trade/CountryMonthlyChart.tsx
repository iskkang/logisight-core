import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import type { TradeCountryRow } from "@/lib/api/trade";

const MINT = "#14b8a6";
const MINT_DEEP = "#0d9488";
const SLATE = "#64748b";
const NAVY = "#0F2D5A";

type TabKey = "CN" | "US" | "EU" | "VN" | "JP";
const TABS: { key: TabKey; label: string }[] = [
  { key: "CN", label: "중국" },
  { key: "US", label: "미국" },
  { key: "EU", label: "EU" },
  { key: "VN", label: "베트남" },
  { key: "JP", label: "일본" },
];

// EU 27 member country codes
const EU_MEMBERS = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

type MonthlyPoint = {
  period: string; // YYYY-MM
  label: string; // "Jan 25"
  export_b: number;
  import_b: number;
  balance_b: number;
  total_export_b: number;
  total_import_b: number;
};

function periodLabel(p: string): string {
  // p = "YYYY-MM"
  const [y, m] = p.split("-");
  if (!y || !m) return p;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return p;
  return `${months[idx]} ${y.slice(2)}`;
}

function buildSeries(rows: TradeCountryRow[], tab: TabKey): MonthlyPoint[] {
  if (!rows || rows.length === 0) return [];

  // Group by period
  const periodSet = new Set<string>();
  rows.forEach((r) => r.period && periodSet.add(r.period));
  const periods = Array.from(periodSet).sort().slice(-13); // last 13

  return periods.map((p) => {
    const inPeriod = rows.filter((r) => r.period === p);
    const totalExp = inPeriod.reduce((s, r) => s + (r.export_usd ?? 0), 0);
    const totalImp = inPeriod.reduce((s, r) => s + (r.import_usd ?? 0), 0);

    const matches = inPeriod.filter((r) => {
      if (!r.country_code) return false;
      if (tab === "EU") return EU_MEMBERS.has(r.country_code);
      return r.country_code === tab;
    });
    const exp = matches.reduce((s, r) => s + (r.export_usd ?? 0), 0);
    const imp = matches.reduce((s, r) => s + (r.import_usd ?? 0), 0);

    return {
      period: p,
      label: periodLabel(p),
      export_b: +(exp / 1e9).toFixed(2),
      import_b: +(imp / 1e9).toFixed(2),
      balance_b: +((exp - imp) / 1e9).toFixed(2),
      total_export_b: +(totalExp / 1e9).toFixed(2),
      total_import_b: +(totalImp / 1e9).toFixed(2),
    };
  });
}

function buildInsight(series: MonthlyPoint[], tabLabel: string): string | null {
  if (series.length === 0) return null;
  const last3 = series.slice(-3);
  if (last3.length === 0) return null;
  const avg = last3.reduce((s, p) => s + p.export_b, 0) / last3.length;
  if (!Number.isFinite(avg) || avg === 0) return null;

  // YoY: compare last month vs same month 1 year prior (12 entries back)
  let yoy: number | null = null;
  if (series.length >= 13) {
    const last = series[series.length - 1];
    const prevYear = series[series.length - 13];
    if (prevYear && prevYear.export_b > 0) {
      yoy = ((last.export_b - prevYear.export_b) / prevYear.export_b) * 100;
    }
  }

  const avgStr = `$${avg.toFixed(1)}B`;
  if (yoy == null) {
    return `최근 ${last3.length}개월 ${tabLabel}향 수출 월평균 ${avgStr}`;
  }
  const dir = yoy >= 0 ? "상승세" : "하락세";
  const sign = yoy >= 0 ? "+" : "";
  return `최근 ${last3.length}개월 ${tabLabel}향 수출 월평균 ${avgStr}, 전년 동기 대비 ${sign}${yoy.toFixed(1)}% ${dir}`;
}

export function CountryMonthlyChart({ rows }: { rows: TradeCountryRow[] }) {
  const [tab, setTab] = useState<TabKey>("CN");
  const series = useMemo(() => buildSeries(rows, tab), [rows, tab]);
  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? tab;
  const insight = useMemo(() => buildInsight(series, tabLabel), [series, tabLabel]);
  const hasCountryData = series.some(
    (p) => (p.export_b ?? 0) > 0 || (p.import_b ?? 0) > 0,
  );

  return (
    <section className="mt-10 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-navy-900)]">
            국가별 월간 추세
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            최근 13개월 수출입 추이 · 단위 $B
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-md border border-slate-200 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "rounded px-3 py-1.5 text-sm font-medium transition-colors " +
                (tab === t.key
                  ? "bg-[var(--color-navy-900)] text-white"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {series.length === 0 || !hasCountryData ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-slate-600">
              데이터 수집 중입니다
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {tabLabel} 관련 월간 통계가 아직 수집되지 않았습니다.
            </p>
          </div>
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={series}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}B`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    content={<CountryTooltip tabLabel={tabLabel} />}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => (v === "export_b" ? "수출" : "수입")}
                  />
                  <Bar dataKey="export_b" name="export_b" fill={MINT} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="import_b" name="import_b" fill={SLATE} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold text-slate-600">
                전체 수출입 합계 추이
              </p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={series}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}B`}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        `$${v.toFixed(1)}B`,
                        name === "total_export_b" ? "총 수출" : "총 수입",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_export_b"
                      stroke={MINT_DEEP}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_import_b"
                      stroke={NAVY}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {insight && (
              <div className="mt-5 rounded-md border border-teal-100 bg-[#f0fdfa] p-3 text-xs text-teal-900">
                💡 {insight}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CountryTooltip({
  active,
  payload,
  label,
  tabLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyPoint }>;
  label?: string;
  tabLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-md">
      <div className="font-bold text-slate-800">{label} · {tabLabel}</div>
      <div className="mt-1 space-y-0.5 tabular-nums">
        <div>
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: MINT }} />
          <span className="ml-1.5 text-slate-600">수출</span>
          <span className="ml-2 font-semibold">${p.export_b.toFixed(2)}B</span>
        </div>
        <div>
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: SLATE }} />
          <span className="ml-1.5 text-slate-600">수입</span>
          <span className="ml-2 font-semibold">${p.import_b.toFixed(2)}B</span>
        </div>
        <div className="border-t border-slate-100 pt-0.5">
          <span className="text-slate-600">무역수지</span>
          <span
            className={
              "ml-2 font-semibold " +
              (p.balance_b >= 0 ? "text-teal-700" : "text-amber-600")
            }
          >
            {p.balance_b >= 0 ? "+" : ""}${p.balance_b.toFixed(2)}B
          </span>
        </div>
      </div>
    </div>
  );
}