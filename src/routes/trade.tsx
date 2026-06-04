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
  tradeByCountryQueryOptions,
  formatUSD,
  type TradeItemRow,
  type TradeProvisionalRow,
} from "@/lib/api/trade";
import { indexStatsQueryOptions } from "@/lib/api/rates";

// --- Sufficiency constants ---
const SUFFICIENCY_MIN_MONTHS = 3;
const SUFFICIENCY_MAX_DELAY_DAYS = 45;

export const Route = createFileRoute("/trade")({
  validateSearch: (s: Record<string, unknown>): GlobalFilters => resolveFilters(s),
  loaderDeps: ({ search }) => search,
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tradeByItemQueryOptions());
    context.queryClient.ensureQueryData(tradeProvisionalQueryOptions());
    context.queryClient.ensureQueryData(tradeByCountryQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "무역 인텔리전스 — Logisight" },
      {
        name: "description",
        content: "한국 품목별 수출 모멘텀 및 잠정 수출입 현황.",
      },
    ],
  }),
  component: TradePage,
});

// --- Types ---
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

  // --- Latest provisional period ---
  const latestProvisional = useMemo(() => {
    const sorted = provisional
      .filter((r) => r.stat_type === "provisional_exp")
      .sort((a, b) => b.period.localeCompare(a.period));
    return sorted.at(0) ?? null;
  }, [provisional]);

  // --- Item-level stats ---
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

        // YoY: same month last year
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

        // MoM
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

  // --- Sufficiency gate ---
  const latestItemPeriod = itemStats.at(0)?.latestPeriod ?? null;
  const latestItemDate = latestItemPeriod
    ? new Date(`${latestItemPeriod.slice(0, 4)}-${latestItemPeriod.slice(4, 6)}-01`)
    : null;
  const delayDays = latestItemDate
    ? Math.round((today.getTime() - latestItemDate.getTime()) / 86400000)
    : 999;
  const itemDataSufficient = tradeItems.length > 0 && delayDays <= SUFFICIENCY_MAX_DELAY_DAYS;

  // --- StatusStrip ---
  const kcciStat = rateStats.find((s) => s.index_code === "KCCI");
  const topItem = itemStats.at(0);
  const provisionalExport = latestProvisional?.export_usd;

  const statusItems = useMemo((): StatusItem[] => [
    {
      label: "수출 잠정",
      value: provisionalExport != null ? formatUSD(provisionalExport) : "—",
      state: "normal",
    },
    {
      label: "최신 기준월",
      value: latestItemPeriod
        ? `${latestItemPeriod.slice(0, 4)}.${latestItemPeriod.slice(4, 6)}`
        : "—",
      state:
        delayDays > SUFFICIENCY_MAX_DELAY_DAYS ? "caution" : latestItemPeriod ? "normal" : "observe",
    },
    {
      label: "상승 품목 수",
      value: itemStats.filter((i) => (i.exportYoY ?? 0) > 0).length.toString(),
      state: "normal",
    },
    {
      label: "KCCI WoW",
      value: kcciStat?.change_pct != null ? fmtPct(kcciStat.change_pct) : "—",
      state:
        kcciStat?.change_pct == null
          ? "normal"
          : Math.abs(kcciStat.change_pct) >= 5
          ? "caution"
          : "normal",
    },
  ], [provisionalExport, latestItemPeriod, delayDays, itemStats, kcciStat]);

  // --- Table columns ---
  const ITEM_COLS: ColDef<ItemStat>[] = [
    {
      key: "hs_name",
      header: "품목",
      cell: (r) => (
        <span className="font-medium text-foreground">
          {r.hs_name}
          {!r.sufficient && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">데이터 부족</span>
          )}
        </span>
      ),
    },
    {
      key: "latestExportUsd",
      header: "수출액",
      cell: (r) => formatUSD(r.latestExportUsd),
      className: "text-right tabular-nums",
      headerClassName: "text-right",
    },
    {
      key: "exportYoY",
      header: "YoY",
      cell: (r) =>
        r.sufficient ? (
          <span
            className={
              r.exportYoY == null
                ? "text-muted-foreground"
                : r.exportYoY > 0
                ? "text-status-alert font-medium"
                : r.exportYoY < 0
                ? "text-status-normal"
                : ""
            }
          >
            {fmtPct(r.exportYoY)}
          </span>
        ) : (
          <span className="text-muted-foreground text-[11px]">데이터 수집 중</span>
        ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "exportMoM",
      header: "MoM",
      cell: (r) =>
        r.sufficient ? (
          <span
            className={
              r.exportMoM == null
                ? "text-muted-foreground"
                : r.exportMoM > 0
                ? "text-status-alert"
                : r.exportMoM < 0
                ? "text-status-normal"
                : ""
            }
          >
            {fmtPct(r.exportMoM)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "interpretation",
      header: "해석",
      cell: (r) => (
        <span className="text-muted-foreground text-[11px]">
          {r.sufficient ? r.interpretation : "—"}
        </span>
      ),
    },
    {
      key: "spark",
      header: "12개월",
      cell: (r) => <Sparkline values={r.spark} color="var(--color-cyan)" />,
    },
    {
      key: "topMarkets",
      header: "주요 시장",
      cell: (r) => (
        <span className="text-muted-foreground text-[11px]">
          {r.topMarkets.length > 0 ? r.topMarkets.join("·") : "—"}
        </span>
      ),
    },
  ];

  // --- Provisional table (top-level summary) ---
  const provTopRows = useMemo(() => {
    const exp = provisional
      .filter((r) => r.stat_type === "provisional_exp" && r.period)
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 6);
    return exp;
  }, [provisional]);

  type ProvRow = TradeProvisionalRow;
  const PROV_COLS: ColDef<ProvRow>[] = [
    {
      key: "period",
      header: "기간",
      cell: (r) => `${r.period.slice(0, 4)}.${r.period.slice(4, 6)}`,
    },
    {
      key: "export_usd",
      header: "수출 (USD)",
      cell: (r) => formatUSD(r.export_usd),
      className: "text-right tabular-nums",
      headerClassName: "text-right",
    },
    {
      key: "import_usd",
      header: "수입 (USD)",
      cell: (r) => formatUSD(r.import_usd),
      className: "text-right tabular-nums",
      headerClassName: "text-right",
    },
    {
      key: "trade_balance",
      header: "무역수지",
      cell: (r) => (
        <span
          className={
            r.trade_balance == null
              ? ""
              : r.trade_balance >= 0
              ? "text-status-alert"
              : "text-status-normal"
          }
        >
          {formatUSD(r.trade_balance)}
        </span>
      ),
      className: "text-right tabular-nums",
      headerClassName: "text-right",
    },
  ];

  return (
    <DashboardShell title="무역 인텔리전스" subtitle="한국 수출입 현황 · 품목별 모멘텀">
      <GlobalContextBar filters={filters} onChange={setFilters} collapsed />

      <StatusStrip items={statusItems} />

      {/* Provisional export summary */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">
          잠정 수출입{" "}
          <span className="text-[11px] font-normal text-muted-foreground">관세청 잠정치 · 월별</span>
        </h2>
        {provTopRows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">데이터 수집 중</p>
        ) : (
          <IntelTable
            cols={PROV_COLS}
            rows={provTopRows}
            rowKey={(r) => r.period + (r.country_code ?? "")}
          />
        )}
      </section>

      {/* Item-first section with sufficiency gate */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold">품목별 수출 모멘텀</h2>
          {latestItemPeriod && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              기준 {latestItemPeriod.slice(0, 4)}.{latestItemPeriod.slice(4, 6)}
            </span>
          )}
          {delayDays > SUFFICIENCY_MAX_DELAY_DAYS && latestItemPeriod && (
            <span className="rounded bg-status-caution/10 px-1.5 py-0.5 text-[11px] text-status-caution">
              최신성 주의 D−{delayDays}
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
              YoY·MoM은 동일 월 비교 · 데이터 {SUFFICIENCY_MIN_MONTHS}개월 미만 품목은 "데이터 수집 중" 표시 · 출처: 관세청
            </p>
          </>
        )}
      </section>

      {/* Trade-Rate alignment — only when both data sources available */}
      {itemDataSufficient && kcciStat?.latest_value !== null && topItem?.sufficient && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">무역–운임 방향 정합</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                수출 신호 ({latestItemPeriod?.slice(0, 4)}.{latestItemPeriod?.slice(4, 6)})
              </p>
              {topItem ? (
                <>
                  <p className="text-sm font-semibold">{topItem.hs_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">YoY {fmtPct(topItem.exportYoY)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 수집 중</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                운임 신호 ({kcciStat?.latest_date?.slice(0, 10)})
              </p>
              <p className="text-sm font-semibold">KCCI {kcciStat?.latest_value?.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">WoW {fmtPct(kcciStat?.change_pct ?? null)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">방향 정합 판단</p>
              {topItem?.exportYoY !== null && kcciStat?.change_pct !== null ? (
                <>
                  <p className="text-sm font-semibold">
                    {Math.sign(topItem.exportYoY ?? 0) === Math.sign(kcciStat.change_pct ?? 0)
                      ? "방향 일치 — 상관 신호"
                      : "방향 비일치 — 추가 관찰 필요"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    인과 미확정 · 시점 차 주의 (무역 {latestItemPeriod?.slice(0, 4)}.{latestItemPeriod?.slice(4, 6)} vs 운임 {kcciStat?.latest_date?.slice(0, 7)})
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 수집 중</p>
              )}
            </div>
          </div>
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
          {
            label: "무역통계 (잠정)",
            asOf: latestProvisional?.priod_dt?.slice(0, 10) ?? null,
            expectedDays: 7,
          },
          { label: "KCCI", asOf: kcciStat?.latest_date?.slice(0, 10) ?? null, expectedDays: 7 },
        ]}
      />

      {/* Detail Drawer */}
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
              <span>{selectedItem.sufficient ? fmtPct(selectedItem.exportYoY) : "데이터 수집 중"}</span>
              <span className="text-muted-foreground">MoM</span>
              <span>{selectedItem.sufficient ? fmtPct(selectedItem.exportMoM) : "데이터 수집 중"}</span>
              <span className="text-muted-foreground">금액–물량 해석</span>
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
