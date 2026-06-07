import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  Globe2,
  Ship,
} from "lucide-react";

import { DashboardTicker } from "@/components/dashboard/DashboardTicker";
import { DashboardProcessStrip } from "@/components/dashboard/DashboardProcessStrip";
import { FreshnessBadge } from "@/components/dashboard/FreshnessBadge";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ForecastSparkline } from "@/components/forecasts/ForecastSparkline";
import {
  DIR_META,
  FACTOR_LABEL,
  baseIndexCaption,
  dirCls,
  displayLabelOf,
  displayOrderOf,
  evidenceCount,
  missingNames,
  sentences,
} from "@/components/forecasts/forecastUtils";

import { alertCandidatesQueryOptions, type AlertCandidate } from "@/lib/api/alerts";
import {
  computeMoM,
  formatNumber,
  indexStatsQueryOptions,
  kitaSeaRatesQueryOptions,
  latestByRoute,
  type IndexStats,
  type KitaSeaRateRow,
} from "@/lib/api/rates";
import { eurasiaDisruptionsActiveQueryOptions } from "@/lib/api/eurasia-disruptions";
import { eurasiaDelaysQueryOptions, type DelayWeeklyRow } from "@/lib/api/eurasia";
import { latestExchangeRateQueryOptions } from "@/lib/api/exchange-rates";
import {
  dataUpdatesQueryOptions,
  forecastSeriesQueryOptions,
  publishedForecastsQueryOptions,
  riskNotesQueryOptions,
  type Forecast,
  type ForecastSeries,
} from "@/lib/api/forecasts";

export const Route = createFileRoute("/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(alertCandidatesQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(kitaSeaRatesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(latestExchangeRateQueryOptions());
    context.queryClient.ensureQueryData(publishedForecastsQueryOptions());
    context.queryClient.ensureQueryData(forecastSeriesQueryOptions());
    context.queryClient.ensureQueryData(riskNotesQueryOptions());
    context.queryClient.ensureQueryData(dataUpdatesQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "종합 Control Tower — Logisight" },
      {
        name: "description",
        content: "오늘의 핵심 변화, 주요 노선 현황, 운임 상승 현황, 정책·장애 요약.",
      },
    ],
  }),
  component: DashboardPage,
});

type Tone = "blue" | "green" | "amber" | "red" | "gray";

type KeyLane = {
  laneId: string;
  origin: string;
  dest: string;
  mode: "ocean" | "rail";
  metricType: "rate" | "delay";
  displayOrder: number;
};

type KeyLaneRow = {
  lane: KeyLane;
  value: string | null;
  mom: number | null;
  values: number[];
  asOf: string | null;
};

type SeaMover = {
  label: string;
  value: string;
  mom: number;
  asOf: string;
};

const SEV_LABEL: Record<AlertCandidate["severity"], string> = {
  high: "경고",
  medium: "주의",
  low: "낮음",
  info: "정보",
};

const SEV_TONE: Record<AlertCandidate["severity"], Tone> = {
  high: "red",
  medium: "amber",
  low: "blue",
  info: "gray",
};

const STATUS_LABEL: Record<AlertCandidate["status"], string> = {
  new: "신규",
  escalated: "악화",
  unchanged: "지속",
};

const INDEX_ORDER = ["SCFI", "KCCI", "CCFI", "FBX", "WCI", "BDI"];
const JUDGMENT_SUMMARY_ORDER = ["WCI", "SCFI", "KCCI", "CCFI", "FBX", "BDI"];

// MTL 고정 모니터링 노선. 값은 아래 실제 KITA/유라시아 데이터로만 채운다.
const KEY_LANES: KeyLane[] = [
  { laneId: "PUS-LAX", origin: "부산", dest: "로스앤젤레스", mode: "ocean", metricType: "rate", displayOrder: 1 },
  { laneId: "PUS-NYC", origin: "부산", dest: "뉴욕", mode: "ocean", metricType: "rate", displayOrder: 2 },
  { laneId: "PUS-CHI", origin: "부산", dest: "시카고", mode: "ocean", metricType: "rate", displayOrder: 3 },
  { laneId: "KR-ANDIJAN", origin: "한국", dest: "안디잔", mode: "rail", metricType: "delay", displayOrder: 4 },
  { laneId: "CN-ALMATY", origin: "중국", dest: "알마티", mode: "rail", metricType: "delay", displayOrder: 5 },
];

const TONE_CLASS: Record<Tone, { text: string; bg: string; border: string; soft: string }> = {
  blue: {
    text: "text-blue-700",
    bg: "bg-blue-600",
    border: "border-blue-200",
    soft: "bg-blue-50 text-blue-700",
  },
  green: {
    text: "text-emerald-700",
    bg: "bg-emerald-600",
    border: "border-emerald-200",
    soft: "bg-emerald-50 text-emerald-700",
  },
  amber: {
    text: "text-amber-700",
    bg: "bg-amber-500",
    border: "border-amber-200",
    soft: "bg-amber-50 text-amber-700",
  },
  red: {
    text: "text-red-600",
    bg: "bg-red-500",
    border: "border-red-200",
    soft: "bg-red-50 text-red-600",
  },
  gray: {
    text: "text-slate-600",
    bg: "bg-slate-500",
    border: "border-slate-200",
    soft: "bg-slate-100 text-slate-600",
  },
};

