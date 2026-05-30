import { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { scaleSequentialLog } from "d3-scale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ISO2_TO_NUMERIC, flagEmoji } from "@/lib/iso-country-codes";
import { formatUSD } from "@/lib/api/trade";
import type { TradeCountryRow } from "@/lib/api/trade";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Tab = "export" | "import";

export type CountryAgg = {
  iso2: string;
  numeric: string;
  name: string;
  export_usd: number;
  import_usd: number;
  balance: number;
};

type Props = {
  rows: TradeCountryRow[];
  tab: Tab;
  onTabChange: (t: Tab) => void;
  period: string | null;
};

function periodLabel(p: string): string {
  const [y, m] = p.split("-");
  if (!y || !m) return p;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${y.slice(2)}`;
}

function yoyPeriodOf(p: string): string {
  const [y, m] = p.split("-");
  if (!y || !m) return p;
  return `${Number(y) - 1}-${m}`;
}

export function TradeMap({ rows, tab, onTabChange, period }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Latest period only
  const latest = useMemo(() => {
    const periods = Array.from(new Set(rows.map((r) => r.period))).sort((a, b) =>
      b.localeCompare(a),
    );
    return period ?? periods[0] ?? null;
  }, [rows, period]);

  // Aggregate by ISO-2
  const byNumeric = useMemo(() => {
    const map = new Map<string, CountryAgg>();
    rows
      .filter((r) => r.period === latest && r.country_code && r.country_code !== "ALL")
      .forEach((r) => {
        const iso2 = r.country_code!.toUpperCase();
        const numeric = ISO2_TO_NUMERIC[iso2];
        if (!numeric) return;
        const prev = map.get(numeric);
        const exp = (prev?.export_usd ?? 0) + (r.export_usd ?? 0);
        const imp = (prev?.import_usd ?? 0) + (r.import_usd ?? 0);
        map.set(numeric, {
          iso2,
          numeric,
          name: r.country_name ?? iso2,
          export_usd: exp,
          import_usd: imp,
          balance: exp - imp,
        });
      });
    return map;
  }, [rows, latest]);

  const valueKey: keyof CountryAgg =
    tab === "export" ? "export_usd" : "import_usd";

  const scale = useMemo(() => {
    const values = Array.from(byNumeric.values())
      .map((a) => a[valueKey] as number)
      .filter((v) => v > 0);
    if (values.length === 0) {
      return () => "#e2e8f0";
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Build a log scale; pick interpolator by tab.
    const interp =
      tab === "export"
        ? (t: number) => interpolateHex("#f0fdfa", "#0d9488", t)
        : (t: number) => interpolateHex("#e2e8f0", "#334155", t);
    const s = scaleSequentialLog(interp).domain([Math.max(min, 1), max]);
    return (v: number) => (v > 0 ? s(v) : "#e2e8f0");
  }, [byNumeric, valueKey, tab]);

  const [hover, setHover] = useState<{
    x: number;
    y: number;
    agg: CountryAgg | null;
    name: string;
  } | null>(null);
  const [selected, setSelected] = useState<CountryAgg | null>(null);

  return (
    <section className="mt-10 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-navy-900)]">
            국가별 교역 지도
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            기준: {latest ? latest.replace("-", ".") : "—"} (월간 확정치)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Legend tab={tab} />
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            <SwitchBtn active={tab === "export"} onClick={() => onTabChange("export")}>
              수출
            </SwitchBtn>
            <SwitchBtn active={tab === "import"} onClick={() => onTabChange("import")}>
              수입
            </SwitchBtn>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div
          className="relative bg-slate-50"
          onMouseLeave={() => setHover(null)}
        >
          {mounted ? (
            <ComposableMap
              projection="geoNaturalEarth1"
              projectionConfig={{ scale: 155 }}
              style={{ width: "100%", height: "auto" }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const id = String(geo.id).padStart(3, "0");
                    const agg = byNumeric.get(id) ?? null;
                    const isKR = id === "410";
                    const value = agg ? (agg[valueKey] as number) : 0;
                    const fill = isKR
                      ? "#f59e0b"
                      : agg
                        ? (scale(value) as string)
                        : "#e2e8f0";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(e) => {
                          setHover({
                            x: e.clientX,
                            y: e.clientY,
                            agg,
                            name: agg?.name ?? geo.properties?.name ?? "—",
                          });
                        }}
                        onMouseMove={(e) => {
                          setHover((h) =>
                            h
                              ? { ...h, x: e.clientX, y: e.clientY }
                              : h,
                          );
                        }}
                        onClick={() => {
                          if (agg) setSelected(agg);
                        }}
                        style={{
                          default: {
                            fill,
                            stroke: "#ffffff",
                            strokeWidth: 0.5,
                            outline: "none",
                            cursor: agg ? "pointer" : "default",
                          },
                          hover: {
                            fill,
                            stroke: "#0f172a",
                            strokeWidth: 1,
                            outline: "none",
                          },
                          pressed: {
                            fill,
                            stroke: "#0f172a",
                            strokeWidth: 1,
                            outline: "none",
                          },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          ) : (
            <div className="flex aspect-[2/1] items-center justify-center text-sm text-slate-400">
              지도 로딩 중…
            </div>
          )}

          {hover && (
            <div
              className="pointer-events-none fixed z-50 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: hover.x + 12, top: hover.y + 12 }}
            >
              <div className="font-bold text-slate-900">
                {flagEmoji(hover.agg?.iso2)} {hover.name}
              </div>
              {hover.agg ? (
                <div className="mt-1 space-y-0.5 text-slate-600">
                  <div>
                    수출:{" "}
                    <span className="font-semibold text-[#0d9488]">
                      {formatUSD(hover.agg.export_usd)}
                    </span>
                  </div>
                  <div>
                    수입:{" "}
                    <span className="font-semibold text-slate-700">
                      {formatUSD(hover.agg.import_usd)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-0.5 text-slate-400">데이터 없음</div>
              )}
            </div>
          )}
        </div>

        <aside className="border-t border-slate-100 lg:border-l lg:border-t-0">
          {selected ? (
            <DetailPanel
              agg={selected}
              rows={rows}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="p-6 text-sm text-slate-500">
              지도에서 국가를 선택하면 상세 정보가 표시됩니다.
              <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />
                대한민국 (출발지)
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function SwitchBtn({
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

function Legend({ tab }: { tab: Tab }) {
  const gradient =
    tab === "export"
      ? "linear-gradient(to right, #f0fdfa, #0d9488)"
      : "linear-gradient(to right, #e2e8f0, #334155)";
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <span className="text-[10px] text-slate-400">낮음</span>
      <div
        className="h-2.5 w-24 rounded-sm"
        style={{ background: gradient }}
      />
      <span className="text-[10px] text-slate-400">높음</span>
    </div>
  );
}

function DetailPanel({
  agg,
  rows,
  onClose,
}: {
  agg: CountryAgg;
  rows: TradeCountryRow[];
  onClose: () => void;
}) {
  // Monthly data for this country
  const countryRows = useMemo(
    () => rows.filter((r) => r.country_code?.toUpperCase() === agg.iso2),
    [rows, agg.iso2],
  );

  const allPeriods = useMemo(
    () => [...new Set(countryRows.map((r) => r.period))].sort(),
    [countryRows],
  );

  const byPeriod = useMemo(() => {
    const map = new Map<string, { exp: number; imp: number }>();
    for (const r of countryRows) {
      const prev = map.get(r.period) ?? { exp: 0, imp: 0 };
      map.set(r.period, {
        exp: prev.exp + (r.export_usd ?? 0),
        imp: prev.imp + (r.import_usd ?? 0),
      });
    }
    return map;
  }, [countryRows]);

  // Last 6 months bar chart data
  const chartData = useMemo(
    () =>
      allPeriods.slice(-6).map((p) => {
        const d = byPeriod.get(p) ?? { exp: 0, imp: 0 };
        return {
          label: periodLabel(p),
          exp_b: +(d.exp / 1e9).toFixed(2),
          imp_b: +(d.imp / 1e9).toFixed(2),
        };
      }),
    [allPeriods, byPeriod],
  );

  // YoY
  const { yoyExp, yoyImp } = useMemo(() => {
    if (allPeriods.length < 13) return { yoyExp: null, yoyImp: null };
    const latest = allPeriods[allPeriods.length - 1];
    const yoyP = yoyPeriodOf(latest);
    const curr = byPeriod.get(latest);
    const prev = byPeriod.get(yoyP);
    if (!curr || !prev) return { yoyExp: null, yoyImp: null };
    return {
      yoyExp: prev.exp > 0 ? ((curr.exp - prev.exp) / prev.exp) * 100 : null,
      yoyImp: prev.imp > 0 ? ((curr.imp - prev.imp) / prev.imp) * 100 : null,
    };
  }, [allPeriods, byPeriod]);

  const totalTrade = agg.export_usd + agg.import_usd;
  const donutData = [
    { name: "수출", value: agg.export_usd },
    { name: "수입", value: agg.import_usd },
  ];

  return (
    <div className="relative max-h-[640px] overflow-y-auto p-5">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 text-xl leading-none text-slate-400 hover:text-slate-700"
        aria-label="닫기"
      >
        ×
      </button>

      {/* Header */}
      <div className="text-2xl">{flagEmoji(agg.iso2)}</div>
      <div className="mt-1 text-lg font-bold text-[var(--color-navy-900)]">
        {agg.name}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{agg.iso2}</div>

      {/* 1. Summary stat cards */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatCard
          label="수출액"
          value={formatUSD(agg.export_usd)}
          color="text-[#0d9488]"
          yoy={yoyExp}
        />
        <StatCard
          label="수입액"
          value={formatUSD(agg.import_usd)}
          color="text-slate-700"
          yoy={yoyImp}
        />
      </div>
      <div className="mt-2">
        <StatCard
          label="무역수지"
          value={formatUSD(agg.balance)}
          color={agg.balance >= 0 ? "text-[#0d9488]" : "text-amber-600"}
          yoy={null}
        />
      </div>

      {/* 2. Monthly bar chart */}
      {chartData.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            최근 6개월 수출입 추이
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  fontSize={10}
                  tickLine={false}
                  stroke="#94a3b8"
                />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  stroke="#94a3b8"
                  tickFormatter={(v) => `$${v}B`}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar
                  dataKey="exp_b"
                  name="수출"
                  fill="#14b8a6"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="imp_b"
                  name="수입"
                  fill="#94a3b8"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[#14b8a6]" />
              수출
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[#94a3b8]" />
              수입
            </span>
          </div>
        </div>
      )}

      {/* 3. Donut chart */}
      {totalTrade > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            수출 / 수입 비중
          </p>
          <div className="flex items-center gap-4">
            <div className="h-28 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={48}
                    dataKey="value"
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#14b8a6" />
                    <Cell fill="#94a3b8" />
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [formatUSD(v), ""]}
                    contentStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#14b8a6]" />
                <span className="text-slate-600">수출</span>
                <span className="font-bold text-[#0d9488]">
                  {((agg.export_usd / totalTrade) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#94a3b8]" />
                <span className="text-slate-600">수입</span>
                <span className="font-bold text-slate-700">
                  {((agg.import_usd / totalTrade) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  yoy,
}: {
  label: string;
  value: string;
  color: string;
  yoy: number | null;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-black tracking-tight ${color}`}>
        {value}
      </div>
      {yoy != null && Number.isFinite(yoy) ? (
        <div className="mt-0.5 flex items-center gap-1 text-[10px]">
          <span
            className={
              "font-semibold " +
              (yoy >= 0 ? "text-[#0d9488]" : "text-amber-600")
            }
          >
            {yoy >= 0 ? "▲" : "▼"} {Math.abs(yoy).toFixed(1)}%
          </span>
          <span className="text-slate-400">전년 동기</span>
        </div>
      ) : (
        <div className="mt-0.5 text-[10px] text-slate-400">전년 동기 —</div>
      )}
    </div>
  );
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-md">
      <div className="font-bold text-slate-800">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="mt-0.5 text-slate-600">
          {p.name}:{" "}
          <span className="font-semibold">${p.value.toFixed(2)}B</span>
        </div>
      ))}
    </div>
  );
}

// Linear interpolation between two hex colors.
function interpolateHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}