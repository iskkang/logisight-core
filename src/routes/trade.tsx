import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { resolveFilters, useGlobalFilters, type GlobalFilters } from "@/hooks/useGlobalFilters";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { GlobalContextBar } from "@/components/dashboard/GlobalContextBar";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { IntelTable, type ColDef } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";

import {
  tradeByItemQueryOptions,
  tradeProvisionalQueryOptions,
  formatUSD,
  type TradeItemRow,
} from "@/lib/api/trade";
import { indexStatsQueryOptions } from "@/lib/api/rates";

// --- Constants ---
const SUFFICIENCY_MIN_MONTHS = 3;
const SUFFICIENCY_MAX_DELAY_DAYS = 45;

// Heatmap signal thresholds
const SIGNAL_STRONG = 15;  // ≥15% YoY → 강세 ▲▲
const SIGNAL_UP = 5;       // 5–15% → 상승 ▲
const SIGNAL_DOWN = -5;    // -15 to -5% → 약세 ▼
const SIGNAL_WEAK = -15;   // ≤-15% → 급락 ▼▼

export const Route = createFileRoute("/trade")({
  validateSearch: (s: Record<string, unknown>): GlobalFilters => resolveFilters(s),
  loaderDeps: ({ search }) => search,
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tradeByItemQueryOptions());
    context.queryClient.ensureQueryData(tradeProvisionalQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "무역 인텔리전스 — Logisight" },
      { name: "description", content: "한국 품목별 수출 모멘텀 및 국가별 수요 히트맵." },
    ],
  }),
  component: TradePage,
});

// --- Types ---
type SignalLevel = "strong" | "up" | "flat" | "down" | "weak" | "nodata";

type ItemStat = {
  hs_code: string;
  hs_name: string;
  latestExportUsd: number | null;
  exportYoY: number | null;
  exportMoM: number | null;
  weightYoY: number | null;
  interpretation: string;
  spark: (number | null)[];
  topMarkets: string[];
  sufficient: boolean;
  latestPeriod: string | null;
  monthCount: number;
};

type HeatCell = {
  yoy: number | null;
  signal: SignalLevel;
  label: string;
  sufficient: boolean;
};

// --- Signal helpers ---
function yoyToSignal(yoy: number | null, sufficient: boolean): SignalLevel {
  if (!sufficient || yoy === null) return "nodata";
  if (yoy >= SIGNAL_STRONG) return "strong";
  if (yoy >= SIGNAL_UP) return "up";
  if (yoy > SIGNAL_DOWN) return "flat";
  if (yoy > SIGNAL_WEAK) return "down";
  return "weak";
}

const SIGNAL_META: Record<SignalLevel, { label: string; arrow: string; cls: string }> = {
  strong: { label: "강세", arrow: "▲▲", cls: "bg-status-normal/20 text-status-normal font-semibold" },
  up:     { label: "상승", arrow: "▲",  cls: "bg-status-normal/10 text-status-normal" },
  flat:   { label: "보합", arrow: "-",  cls: "bg-muted/50 text-muted-foreground" },
  down:   { label: "약세", arrow: "▼",  cls: "bg-status-alert/10 text-status-alert" },
  weak:   { label: "급락", arrow: "▼▼", cls: "bg-status-alert/20 text-status-alert font-semibold" },
  nodata: { label: "—",   arrow: "",   cls: "text-muted-foreground/40" },
};