function pctText(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function dirTextClass(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-direction-flat";
  return v > 0 ? "text-direction-up" : "text-direction-down";
}

function yyyymmLabel(ym: string | null | undefined): string {
  if (!ym || ym.length < 6) return "—";
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

function kstDateString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return [
    kst.getUTCFullYear(),
    String(kst.getUTCMonth() + 1).padStart(2, "0"),
    String(kst.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function sourceList(stats: IndexStats[], dataUpdates: { dataset: string; updated_at: string | null }[]): string {
  const fromUpdates = dataUpdates.map((u) => u.dataset).filter(Boolean);
  if (fromUpdates.length > 0) return fromUpdates.slice(0, 4).join(" · ");

  const fromStats = [...new Set(stats.map((s) => s.source).filter((s): s is string => Boolean(s)))];
  if (fromStats.length > 0) return fromStats.slice(0, 4).join(" · ");

  return "데이터 수집 중";
}

function latestDataUpdate(dataUpdates: { updated_at: string | null }[]): string | null {
  return dataUpdates.map((u) => u.updated_at).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
}

function statByCode(stats: IndexStats[], code: string): IndexStats | undefined {
  return stats.find((s) => s.index_code === code);
}

function buildLaneRows(seaRates: KitaSeaRateRow[], delays: DelayWeeklyRow[]): KeyLaneRow[] {
  const latestSea = latestByRoute(seaRates);
  const fixedRows = [...KEY_LANES]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((lane) => {
      if (lane.metricType === "rate") {
        const row = latestSea.find((r) => r.origin === lane.origin && r.dest === lane.dest);
        const series = seaRates
          .filter((x) => x.origin === lane.origin && x.dest === lane.dest)
          .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
        const values = series.map((x) => x.feu).filter((v): v is number => v != null);
        if (!row || row.feu == null) {
          return { lane, value: null, mom: null, values, asOf: row?.year_mon ?? null };
        }
        const mom = computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x.feu })));
        return {
          lane,
          value: `$${row.feu.toLocaleString("en-US")}/FEU`,
          mom,
          values,
          asOf: row.year_mon,
        };
      }

      const laneDelays = delays
        .filter((d) => d.lane_id === lane.laneId)
        .sort((a, b) => a.week_iso.localeCompare(b.week_iso));
      const latest = laneDelays.at(-1);
      const values = laneDelays.map((d) => d.median_delay_d).filter((v): v is number => v != null);
      return {
        lane,
        value: latest?.median_delay_d != null ? `중위 지연 ${latest.median_delay_d.toFixed(1)}일` : null,
        mom: null,
        values,
        asOf: latest?.week_iso ?? null,
      };
    });

  const visibleRows = fixedRows.filter((row) => row.value != null);
  const usedSeaKeys = new Set(
    visibleRows
      .filter((row) => row.lane.metricType === "rate")
      .map((row) => `${row.lane.origin}__${row.lane.dest}`),
  );
  const supplemental = latestSea
    .flatMap((row) => {
      if (row.feu == null || usedSeaKeys.has(`${row.origin}__${row.dest}`)) return [];
      const series = seaRates
        .filter((x) => x.origin === row.origin && x.dest === row.dest)
        .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
      const values = series.map((x) => x.feu).filter((v): v is number => v != null);
      const mom = computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x.feu })));
      return [{ row, values, mom }];
    })
    .sort((a, b) => (b.mom ?? -Infinity) - (a.mom ?? -Infinity) || (b.row.feu ?? 0) - (a.row.feu ?? 0));

  for (const candidate of supplemental) {
    if (visibleRows.length >= 6) break;
    const key = `${candidate.row.origin}__${candidate.row.dest}`;
    if (usedSeaKeys.has(key)) continue;
    usedSeaKeys.add(key);
    visibleRows.push({
      lane: {
        laneId: `KITA-${candidate.row.origin}-${candidate.row.dest}`,
        origin: candidate.row.origin,
        dest: candidate.row.dest,
        mode: "ocean",
        metricType: "rate",
        displayOrder: visibleRows.length + 1,
      },
      value: `$${candidate.row.feu!.toLocaleString("en-US")}/FEU`,
      mom: candidate.mom,
      values: candidate.values,
      asOf: candidate.row.year_mon,
    });
  }

  return visibleRows;
}

function buildTopSeaMovers(seaRates: KitaSeaRateRow[]): SeaMover[] {
  const latestSea = latestByRoute(seaRates);
  return latestSea
    .flatMap((row) => {
      const series = seaRates
        .filter((x) => x.origin === row.origin && x.dest === row.dest)
        .sort((a, b) => a.year_mon.localeCompare(b.year_mon));
      const mom = computeMoM(series.map((x) => ({ year_mon: x.year_mon, value: x.feu })));
      if (mom == null || mom <= 0 || row.feu == null) return [];
      return [
        {
          label: `${row.origin} → ${row.dest}`,
          value: `$${row.feu.toLocaleString("en-US")}/FEU`,
          mom,
          asOf: row.year_mon,
        },
      ];
    })
    .sort((a, b) => b.mom - a.mom)
    .slice(0, 3);
}

function orderedStats(stats: IndexStats[]): IndexStats[] {
  const rank = new Map(INDEX_ORDER.map((code, i) => [code, i]));
  return [...stats]
    .filter((s) => s.latest_value != null)
    .sort((a, b) => (rank.get(a.index_code) ?? 99) - (rank.get(b.index_code) ?? 99));
}

function judgmentSummaryStats(stats: IndexStats[], forecast: Forecast | null): IndexStats[] {
  const preferred = [forecast?.metric_ref, ...JUDGMENT_SUMMARY_ORDER].filter((x): x is string => Boolean(x));
  const seen = new Set<string>();
  const rows: IndexStats[] = [];
  for (const code of preferred) {
    if (seen.has(code)) continue;
    const row = statByCode(stats, code);
    if (row?.latest_value != null) {
      seen.add(code);
      rows.push(row);
    }
    if (rows.length >= 4) return rows;
  }
  for (const row of orderedStats(stats)) {
    if (!seen.has(row.index_code)) rows.push(row);
    if (rows.length >= 4) break;
  }
  return rows;
}

function HeroChip({ label, value, tone = "blue" }: { label: string; value: string; tone?: Tone }) {
  const toneCls = TONE_CLASS[tone];
  return (
    <span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${toneCls.border} bg-white/10 text-white backdrop-blur`}>
      <span className={`h-2 w-2 rounded-full ${toneCls.bg}`} aria-hidden />
      <span className="text-white/68">{label}</span>
      <span className="text-white">{value}</span>
    </span>
  );
}

function DashboardHero({
  today,
  highAlerts,
  medAlerts,
  kcciStat,
  disruptions,
}: {
  today: string;
  highAlerts: number;
  medAlerts: number;
  kcciStat: IndexStats | undefined;
  disruptions: number;
}) {
  const alertTone: Tone = highAlerts > 0 ? "red" : medAlerts > 0 ? "amber" : "green";
  const eurasiaTone: Tone = disruptions > 0 ? "amber" : "green";
  return (
    <section className="relative min-h-[220px] overflow-hidden bg-[#071b31] px-4 py-6 text-white lg:px-12 lg:py-7">
      <div
        className="absolute inset-0 bg-cover bg-[position:78%_34%]"
        style={{ backgroundImage: "url(/dashboard-hero.png)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(5,18,34,0.98) 0%, rgba(7,24,43,0.92) 42%, rgba(9,32,57,0.45) 72%, rgba(7,22,40,0.24) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-20"
        style={{ background: "linear-gradient(180deg, transparent, rgba(234,242,251,0.98))" }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-[1540px]">
        <h1 className="text-[34px] font-black leading-tight tracking-normal sm:text-[42px] lg:text-[48px]">
          <span>종합 </span>
          <span className="text-[#36a9ff]">Control Tower</span>
        </h1>
        <p className="mt-2 max-w-[620px] text-sm font-medium leading-6 text-white/82 lg:text-[15px]">
          글로벌 해상 운임, 무역, 정책, 유라시아 리스크를 통합 분석하여 의사결정을 돕는 통합 인텔리전스 플랫폼
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <HeroChip label="오늘" value={today} tone="blue" />
          <HeroChip label="경보" value={`${highAlerts}건 경고 · ${medAlerts}건 주의`} tone={alertTone} />
          <HeroChip label="KCCI WoW" value={pctText(kcciStat?.change_pct)} tone={Math.abs(kcciStat?.change_pct ?? 0) >= 5 ? "amber" : "green"} />
          <HeroChip label="유라시아 상태" value={disruptions === 0 ? "정상" : `${disruptions}건 활성`} tone={eurasiaTone} />
          <HeroChip label="기준일" value={kcciStat?.latest_date?.slice(0, 10) ?? "수집 중"} tone="blue" />
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "blue",
  sparkValues,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub: string;
  tone?: Tone;
  sparkValues?: number[];
}) {
  const toneCls = TONE_CLASS[tone];
  return (
    <article className="min-h-[78px] rounded-lg border border-[#d9e5f3] bg-white/95 p-3 shadow-[0_10px_26px_rgba(16,34,58,0.08)]">
      <div className="flex h-full items-center gap-2.5">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${toneCls.soft} ring-1 ring-inset ring-current/10`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold leading-tight text-slate-500">{label}</div>
          <div className={`mt-1 whitespace-nowrap text-xl font-black leading-none tracking-normal ${toneCls.text}`}>{value}</div>
          <div className="mt-1 text-[10px] font-semibold text-slate-500">{sub}</div>
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <div className="hidden w-20 text-slate-400 xl:block">
            <Sparkline values={sparkValues.slice(-12)} width={80} height={28} color="currentColor" />
          </div>
        )}
      </div>
    </article>
  );
}