function interpretYoY(exportYoY: number | null, weightYoY: number | null): string {
  if (exportYoY === null) return "—";
  if (weightYoY !== null) {
    const diff = exportYoY - weightYoY;
    if (diff > 5) return "단가 상승 주도";
    if (diff < -5) return "물량 대비 단가 하락";
    return "금액·물량 동반";
  }
  if (exportYoY > 10) return "수출액 상승";
  if (exportYoY < -10) return "수출액 하락";
  return "보합";
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// --- Demand signal cell ---
function HeatCell({ cell }: { cell: HeatCell }) {
  const meta = SIGNAL_META[cell.signal];
  return (
    <div className={`rounded px-2 py-1 text-center text-[11px] ${meta.cls}`}>
      {cell.signal === "nodata" ? "—" : `${meta.label} ${meta.arrow}`}
    </div>
  );
}

// --- Policy risk badge ---
const RISK_STYLE: Record<string, string> = {
  high: "text-status-alert bg-status-alert/10",
  medium: "text-status-caution bg-status-caution/10",
  low: "text-status-normal bg-status-normal/10",
};
function PolicyRiskBadge({ level }: { level: string }) {
  const label = level === "high" ? "높음" : level === "medium" ? "중간" : "낮음";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${RISK_STYLE[level] ?? ""}`}>
      {label}
    </span>
  );
}

// --- Main page ---
function TradePage() {
  const search = Route.useSearch();
  const { filters, setFilters } = useGlobalFilters(search);

  const { data: tradeItems } = useSuspenseQuery(tradeByItemQueryOptions());
  const { data: provisional } = useSuspenseQuery(tradeProvisionalQueryOptions());
  const { data: rateStats } = useSuspenseQuery(indexStatsQueryOptions());

  const [selectedItem, setSelectedItem] = useState<ItemStat | null>(null);

  const today = new Date();

  // Latest provisional
  const latestProvisional = useMemo(() => {
    return provisional
      .filter((r) => r.stat_type === "provisional_exp")
      .sort((a, b) => b.period.localeCompare(a.period))
      .at(0) ?? null;
  }, [provisional]);

  // Item-level stats
  const itemStats: ItemStat[] = useMemo(() => {
    if (tradeItems.length === 0) return [];

    const byHs = new Map<string, TradeItemRow[]>();
    for (const r of tradeItems) {
      if (!r.hs_code) continue;
      const arr = byHs.get(r.hs_code) ?? [];
      arr.push(r);
      byHs.set(r.hs_code, arr);
    }

    return [...byHs.entries()]
      .map(([hs, rows]) => {
        const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
        const latest = sorted.at(-1)!;
        const latestYear = latest.period.slice(0, 4);
        const latestMon = latest.period.slice(4, 6);
        const prevYearPeriod = `${parseInt(latestYear) - 1}${latestMon}`;
        const yearAgoRow = sorted.find((r) => r.period === prevYearPeriod);

        const exportYoY =
          latest.export_usd && yearAgoRow?.export_usd
            ? ((latest.export_usd - yearAgoRow.export_usd) / yearAgoRow.export_usd) * 100
            : null;
        const weightYoY =
          latest.export_weight && yearAgoRow?.export_weight
            ? ((latest.export_weight - yearAgoRow.export_weight) / yearAgoRow.export_weight) * 100
            : null;
        const prevRow = sorted.at(-2);
        const exportMoM =
          latest.export_usd && prevRow?.export_usd
            ? ((latest.export_usd - prevRow.export_usd) / prevRow.export_usd) * 100
            : null;

        const spark = sorted.slice(-12).map((r) => r.export_usd);
        const topMarkets = [
          ...new Set(
            rows
              .filter((r) => r.country_name)
              .sort((a, b) => (b.export_usd ?? 0) - (a.export_usd ?? 0))
              .map((r) => r.country_name!),
          ),
        ].slice(0, 3);

        const monthCount = new Set(sorted.map((r) => r.period)).size;

        return {
          hs_code: hs,
          hs_name: latest.hs_name ?? hs,
          latestExportUsd: latest.export_usd,
          exportYoY: exportYoY !== null ? Math.round(exportYoY * 10) / 10 : null,
          exportMoM: exportMoM !== null ? Math.round(exportMoM * 10) / 10 : null,
          weightYoY: weightYoY !== null ? Math.round(weightYoY * 10) / 10 : null,
          interpretation: interpretYoY(exportYoY, weightYoY),
          spark,
          topMarkets,
          sufficient: monthCount >= SUFFICIENCY_MIN_MONTHS,
          latestPeriod: latest.period,
          monthCount,
        };
      })
      .sort((a, b) => (b.exportYoY ?? -Infinity) - (a.exportYoY ?? -Infinity));
  }, [tradeItems]);

  // --- 국가별 수요 모멘텀 히트맵 ---
  // 충분성 기준 통과한 hs_code × country_code 교차셀별 YoY 계산
  const { heatProducts, heatCountries, heatMap } = useMemo(() => {
    if (tradeItems.length === 0) return { heatProducts: [], heatCountries: [], heatMap: new Map() };

    // 충분성 기준 통과한 품목만
    const sufficientHs = new Set(itemStats.filter((i) => i.sufficient).map((i) => i.hs_code));

    // hs_code × country_code별 데이터 집계
    const cellData = new Map<string, TradeItemRow[]>();
    for (const r of tradeItems) {
      if (!r.hs_code || !r.country_code) continue;
      if (!sufficientHs.has(r.hs_code)) continue;
      const key = `${r.hs_code}__${r.country_code}`;
      const arr = cellData.get(key) ?? [];
      arr.push(r);
      cellData.set(key, arr);
    }

    // 국가별 총 수출액 기준 상위 국가 추출
    const countryExport = new Map<string, { name: string; total: number }>();
    for (const r of tradeItems) {
      if (!r.country_code || !r.country_name) continue;
      const existing = countryExport.get(r.country_code);
      const v = r.export_usd ?? 0;
      if (existing) existing.total += v;
      else countryExport.set(r.country_code, { name: r.country_name, total: v });
    }
    const topCountries = [...countryExport.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([code, { name }]) => ({ code, name }));

    // 히트맵 셀 계산
    const map = new Map<string, HeatCell>();
    for (const [key, rows] of cellData.entries()) {
      const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
      const latest = sorted.at(-1)!;
      const latestYear = latest.period.slice(0, 4);
      const latestMon = latest.period.slice(4, 6);
      const prevPeriod = `${parseInt(latestYear) - 1}${latestMon}`;
      const yearAgo = sorted.find((r) => r.period === prevPeriod);
      const yoy =
        latest.export_usd && yearAgo?.export_usd
          ? ((latest.export_usd - yearAgo.export_usd) / yearAgo.export_usd) * 100
          : null;
      const monthCount = new Set(sorted.map((r) => r.period)).size;
      const sufficient = monthCount >= SUFFICIENCY_MIN_MONTHS;
      const signal = yoyToSignal(yoy, sufficient);
      map.set(key, {
        yoy: yoy !== null ? Math.round(yoy * 10) / 10 : null,
        signal,
        label: `${fmtPct(yoy)}`,
        sufficient,
      });
    }

    return {
      heatProducts: itemStats.filter((i) => i.sufficient).slice(0, 8),
      heatCountries: topCountries,
      heatMap: map,
    };
  }, [tradeItems, itemStats]);

  // Sufficiency
  const latestItemPeriod = itemStats.at(0)?.latestPeriod ?? null;
  const latestItemDate = latestItemPeriod
    ? new Date(`${latestItemPeriod.slice(0, 4)}-${latestItemPeriod.slice(4, 6)}-01`)
    : null;
  const delayDays = latestItemDate
    ? Math.round((today.getTime() - latestItemDate.getTime()) / 86400000)
    : 999;

  const sufficientCount = itemStats.filter((i) => i.sufficient).length;
  const kcciStat = rateStats.find((s) => s.index_code === "KCCI");

  // StatusStrip
  const topItem = itemStats.at(0);
  const statusItems = useMemo((): StatusItem[] => [
    {
      label: "한국 수출 모멘텀",
      value: topItem?.exportYoY != null ? `YoY ${fmtPct(topItem.exportYoY)}` : "—",
      state: topItem?.exportYoY == null ? "normal" : topItem.exportYoY > 5 ? "observe" : topItem.exportYoY < -5 ? "caution" : "normal",
    },
    {
      label: "주도 품목",
      value: topItem?.hs_name ?? "—",
      state: "normal",
    },
    {
      label: "히트맵 표시 국가",
      value: tradeItems.length > 0 ? `${heatCountries.length}개국 · ${sufficientCount}/${itemStats.length} 품목` : "—",
      state: sufficientCount === 0 ? "caution" : "normal",
    },
    {
      label: "무역 데이터 기준",
      value: latestItemPeriod
        ? `${latestItemPeriod.slice(0, 4)}-${latestItemPeriod.slice(4, 6)}`
        : "—",
      state: delayDays > SUFFICIENCY_MAX_DELAY_DAYS ? "caution" : latestItemPeriod ? "normal" : "observe",
    },
  ], [topItem, heatCountries, sufficientCount, itemStats, latestItemPeriod, delayDays, tradeItems]);

  // Item table columns
  const ITEM_COLS: ColDef<ItemStat>[] = [
    {
      key: "hs_name",
      header: "품목",
      cell: (r) => (
        <div>
          <span className="font-medium text-foreground">{r.hs_name}</span>
          {!r.sufficient && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">(부분)</span>
          )}
        </div>
      ),
    },
    {
      key: "exportYoY",
      header: "수출액 YoY",
      cell: (r) =>
        r.sufficient ? (
          <span className={r.exportYoY == null ? "" : r.exportYoY > 0 ? "text-status-normal font-medium" : r.exportYoY < 0 ? "text-status-alert" : ""}>
            {fmtPct(r.exportYoY)}
          </span>
        ) : (
          <span className="text-muted-foreground text-[11px]">데이터 수집 중</span>
        ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "weightYoY",
      header: "중량 YoY",
      cell: (r) =>
        r.sufficient ? (
          <span className="text-muted-foreground">{fmtPct(r.weightYoY)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "interpretation",
      header: "금액·중량 해석",
      cell: (r) => (
        <span className="text-muted-foreground text-[11px]">
          {r.sufficient ? r.interpretation : "—"}
        </span>
      ),
    },
    {
      key: "spark",
      header: "3개월",
      cell: (r) => <Sparkline values={r.spark.slice(-3)} color="var(--color-cyan)" />,
    },
    {
      key: "topMarkets",
      header: "주요 수요 시장",
      cell: (r) => (
        <span className="text-muted-foreground text-[11px]">
          {r.topMarkets.length > 0 ? r.topMarkets.join("·") : "—"}
        </span>
      ),
    },
    {
      key: "sufficient",
      header: "데이터 충분성",
      cell: (r) => (
        <span className={`text-[11px] font-medium ${r.sufficient ? "text-status-normal" : "text-muted-foreground"}`}>
          {r.sufficient ? "충분" : "부분"}
        </span>
      ),
    },
  ];

  return (
    <DashboardShell title="무역 인텔리전스" subtitle="한국 수출입 현황 · 품목별 모멘텀 · 국가별 수요">
      <GlobalContextBar filters={filters} onChange={setFilters} collapsed />

      <StatusStrip items={statusItems} />

      {/* 품목별 수출 모멘텀 */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold">품목별 수출 모멘텀</h2>
          {latestItemPeriod && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              기준 {latestItemPeriod.slice(0, 4)}-{latestItemPeriod.slice(4, 6)}
            </span>
          )}
          {delayDays > SUFFICIENCY_MAX_DELAY_DAYS && latestItemPeriod && (
            <span className="rounded bg-status-caution/10 px-1.5 py-0.5 text-[11px] text-status-caution">
              최신성 주의 D-{delayDays}
            </span>
          )}
        </div>

        {tradeItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            trade_statistics (stat_type='item') 데이터 수집 중 — 수집 완료 후 자동 표시됩니다
          </div>
        ) : (
          <>
            <IntelTable
              cols={ITEM_COLS}
              rows={itemStats}
              rowKey={(r) => r.hs_code}
              onRowClick={(r) => setSelectedItem(r)}
              emptyText="품목 데이터 없음"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              관세청 확정치 · 품목 = MTI 2단위 집계(샘플) · 행 선택 시 품목 상세 Drawer
            </p>
          </>
        )}
      </section>

      {/* 국가별 수요 모멘텀 히트맵 */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold">국가별 수요 모멘텀</h2>
          <span className="text-[11px] text-muted-foreground">데이터 충분 국가만</span>
          {latestItemPeriod && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              기준 {latestItemPeriod.slice(0, 4)}-{latestItemPeriod.slice(4, 6)}
            </span>
          )}
        </div>

        {heatProducts.length === 0 || heatCountries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            데이터 수집 중 — 충분성 기준({SUFFICIENCY_MIN_MONTHS}개월) 통과 품목 없음
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      품목
                    </th>
                    {heatCountries.map((c) => (
                      <th
                        key={c.code}
                        className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatProducts.map((prod) => (
                    <tr key={prod.hs_code} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5 font-medium text-foreground text-xs whitespace-nowrap">
                        {prod.hs_name}
                      </td>
                      {heatCountries.map((c) => {
                        const cell = heatMap.get(`${prod.hs_code}__${c.code}`);
                        const meta = SIGNAL_META[cell?.signal ?? "nodata"];
                        return (
                          <td key={c.code} className="px-2 py-1.5 text-center">
                            {cell && cell.signal !== "nodata" ? (
                              <div
                                className={`inline-flex min-w-[56px] items-center justify-center rounded px-2 py-1 text-[11px] ${meta.cls}`}
                                title={`YoY ${fmtPct(cell.yoy)}`}
                              >
                                {meta.label} {meta.arrow}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              신호 기준: 강세▲▲ ≥{SIGNAL_STRONG}% · 상승▲ ≥{SIGNAL_UP}% · 보합 · 약세▼ ≤{SIGNAL_DOWN}% · 급락▼▼ ≤{SIGNAL_WEAK}% · 출처 관세청
            </p>
          </>
        )}
      </section>

      {/* 무역-운임 정합 신호 */}
      {itemStats.length > 0 && kcciStat?.latest_value !== null && topItem?.sufficient && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[13px] font-semibold">무역-운임 정합 신호</h2>
            <span className="rounded bg-status-caution/10 px-1.5 py-0.5 text-[11px] text-status-caution">
              기준 시점 불일치: 무역 {latestItemPeriod?.slice(0, 4)}.{latestItemPeriod?.slice(4, 6)} vs 운임 {kcciStat?.latest_date?.slice(0, 7)}
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                무역 신호 ({latestItemPeriod?.slice(0, 4)}.{latestItemPeriod?.slice(4, 6)})
              </p>
              <p className="text-sm font-semibold">{topItem.hs_name} 수출</p>
              <p className="text-xs text-muted-foreground mt-0.5">YoY {fmtPct(topItem.exportYoY)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                운임 신호 ({kcciStat?.latest_date?.slice(0, 10)})
              </p>
              <p className="text-sm font-semibold">KCCI {kcciStat?.latest_value?.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">WoW {fmtPct(kcciStat?.change_pct ?? null)}</p>
            </div>
            <div className="lg:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">정합성 판단</p>
              {topItem.exportYoY !== null && kcciStat?.change_pct !== null ? (
                <>
                  <p className="text-sm font-semibold">
                    {Math.sign(topItem.exportYoY ?? 0) === Math.sign(kcciStat.change_pct ?? 0)
                      ? "방향 일치 — 상관 신호 (인과 미확정)"
                      : "방향 비일치 — 추가 관찰 필요"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    시점 차 주의 · 인과 미확정
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 수집 중</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 수요 신호표 */}
      {itemStats.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">수요 신호표</h2>
          <IntelTable
            cols={[
              {
                key: "route",
                header: "노선",
                cell: (r) => <span className="font-medium">{r.route}</span>,
              },
              {
                key: "trade",
                header: "무역량 신호",
                cell: (r) => (
                  <span className={r.tradeSig.includes("▲") ? "text-status-normal" : r.tradeSig.includes("▼") ? "text-status-alert" : "text-muted-foreground"}>
                    {r.tradeSig}
                  </span>
                ),
              },
              {
                key: "rate",
                header: "운임 신호",
                cell: (r) => (
                  <span className={r.rateSig.includes("▲") ? "text-status-alert" : r.rateSig.includes("▼") ? "text-status-normal" : "text-muted-foreground"}>
                    {r.rateSig}
                  </span>
                ),
              },
              {
                key: "policy",
                header: "정책 리스크",
                cell: (r) => <PolicyRiskBadge level={r.policyRisk} />,
              },
              {
                key: "verdict",
                header: "종합 판단",
                cell: (r) => <span className="text-muted-foreground text-[11px]">{r.verdict}</span>,
              },
            ]}
            rows={[
              {
                route: "한국 → 미국",
                tradeSig: topItem?.exportYoY != null && topItem.exportYoY > 0 ? `▲ 상승` : "· 보합",
                rateSig: kcciStat?.change_pct != null && kcciStat.change_pct > 0 ? "▲ 상승" : "· 보합",
                policyRisk: "medium",
                verdict: "수요·운임 방향 — 상관 신호",
              },
              {
                route: "한국 → EU",
                tradeSig: "· 보합",
                rateSig: "▲ 상승",
                policyRisk: "high",
                verdict: "비용 요인 우세 추정 — CBAM·ETS",
              },
              {
                route: "한국 → CIS",
                tradeSig: "▲ 상승",
                rateSig: "· 보합",
                policyRisk: "high",
                verdict: "철도 대체 검토 신호 — Eurasia 참조",
              },
            ]}
            rowKey={(r) => r.route}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            무역량 기준 {latestItemPeriod?.slice(0, 4)}.{latestItemPeriod?.slice(4, 6)} · 운임 기준 {kcciStat?.latest_date?.slice(0, 10) ?? "—"} — 시점 차 주의 · 출처 관세청·KITA(샘플)
          </p>
        </section>
      )}

      <DataQualityBar
        sources={[
          {
            label: "무역통계 (품목)",
            asOf: latestItemPeriod
              ? `${latestItemPeriod.slice(0, 4)}-${latestItemPeriod.slice(4, 6)}-01`
              : null,
            expectedDays: SUFFICIENCY_MAX_DELAY_DAYS,
          },
          { label: "KCCI", asOf: kcciStat?.latest_date?.slice(0, 10) ?? null, expectedDays: 7 },
        ]}
      />

      <DetailDrawer
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.hs_name ?? ""}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-muted-foreground">HS 코드</span>
              <span className="font-mono">{selectedItem.hs_code}</span>
              <span className="text-muted-foreground">기준 기간</span>
              <span>
                {selectedItem.latestPeriod
                  ? `${selectedItem.latestPeriod.slice(0, 4)}.${selectedItem.latestPeriod.slice(4, 6)}`
                  : "—"}
              </span>
              <span className="text-muted-foreground">수출액</span>
              <span>{formatUSD(selectedItem.latestExportUsd)}</span>
              <span className="text-muted-foreground">YoY</span>
              <span
                className={
                  selectedItem.sufficient && selectedItem.exportYoY != null
                    ? selectedItem.exportYoY > 0
                      ? "text-status-normal"
                      : "text-status-alert"
                    : ""
                }
              >
                {selectedItem.sufficient ? fmtPct(selectedItem.exportYoY) : "데이터 수집 중"}
              </span>
              <span className="text-muted-foreground">중량 YoY</span>
              <span>{selectedItem.sufficient ? fmtPct(selectedItem.weightYoY) : "—"}</span>
              <span className="text-muted-foreground">금액·물량 해석</span>
              <span>{selectedItem.sufficient ? selectedItem.interpretation : "—"}</span>
              <span className="text-muted-foreground">주요 시장</span>
              <span>{selectedItem.topMarkets.join(", ") || "—"}</span>
              <span className="text-muted-foreground">데이터 충분성</span>
              <span>
                {selectedItem.sufficient
                  ? `충분 (${selectedItem.monthCount}개월)`
                  : `부족 (${selectedItem.monthCount}/${SUFFICIENCY_MIN_MONTHS}개월)`}
              </span>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">수출액 추이 (12개월)</p>
              <Sparkline values={selectedItem.spark} width={280} height={48} color="var(--color-cyan)" />
            </div>
          </div>
        )}
      </DetailDrawer>
    </DashboardShell>
  );
}