function KpiStrip({
  highAlerts,
  medAlerts,
  repForecast,
  forecastSeries,
  laneRows,
  indexCount,
}: {
  highAlerts: number;
  medAlerts: number;
  repForecast: Forecast | null;
  forecastSeries: ForecastSeries | undefined;
  laneRows: KeyLaneRow[];
  indexCount: number;
}) {
  const direction = repForecast?.direction ? DIR_META[repForecast.direction] : null;
  const judgmentTone: Tone =
    repForecast?.direction === "up" ? "green" : repForecast?.direction === "down" ? "red" : repForecast ? "amber" : "gray";
  const forecastValues = forecastSeries?.points.map((p) => p.value) ?? [];
  return (
    <section className="grid gap-2 lg:grid-cols-5">
      <KpiCard
        icon={<AlertTriangle className="h-5 w-5" />}
        label="오늘의 경보"
        value={<span>{highAlerts + medAlerts}</span>}
        sub={highAlerts > 0 || medAlerts > 0 ? "상세히 보기" : "경고 + 주의 없음"}
        tone={highAlerts > 0 ? "red" : medAlerts > 0 ? "amber" : "green"}
      />
      <KpiCard
        icon={<Gauge className="h-5 w-5" />}
        label={`운임 기준 ${repForecast ? displayLabelOf(repForecast) : ""}`}
        value={repForecast?.metric_value_at_publish != null ? formatNumber(repForecast.metric_value_at_publish, 0) : "수집 중"}
        sub={repForecast?.metric_ref ?? "대표 전망 지표 없음"}
        tone="amber"
        sparkValues={forecastValues}
      />
      <KpiCard
        icon={<BrainCircuit className="h-5 w-5" />}
        label="AI 종합 판단"
        value={direction ? `${direction.label}` : "검수 중"}
        sub={repForecast?.expected_range_pct ? `전망 저장값 · ${repForecast.expected_range_pct}%` : "전망 저장값 기준"}
        tone={judgmentTone}
        sparkValues={forecastValues}
      />
      <KpiCard
        icon={<Ship className="h-5 w-5" />}
        label="주요 노선"
        value={laneRows.length}
        sub="개 모니터링"
        tone="blue"
      />
      <KpiCard
        icon={<Globe2 className="h-5 w-5" />}
        label="글로벌 주요 지수"
        value={indexCount}
        sub="개 추적 중"
        tone="blue"
      />
    </section>
  );
}

function SectionTitle({
  children,
  badge,
  link,
}: {
  children: ReactNode;
  badge?: ReactNode;
  link?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-black tracking-normal text-[#173151]">
        {children}
        {badge}
      </h2>
      {link}
    </div>
  );
}

function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-black ${TONE_CLASS[tone].soft}`}>
      {children}
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[#d9e5f3] bg-white/95 p-3 shadow-[0_10px_26px_rgba(16,34,58,0.07)] ${className}`}>
      {children}
    </section>
  );
}

function AlertSummaryCard({
  alerts,
  stats,
  latestRiskNote,
}: {
  alerts: AlertCandidate[];
  stats: IndexStats[];
  latestRiskNote: string | null;
}) {
  const primary = alerts[0] ?? null;
  const high = alerts.filter((a) => a.severity === "high").length;
  const badgeTone = primary ? SEV_TONE[primary.severity] : "green";
  const impactCodes = ["KCCI", "WCI", "SCFI"];
  return (
    <Panel>
      <SectionTitle
        badge={primary ? <ToneBadge tone={badgeTone}>{SEV_LABEL[primary.severity]}</ToneBadge> : <ToneBadge tone="green">정상</ToneBadge>}
      >
        오늘의 핵심 변화
      </SectionTitle>

      {primary ? (
        <div className="rounded-lg border border-red-100 bg-gradient-to-b from-white to-red-50/45 p-3">
          <div className="flex items-center justify-between gap-2">
            <ToneBadge tone={badgeTone}>
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              {SEV_LABEL[primary.severity]}
            </ToneBadge>
            <span className="text-[11px] font-semibold text-slate-500">{STATUS_LABEL[primary.status]}</span>
          </div>
          <h3 className="mt-3 text-base font-black leading-snug tracking-normal text-slate-900">{primary.title}</h3>
          <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">{primary.sub}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {impactCodes.map((code) => {
              const stat = statByCode(stats, code);
              return (
                <div key={code} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-extrabold text-slate-600">
                  {code}
                  <strong className={`mt-0.5 block tabular-nums ${dirTextClass(stat?.change_pct)}`}>{pctText(stat?.change_pct)}</strong>
                </div>
              );
            })}
          </div>
          <Link
            to={primary.deepLink as "/"}
            className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-blue-200 bg-white text-xs font-black text-blue-700 hover:bg-blue-50"
          >
            분석 요약 보기
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/55 p-3">
          <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            경보 없음
          </div>
          <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">
            현재 공개 경보 후보에 경고·주의 항목이 없습니다.
          </p>
        </div>
      )}

      {latestRiskNote && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-black text-slate-500">리스크 노트</div>
          <p className="mt-1 line-clamp-3 text-xs font-semibold leading-6 text-slate-700">{latestRiskNote}</p>
        </div>
      )}

      {high > 1 && <p className="mt-2 text-[11px] font-semibold text-red-600">추가 경고 {high - 1}건이 있습니다.</p>}
    </Panel>
  );
}

function DataBasisCard({
  asOf,
  dataUpdates,
  stats,
  seaRates,
  exRateDate,
  modelVersion,
}: {
  asOf: string;
  dataUpdates: { dataset: string; updated_at: string | null }[];
  stats: IndexStats[];
  seaRates: KitaSeaRateRow[];
  exRateDate: string | null | undefined;
  modelVersion: string;
}) {
  const latestUpdate = latestDataUpdate(dataUpdates);
  const availableIndexes = stats.filter((s) => s.latest_value != null).length;
  const latestSeaMonth = seaRates.map((r) => r.year_mon).sort().at(-1) ?? null;
  const rows = [
    ["기준일", asOf],
    ["데이터 갱신", latestUpdate ? `${latestUpdate.slice(0, 16).replace("T", " ")} KST` : "수집 이력 확인 중"],
    ["수집 소스", sourceList(stats, dataUpdates)],
    ["지수 커버리지", `${availableIndexes}/${stats.length || 0}개 지수`],
    ["KITA 해상 기준", yyyymmLabel(latestSeaMonth)],
    ["환율 기준", exRateDate ?? "데이터 수집 중"],
    ["모델 버전", modelVersion],
  ];
  return (
    <Panel>
      <SectionTitle>데이터 기준</SectionTitle>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-xs last:border-0 last:pb-0">
            <dt className="shrink-0 font-bold text-slate-500">{label}</dt>
            <dd className="line-clamp-2 text-right font-extrabold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ForecastJudgmentPanel({
  forecast,
  series,
  stats,
}: {
  forecast: Forecast | null;
  series: ForecastSeries | undefined;
  stats: IndexStats[];
}) {
  if (!forecast) {
    return (
      <Panel>
        <SectionTitle>오늘의 종합 판단</SectionTitle>
        <p className="text-sm font-semibold text-slate-500">발행된 전망이 없습니다. 검수 후 공개됩니다.</p>
      </Panel>
    );
  }

  const direction = forecast.direction ? DIR_META[forecast.direction] : null;
  const directionClasses = dirCls(forecast.direction);
  const summaryRows = judgmentSummaryStats(stats, forecast);
  const leadSentences = sentences(forecast.statement);
  const lead = leadSentences[0] ?? forecast.statement;
  const transition = leadSentences.length > 1 ? leadSentences[leadSentences.length - 1] : "";
  const invalidation = forecast.invalidation_condition ?? "";
  const upText = forecast.direction === "down" ? invalidation : transition;
  const downText = forecast.direction === "up" ? invalidation : transition;
  const factorRows = (forecast.factor_scores ?? []).filter((f) => !f.missing && f.score != null);
  const miss = missingNames(forecast);

  return (
    <Panel className="p-3 lg:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle
            badge={
              direction ? (
                <span className={`rounded-md px-2 py-1 text-[11px] font-black ${directionClasses.badge}`}>
                  {direction.glyph} {direction.label}
                </span>
              ) : undefined
            }
          >
            오늘의 종합 판단
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            <ToneBadge tone="blue">{displayLabelOf(forecast)}</ToneBadge>
            <ToneBadge tone="gray">확신도 {forecast.confidence ?? "미입력"}</ToneBadge>
            <ToneBadge tone="green">AI 초안 · 에디터 검수</ToneBadge>
          </div>
        </div>
        <div className="flex gap-2">
          <ToneBadge tone="blue">AI 분석</ToneBadge>
          <ToneBadge tone="gray">에디터 검수</ToneBadge>
        </div>
      </div>

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.35fr)_210px_210px]">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-black text-slate-700">
            {displayLabelOf(forecast)} 추이
            {baseIndexCaption(forecast) && <span className="ml-1 font-semibold text-slate-400">({baseIndexCaption(forecast)})</span>}
          </div>
          <div className="min-h-[188px] rounded-lg border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-2">
            <ForecastSparkline
              series={series}
              valueAtPublish={forecast.metric_value_at_publish}
              rangeLowPct={forecast.range_low_pct}
              rangeHighPct={forecast.range_high_pct}
              colorClass={directionClasses.spark}
              className="h-[172px]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/80">
          <h3 className="border-b border-slate-100 px-3 py-2 text-xs font-black text-slate-700">핵심 요약</h3>
          <div className="divide-y divide-slate-100">
            {summaryRows.map((row) => (
              <div key={row.index_code} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-xs font-extrabold">
                <span className="text-slate-500">{row.index_code}</span>
                <span className="tabular-nums text-slate-900">{formatNumber(row.latest_value, row.index_code === "SCFI" || row.index_code === "CCFI" ? 2 : 0)}</span>
                <span className={`tabular-nums ${dirTextClass(row.change_pct)}`}>{pctText(row.change_pct)}</span>
              </div>
            ))}
            {summaryRows.length === 0 && <p className="px-3 py-3 text-xs font-semibold text-slate-500">지수 데이터 수집 중</p>}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/80">
          <h3 className="border-b border-slate-100 px-3 py-2 text-xs font-black text-slate-700">요인별 기여도</h3>
          <div className="space-y-2 px-3 py-2.5">
            {factorRows.map((factor) => {
              const score = factor.score as number;
              const width = `${Math.min(Math.abs(score) / 2, 1) * 50}%`;
              return (
                <div key={factor.factor} className="grid grid-cols-[62px_1fr_38px] items-center gap-2 text-xs font-bold text-slate-600">
                  <span>{FACTOR_LABEL[factor.factor] ?? factor.factor}</span>
                  <span className="relative h-2.5 rounded-full bg-slate-200">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-white" />
                    <span
                      className={`absolute inset-y-0 rounded-full ${score >= 0 ? "bg-blue-500" : "bg-slate-500"}`}
                      style={score >= 0 ? ({ left: "50%", width } as CSSProperties) : ({ right: "50%", width } as CSSProperties)}
                    />
                  </span>
                  <span className="text-right tabular-nums text-slate-800">{score > 0 ? "+" : ""}{score}</span>
                </div>
              );
            })}
            {factorRows.length === 0 && <p className="text-xs font-semibold text-slate-500">팩터 점수 수집 중</p>}
            {miss.length > 0 && <p className="text-[11px] font-semibold text-slate-400">{miss.join(" · ")} 결측</p>}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-xs font-black text-slate-700">종합 인사이트</h3>
        <p className="mt-1 text-xs font-semibold leading-6 text-slate-600">{lead || "전망 본문 수집 중"}</p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <ScenarioBox tone="red" title="상방 조건" text={upText} />
        <ScenarioBox tone="blue" title="기준 시나리오" text={lead} strong />
        <ScenarioBox tone="green" title="하방 조건" text={downText} />
      </div>
    </Panel>
  );
}

function ScenarioBox({ title, text, tone, strong }: { title: string; text: string; tone: Tone; strong?: boolean }) {
  return (
    <div
      className={[
        "rounded-lg border bg-white px-3 py-2.5 text-center",
        strong ? "border-blue-300 ring-1 ring-blue-500/80" : TONE_CLASS[tone].border,
      ].join(" ")}
    >
      <strong className={`block text-xs font-black ${TONE_CLASS[tone].text}`}>{title}</strong>
      <p className="mt-1 line-clamp-2 min-h-[40px] text-[11px] font-semibold leading-5 text-slate-500">
        {text || "발행 전망에 조건 문구 없음"}
      </p>
    </div>
  );
}

function ForecastMiniCards({ forecasts, series }: { forecasts: Forecast[]; series: Record<string, ForecastSeries> }) {
  const tiles = [...forecasts]
    .filter((f) => f.status === "published")
    .sort((a, b) => displayOrderOf(a) - displayOrderOf(b))
    .slice(0, 3);
  if (tiles.length === 0) return null;

  return (
    <section className="grid gap-2 md:grid-cols-3">
      {tiles.map((forecast) => {
        const direction = forecast.direction ? DIR_META[forecast.direction] : null;
        const directionClasses = dirCls(forecast.direction);
        const evidence = evidenceCount(forecast);
        return (
          <Link
            key={forecast.id}
            to="/forecasts"
            search={{ dir: [], series: [], sel: forecast.id }}
            className="rounded-lg border border-[#d9e5f3] bg-white/95 p-3 shadow-[0_10px_26px_rgba(16,34,58,0.07)] hover:border-blue-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-black tracking-normal text-slate-900">{displayLabelOf(forecast)}</h3>
                <p className="text-[11px] font-bold text-slate-500">{forecast.metric_ref ?? "전망 지표"}</p>
              </div>
              {direction && (
                <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-black ${directionClasses.badge}`}>
                  {direction.glyph} {direction.label}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <strong className="text-xl font-black tracking-normal text-slate-900">
                {forecast.metric_value_at_publish != null ? formatNumber(forecast.metric_value_at_publish, 0) : "—"}
              </strong>
              {forecast.expected_range_pct && (
                <span className={directionClasses.text}>{forecast.expected_range_pct}%</span>
              )}
            </div>
            <div className="mt-2 h-9">
              <ForecastSparkline
                series={series[forecast.id]}
                valueAtPublish={forecast.metric_value_at_publish}
                rangeLowPct={forecast.range_low_pct}
                rangeHighPct={forecast.range_high_pct}
                colorClass={directionClasses.spark}
                mini
                className="h-9"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">
              <span>근거 {evidence.present}/{evidence.total}</span>
              <span className="text-right">자세히 보기</span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function LaneCard({ row }: { row: KeyLaneRow }) {
  const route = `${row.lane.origin} → ${row.lane.dest}`;
  const isRail = row.lane.mode === "rail";
  return (
    <article className="flex min-h-[132px] flex-col rounded-lg border border-[#cfdceb] bg-white p-3">
      <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-700">
        <span className="min-w-0 truncate">
          {isRail ? "철도" : "해상"} · {route}
        </span>
        {isRail ? <Activity className="h-3.5 w-3.5 text-slate-400" /> : <Ship className="h-3.5 w-3.5 text-slate-400" />}
      </div>
      <div className="mt-2 text-[22px] font-black leading-tight tracking-normal text-slate-900">
        {row.value ?? "수집 중"}
      </div>
      <div className="mt-auto grid grid-cols-[auto_auto_64px] items-end gap-2 text-[11px] font-bold text-slate-500">
        <span className={`whitespace-nowrap ${dirTextClass(row.mom)}`}>{row.mom != null ? pctText(row.mom) : row.asOf ? "지연 추적" : "데이터 없음"}</span>
        <span className="whitespace-nowrap">{row.asOf ? (isRail ? row.asOf : yyyymmLabel(row.asOf)) : "—"}</span>
        <span className="w-16 justify-self-end text-emerald-600">
          <Sparkline values={row.values.slice(-8)} width={64} height={22} color="currentColor" />
        </span>
      </div>
    </article>
  );
}

function LaneGrid({ rows }: { rows: KeyLaneRow[] }) {
  return (
    <Panel>
      <SectionTitle badge={<ToneBadge tone="gray">한국발</ToneBadge>}>주요 노선 현황</SectionTitle>
      <div className="grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <LaneCard key={row.lane.laneId} row={row} />
        ))}
      </div>
    </Panel>
  );
}

function IndexSnapshot({ stats, asOf }: { stats: IndexStats[]; asOf: string }) {
  const rows = orderedStats(stats).slice(0, 5);
  return (
    <Panel>
      <SectionTitle
        link={
          <Link to="/rates" className="text-[11px] font-black text-blue-700 hover:underline">
            전체 보기
          </Link>
        }
      >
        글로벌 지수 스냅샷
      </SectionTitle>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.index_code} className="grid grid-cols-[34px_1fr_auto_auto] items-center gap-2 py-2 text-xs font-extrabold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-[10px] text-blue-700">{row.index_code.slice(0, 2)}</span>
            <span className="text-slate-700">{row.index_code}</span>
            <span className="tabular-nums text-slate-900">{formatNumber(row.latest_value, row.index_code === "SCFI" || row.index_code === "CCFI" ? 2 : 0)}</span>
            <span className={`tabular-nums ${dirTextClass(row.change_pct)}`}>{pctText(row.change_pct)}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="py-3 text-xs font-semibold text-slate-500">지수 데이터 수집 중</p>}
      </div>
      <p className="mt-2 text-[11px] font-semibold text-slate-400">WoW · 52주 백분위 · 기준 {asOf}</p>
    </Panel>
  );
}

function TopSeaMovers({ movers }: { movers: SeaMover[] }) {
  return (
    <Panel>
      <SectionTitle
        link={
          <Link to="/rates" className="text-[11px] font-black text-blue-700 hover:underline">
            전체 보기
          </Link>
        }
      >
        가장 크게 상승한 한국발 운임
      </SectionTitle>
      {movers.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">KITA 해상 운임 상승 데이터 수집 중</p>
      ) : (
        <div className="space-y-2.5">
          {movers.map((mover, index) => (
            <div key={mover.label} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-slate-100 pb-2 text-xs font-extrabold last:border-0 last:pb-0">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[11px] text-white">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-slate-800">{mover.label}</span>
                <span className="text-[11px] text-slate-400">{mover.value} · {yyyymmLabel(mover.asOf)}</span>
              </span>
              <span className="tabular-nums text-direction-up">{pctText(mover.mom)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] font-semibold text-slate-400">MoM 기준 · KITA 해상 USD/FEU</p>
    </Panel>
  );
}

function EurasiaPanel({
  disruptions,
}: {
  disruptions: {
    id: string;
    title: string;
    severity: "high" | "medium" | "low";
    delay_contribution_days: number | null;
    segment: string;
  }[];
}) {
  return (
    <Panel className="min-h-[238px] overflow-hidden">
      <SectionTitle
        link={
          <Link to="/eurasia" className="text-[11px] font-black text-blue-700 hover:underline">
            전체 보기
          </Link>
        }
      >
        유라시아 활성 장애
      </SectionTitle>
      {disruptions.length === 0 ? (
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            특정 장애 없음
          </div>
          <div className="mt-4 flex justify-center rounded-lg border border-slate-100 bg-slate-50 p-4">
            <img src="/world-map.svg" alt="" className="h-[116px] max-w-full opacity-30" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {disruptions.slice(0, 4).map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-800">{d.title}</span>
                <ToneBadge tone={d.severity === "high" ? "red" : d.severity === "medium" ? "amber" : "blue"}>
                  {d.severity === "high" ? "경고" : d.severity === "medium" ? "주의" : "낮음"}
                </ToneBadge>
              </div>
              <p className="mt-1 font-semibold text-slate-500">
                {d.segment}
                {d.delay_contribution_days != null ? ` · ${d.delay_contribution_days}일 기여 추정` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function DashboardPage() {
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: seaRates } = useSuspenseQuery(kitaSeaRatesQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: exRate } = useSuspenseQuery(latestExchangeRateQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());
  const { data: series } = useSuspenseQuery(forecastSeriesQueryOptions());
  const { data: riskNotes } = useSuspenseQuery(riskNotesQueryOptions());
  const { data: dataUpdates } = useSuspenseQuery(dataUpdatesQueryOptions());

  const today = kstDateString();
  const orderedIndexRows = orderedStats(stats);
  const kcciStat = statByCode(stats, "KCCI");
  const asOf = kcciStat?.latest_date?.slice(0, 10) ?? orderedIndexRows[0]?.latest_date?.slice(0, 10) ?? "수집 중";
  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  const medAlerts = alerts.filter((a) => a.severity === "medium").length;
  const openForecasts = forecasts.filter((f) => f.status === "published");
  const repForecast = openForecasts.find((f) => f.metric_ref === "KCCI") ?? openForecasts[0] ?? null;
  const modelVersion = forecasts.find((f) => f.model_version)?.model_version ?? "미입력";
  const laneRows = useMemo(() => buildLaneRows(seaRates, delays), [seaRates, delays]);
  const topSeaMovers = useMemo(() => buildTopSeaMovers(seaRates), [seaRates]);
  const latestUpdate = latestDataUpdate(dataUpdates);
  const latestUpdateLabel = latestUpdate ? latestUpdate.slice(0, 16).replace("T", " ") : "수집 이력 확인 중";
  const tickerItems = orderedIndexRows.map((s) => ({
    code: s.index_code,
    value: s.latest_value!.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    changePct: s.change_pct,
  }));
  const latestRiskNote = riskNotes[0]?.note ?? null;

  return (
    <div className="bg-[#eaf2fb] text-slate-900">
      <DashboardTicker items={tickerItems} />
      <DashboardHero
        today={today}
        highAlerts={highAlerts}
        medAlerts={medAlerts}
        kcciStat={kcciStat}
        disruptions={disruptions.length}
      />

      <main className="relative z-10 mx-auto mt-3 max-w-[1540px] space-y-3 px-4 pb-4 lg:px-12">
        <KpiStrip
          highAlerts={highAlerts}
          medAlerts={medAlerts}
          repForecast={repForecast}
          forecastSeries={repForecast ? series[repForecast.id] : undefined}
          laneRows={laneRows}
          indexCount={orderedIndexRows.length}
        />

        <section className="grid gap-3 xl:grid-cols-[284px_minmax(0,1fr)_360px] xl:items-start">
          <aside className="space-y-3">
            <AlertSummaryCard alerts={alerts} stats={stats} latestRiskNote={latestRiskNote} />
            <DataBasisCard
              asOf={asOf}
              dataUpdates={dataUpdates}
              stats={stats}
              seaRates={seaRates}
              exRateDate={exRate?.rate_date}
              modelVersion={modelVersion}
            />
          </aside>

          <section className="min-w-0 space-y-3">
            <ForecastJudgmentPanel
              forecast={repForecast}
              series={repForecast ? series[repForecast.id] : undefined}
              stats={stats}
            />
            <ForecastMiniCards forecasts={forecasts} series={series} />
            <LaneGrid rows={laneRows} />
          </section>

          <aside className="space-y-3">
            <IndexSnapshot stats={stats} asOf={asOf} />
            <TopSeaMovers movers={topSeaMovers} />
            <EurasiaPanel disruptions={disruptions} />
          </aside>
        </section>

        <DashboardProcessStrip />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-200/70 pt-2 text-[11px] font-semibold text-slate-500">
          <span>전망·지수·노선 값은 공개 Supabase 데이터 기준입니다.</span>
          <span>
            기준 {asOf} · 최신 수집 {latestUpdateLabel}
          </span>
        </div>
      </main>
    </div>
  );
}
