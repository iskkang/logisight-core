import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DelayHotspotMap, type ManualMarker } from "@/components/dashboard/DelayHotspotMap";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ForecastTracking } from "@/components/dashboard/ForecastPanel";
import {
  Collecting,
  KpiCard,
  Panel,
  PBadge,
  StatusPill,
  tdStyle,
  thStyle,
} from "@/components/proto/Kit";
import { publishedForecastsQueryOptions } from "@/lib/api/forecasts";
import { buildDelayHotspots } from "@/lib/eurasia-geo";
import { buildCalculatedDelays } from "@/lib/delay-segments";
import { OperationalSourceStatusBar } from "@/components/dashboard/OperationalCurrentDelayMap";
import { operationalCurrentDelayQueryOptions } from "@/lib/api/operational-delay";
import LogisightEurasia, {
  type CorridorRecord,
  type SourceStatus as EuSourceStatus,
} from "@/components/eurasia-page/LogisightEurasia";
import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";

import {
  eurasiaLanesQueryOptions,
  eurasiaDelaysQueryOptions,
  tcrSnapshotsQueryOptions,
  type LaneRow,
  type DelayWeeklyRow,
} from "@/lib/api/eurasia";
import {
  eurasiaDisruptionsActiveQueryOptions,
  upsertEurasiaDisruption,
  resolveEurasiaDisruption,
  type EurasiaDisruptionRow,
} from "@/lib/api/eurasia-disruptions";

// Converts "2026-W23" or "2026-06" to a comparable timestamp so that
// monthly (YYYY-MM) and weekly (YYYY-Wxx) rows sort correctly by real date.
function weekIsoToTs(s: string): number {
  if (/^\d{4}-W\d{2}$/.test(s)) {
    const year = parseInt(s.slice(0, 4), 10);
    const week = parseInt(s.slice(6), 10);
    // ISO week 1 contains Jan 4; Monday of week N = Jan4 + (N-1)*7 - (dayOfWeek(Jan4)-1)
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dow = jan4.getUTCDay() || 7;
    return jan4.getTime() - (dow - 1) * 86_400_000 + (week - 1) * 7 * 86_400_000;
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    // Treat as the 15th of the month (mid-month representative)
    return Date.UTC(parseInt(s.slice(0, 4), 10), parseInt(s.slice(5, 7), 10) - 1, 15);
  }
  return new Date(s).getTime();
}

export const Route = createFileRoute("/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(eurasiaLanesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(tcrSnapshotsQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
    context.queryClient.ensureQueryData(publishedForecastsQueryOptions());
    context.queryClient.ensureQueryData(operationalCurrentDelayQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "유라시아 Control Tower — Logisight" },
      {
        name: "description",
        content:
          "한·중–CIS·유럽 유라시아 철도 회랑의 지연 지수, 정시율, 활성 장애를 한 화면에서 확인하세요.",
      },
    ],
  }),
  component: EurasiaPage,
});

// --- Types ---
type LaneWithDelay = LaneRow & {
  latestDelay: DelayWeeklyRow | null;
  delayHistory: DelayWeeklyRow[];
  activeDisruptions: EurasiaDisruptionRow[];
};

// --- Severity badge ---
const SEV_STYLES = {
  high: "text-status-alert bg-status-alert/10",
  medium: "text-status-caution bg-status-caution/10",
  low: "text-status-normal bg-status-normal/10",
} as const;

function SevBadge({ level }: { level: "high" | "medium" | "low" }) {
  const labels = { high: "높음", medium: "중간", low: "낮음" };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SEV_STYLES[level]}`}>
      {labels[level]}
    </span>
  );
}

// --- Corridor concept diagram (built only from real lane data) ---
type CorridorNode = { label: string; kind: "endpoint" | "border" };

function splitEndpoints(name: string | null): [string, string] | null {
  if (!name) return null;
  const parts = name
    .split(/[–—→~]|->|\s-\s|-/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[parts.length - 1]];
  return null;
}

function buildCorridorNodes(lane: LaneRow): CorridorNode[] {
  const fullName = lane.name_ko ?? lane.name_en ?? null;
  const borders = (lane.border_points ?? []).map((b) => b.trim()).filter(Boolean);
  const ends = splitEndpoints(fullName);
  const nodes: CorridorNode[] = [];
  if (ends) nodes.push({ label: ends[0], kind: "endpoint" });
  else if (fullName) nodes.push({ label: fullName, kind: "endpoint" });
  for (const b of borders) {
    if (!nodes.some((n) => n.label === b)) nodes.push({ label: b, kind: "border" });
  }
  if (ends && !nodes.some((n) => n.label === ends[1])) {
    nodes.push({ label: ends[1], kind: "endpoint" });
  }
  return nodes;
}

function CorridorDiagram({ lane }: { lane: LaneWithDelay }) {
  const nodes = useMemo(() => buildCorridorNodes(lane), [lane]);

  // Map each active disruption to the nearest matching node by segment text
  const markers = useMemo(() => {
    return lane.activeDisruptions.map((d, order) => {
      const seg = (d.segment ?? "").trim();
      let idx = nodes.findIndex((n) => seg && (seg.includes(n.label) || n.label.includes(seg)));
      if (idx < 0) idx = Math.floor(nodes.length / 2);
      return { d, idx, order };
    });
  }, [lane.activeDisruptions, nodes]);

  if (nodes.length < 2) {
    return <p className="py-6 text-sm text-muted-foreground">노선 구간 데이터 수집 중</p>;
  }

  const W = 880;
  const H = 170;
  const padX = 70;
  const lineY = 112;
  const step = (W - 2 * padX) / (nodes.length - 1);
  const xOf = (i: number) => padX + i * step;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label={`${lane.name_ko ?? lane.name_en ?? lane.id} 노선 개념도`}
      >
        {/* connecting line */}
        <line
          x1={xOf(0)}
          y1={lineY}
          x2={xOf(nodes.length - 1)}
          y2={lineY}
          stroke="var(--color-cyan)"
          strokeOpacity={0.35}
          strokeWidth={2}
        />

        {/* nodes */}
        {nodes.map((n, i) => (
          <g key={`${n.label}-${i}`}>
            <circle
              cx={xOf(i)}
              cy={lineY}
              r={n.kind === "endpoint" ? 7 : 6}
              className={
                n.kind === "endpoint"
                  ? "fill-[var(--color-cyan)]"
                  : "fill-[var(--color-status-caution)]"
              }
            />
            <text
              x={xOf(i)}
              y={lineY + 24}
              textAnchor="middle"
              className="fill-foreground text-[12px] font-medium"
            >
              {n.label}
            </text>
            {n.kind === "border" && (
              <text
                x={xOf(i)}
                y={lineY + 40}
                textAnchor="middle"
                className="fill-[var(--color-status-caution)] text-[10px]"
              >
                국경·환적
              </text>
            )}
          </g>
        ))}

        {/* disruption markers */}
        {markers.map(({ d, idx, order }) => {
          const x = xOf(idx);
          const y = 22 + order * 17;
          const days =
            d.delay_contribution_days !== null && d.delay_contribution_days !== undefined
              ? ` +${d.delay_contribution_days}일`
              : "";
          const title = d.title.length > 16 ? `${d.title.slice(0, 16)}…` : d.title;
          return (
            <g key={d.id}>
              <line
                x1={x}
                y1={y + 4}
                x2={x}
                y2={lineY - 9}
                stroke="var(--color-status-alert)"
                strokeOpacity={0.5}
                strokeDasharray="2 2"
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-[var(--color-status-alert)] text-[11px] font-medium"
              >
                ▲ {title}
                {days}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Admin disruption form (minimal) ---
type DisruptionDraft = {
  lane_id: string;
  segment: string;
  title: string;
  severity: "high" | "medium" | "low";
  delay_contribution_days: string;
  started_at: string;
  source: string;
  confidence: "high" | "medium" | "low";
};

const EMPTY_DRAFT: DisruptionDraft = {
  lane_id: "",
  segment: "",
  title: "",
  severity: "medium",
  delay_contribution_days: "",
  started_at: "",
  source: "",
  confidence: "medium",
};

const SEVERITY_ORDER = { high: 3, medium: 2, low: 1 } as const;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatDays(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${round1(n)}일`;
}

function positiveDelayDays(lane: LaneWithDelay): number | null {
  const value = lane.latestDelay?.median_delay_d;
  if (value === null || value === undefined) return null;
  return Math.max(0, round1(value));
}

// --- Delay tier (프로토타입 범례: 정시 / 1–3일 / 3–7일 / 7일+ / 데이터 없음) ---
const TIER = {
  ontime: { label: "정시", color: "var(--status-normal)", state: "normal" },
  t1: { label: "1–3일", color: "var(--status-observe)", state: "observe" },
  t2: { label: "3–7일", color: "var(--status-caution)", state: "caution" },
  t3: { label: "7일+", color: "var(--status-alert)", state: "alert" },
  none: { label: "데이터 없음", color: "var(--ink-muted)", state: "none" },
} as const;

type TierKey = keyof typeof TIER;

function tierOf(delay: number | null): TierKey {
  if (delay === null) return "none";
  if (delay >= 7) return "t3";
  if (delay >= 3) return "t2";
  if (delay >= 1) return "t1";
  return "ontime";
}

function baseTransitLabel(lane: LaneRow): string {
  if (lane.transit_min !== null && lane.transit_max !== null) {
    return lane.transit_min === lane.transit_max
      ? `${lane.transit_min}일`
      : `${lane.transit_min}~${lane.transit_max}일`;
  }
  return "수집 중";
}

function currentTransitLabel(lane: LaneWithDelay): string {
  const delay = positiveDelayDays(lane);
  if (lane.transit_min === null || lane.transit_max === null || delay === null) return "수집 중";
  const min = round1(lane.transit_min + delay);
  const max = round1(lane.transit_max + delay);
  return min === max ? `${min}일` : `${min}~${max}일`;
}

function routeDestination(lane: LaneRow): string {
  const borders = lane.border_points ?? [];
  if (borders.length > 0) return borders[borders.length - 1];
  const name = lane.name_ko ?? lane.name_en ?? lane.id;
  const parts = name
    .split(/->|→|–|—|-/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.at(-1) ?? lane.id;
}

function primaryDisruption(lane: LaneWithDelay): EurasiaDisruptionRow | null {
  return (
    [...lane.activeDisruptions].sort((a, b) => {
      const sev = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
      if (sev !== 0) return sev;
      return (b.delay_contribution_days ?? 0) - (a.delay_contribution_days ?? 0);
    })[0] ?? null
  );
}

function bottleneckText(lane: LaneWithDelay): string {
  const issue = primaryDisruption(lane);
  if (issue) {
    const days =
      issue.delay_contribution_days !== null
        ? ` · +${formatDays(issue.delay_contribution_days)}`
        : "";
    return `${issue.segment}: ${issue.title}${days}`;
  }

  const delay = positiveDelayDays(lane);
  if (delay !== null && delay >= 3 && (lane.border_points ?? []).length > 0) {
    return `${(lane.border_points ?? []).slice(1).join(" / ")} 구간 확인 필요`;
  }
  if (delay !== null && delay > 0) return "추가 지연 발생, 구간 원인 수집 중";
  if (delay === 0) return "특이 지연 없음";
  return "데이터 수집 중";
}

function evidenceText(lane: LaneWithDelay): string {
  const sample = lane.latestDelay?.sample_count;
  const week = lane.latestDelay?.week_iso?.slice(0, 10);
  if (sample && week) return `${sample}건 관측 · ${week}`;
  if (sample) return `${sample}건 관측`;
  return "관측 수집 중";
}

function RouteAnswerPanel({ lane }: { lane: LaneWithDelay }) {
  const delay = positiveDelayDays(lane);
  const destination = routeDestination(lane);
  const issue = primaryDisruption(lane);
  const current = currentTransitLabel(lane);
  const base = baseTransitLabel(lane);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            지금 보내면
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            한국에서 {destination}까지 현재 예상 {current}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            평시 {base}
            {delay !== null
              ? `에 최근 관측 추가 지연 ${formatDays(delay)}를 반영했습니다.`
              : " 기준 지연 관측을 수집 중입니다."}
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground">평시 소요</p>
            <p className="mt-1 font-semibold text-foreground">{base}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground">추가 지연</p>
            <p className="mt-1 font-semibold text-foreground">{formatDays(delay)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_1fr]">
        <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
          <p className="font-semibold text-foreground">현재 병목</p>
          <p className="mt-1 text-muted-foreground">{bottleneckText(lane)}</p>
        </div>
        <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
          <p className="font-semibold text-foreground">근거</p>
          <p className="mt-1 text-muted-foreground">{evidenceText(lane)}</p>
        </div>
      </div>

      {!issue && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          위치와 원인은 자동 집계 지연만으로 단정하지 않습니다. 국경·환적 병목은 활성 장애 데이터가
          들어오면 구간명과 사유로 표시됩니다.
        </p>
      )}
    </section>
  );
}

// --- Page ---
function EurasiaPage() {
  const qc = useQueryClient();
  const { data: lanes } = useSuspenseQuery(eurasiaLanesQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: tcrSnapshots } = useSuspenseQuery(tcrSnapshotsQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());
  const { data: operational } = useSuspenseQuery(operationalCurrentDelayQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());

  const [selectedLane, setSelectedLane] = useState<LaneWithDelay | null>(null);
  const [focusLaneId, setFocusLaneId] = useState<string | null>(null);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [draft, setDraft] = useState<DisruptionDraft>(EMPTY_DRAFT);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  // 리드 뷰(운영 현재 지연)는 LogisightEurasia가 렌더. 아래 '운영 상세' 토글에 보존 모드 2종:
  // 집계 지연 지수(주간) / 수동 이슈. 기본 접힘.
  const [detailMode, setDetailMode] = useState<"index" | "manual">("index");
  const [detailOpen, setDetailOpen] = useState(false);

  const upsertMut = useMutation({
    mutationFn: (d: Parameters<typeof upsertEurasiaDisruption>[0]) => upsertEurasiaDisruption(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eurasia_disruptions", "active"] });
      setDraft(EMPTY_DRAFT);
      setAdminMsg("저장됨");
      setTimeout(() => setAdminMsg(null), 3000);
    },
    onError: (e: Error) => setAdminMsg(`오류: ${e.message}`),
  });

  const resolveMut = useMutation({
    mutationFn: (d: Parameters<typeof resolveEurasiaDisruption>[0]) => resolveEurasiaDisruption(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eurasia_disruptions", "active"] });
    },
  });

  // --- Derived: per-lane data ---
  const lanesWithDelay = useMemo((): LaneWithDelay[] => {
    return lanes.map((lane) => {
      const laneDelays = delays
        .filter((d) => d.lane_id === lane.id)
        .sort((a, b) => weekIsoToTs(a.week_iso) - weekIsoToTs(b.week_iso));
      const latestDelay = laneDelays.at(-1) ?? null;
      const activeDisruptions = disruptions.filter((d) => d.lane_id === lane.id);
      return { ...lane, latestDelay, delayHistory: laneDelays, activeDisruptions };
    });
  }, [lanes, delays, disruptions]);

  // --- Featured lanes + focused lane for concept diagram ---
  const featuredLanes = useMemo(() => {
    const feat = lanesWithDelay.filter((l) => l.is_featured);
    return feat.length > 0 ? feat : lanesWithDelay;
  }, [lanesWithDelay]);

  const focusLane = lanesWithDelay.find((l) => l.id === focusLaneId) ?? featuredLanes[0] ?? null;

  // --- Aggregate metrics ---
  const latestTcr = tcrSnapshots.at(0) ?? null;
  const latestWeek = useMemo(() => {
    const weeks = delays.map((d) => d.week_iso).filter((w): w is string => !!w);
    return weeks.length
      ? weeks.reduce((best, w) => (weekIsoToTs(w) > weekIsoToTs(best) ? w : best))
      : null;
  }, [delays]);

  const avgDelay = useMemo(() => {
    const latestDelays = lanesWithDelay
      .map((l) => positiveDelayDays(l))
      .filter((v): v is number => v !== null && v !== undefined);
    if (latestDelays.length === 0) return null;
    return Math.round((latestDelays.reduce((s, v) => s + v, 0) / latestDelays.length) * 10) / 10;
  }, [lanesWithDelay]);

  // 지연 hotspot — 활성 장애(disruption)를 위치(segment) 기준으로 집계.
  const laneNameById = useMemo(
    () => new Map(lanes.map((l): [string, string] => [l.id, l.name_ko ?? l.name_en ?? l.id])),
    [lanes],
  );
  const delayHotspotData = useMemo(
    () => buildDelayHotspots(disruptions, laneNameById),
    [disruptions, laneNameById],
  );

  // 계산 지연(primary) — delay_index_weekly(lane+milestone)에서 도출.
  const calcDelays = useMemo(() => buildCalculatedDelays(lanes, delays), [lanes, delays]);

  // 수동 입력 이슈(overlay) — eurasia_disruptions의 매핑된 위치/구간만. id 충돌 방지로 prefix.
  const manualMarkers = useMemo<ManualMarker[]>(() => {
    const pts: ManualMarker[] = delayHotspotData.hotspots.map((h) => ({
      id: `m:${h.id}`,
      name: h.name,
      lng: h.lng,
      lat: h.lat,
      delayDays: h.delayDays,
      severity: h.severity,
      affectedCount: h.affectedCount,
      relatedRoutes: h.relatedRoutes,
      kind: "point",
    }));
    const cor: ManualMarker[] = delayHotspotData.corridors.map((c) => ({
      id: `m:${c.id}`,
      name: `${c.from}–${c.to}`,
      lng: c.midLng,
      lat: c.midLat,
      delayDays: c.delayDays,
      severity: c.severity,
      affectedCount: c.affectedCount,
      relatedRoutes: c.relatedRoutes,
      kind: "corridor",
    }));
    return [...pts, ...cor];
  }, [delayHotspotData]);

  const avgOtp = useMemo(() => {
    const otps = lanesWithDelay
      .map((l) => l.latestDelay?.otp_pct)
      .filter((v): v is number => v !== null && v !== undefined);
    if (otps.length === 0) return null;
    return Math.round(otps.reduce((s, v) => s + v, 0) / otps.length);
  }, [lanesWithDelay]);

  // --- Weekly delay index trend (delay_index_weekly, 전 노선 평균) ---
  const weeklyTrend = useMemo(() => {
    const byWeek = new Map<string, number[]>();
    for (const d of delays) {
      if (!d.week_iso || d.median_delay_d === null || d.median_delay_d === undefined) continue;
      const arr = byWeek.get(d.week_iso) ?? [];
      arr.push(Math.max(0, d.median_delay_d));
      byWeek.set(d.week_iso, arr);
    }
    return [...byWeek.entries()]
      .sort((a, b) => weekIsoToTs(a[0]) - weekIsoToTs(b[0]))
      .slice(-12)
      .map(([week, vals]) => ({
        week: week.replace(/^\d{4}-/, ""),
        avg: round1(vals.reduce((s, v) => s + v, 0) / vals.length),
      }));
  }, [delays]);

  // Drawer for selected lane
  const drawerContent = selectedLane ? (
    <div className="space-y-5">
      <RouteAnswerPanel lane={selectedLane} />

      {/* Delay trend */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          최근 추가 지연 추이
        </h3>
        {selectedLane.delayHistory.length >= 2 ? (
          <>
            <Sparkline
              values={selectedLane.delayHistory.slice(-24).map((d) => d.median_delay_d)}
              width={300}
              height={48}
              color={
                (selectedLane.latestDelay?.median_delay_d ?? 0) >= 7
                  ? "var(--color-status-alert)"
                  : "var(--color-cyan)"
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              최근 {Math.min(24, selectedLane.delayHistory.length)}개 관측 기간 · 출처:
              delay_index_weekly
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">데이터 수집 중</p>
        )}
      </div>

      {/* Latest metrics */}
      {selectedLane.latestDelay && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            계산 근거 ({selectedLane.latestDelay.week_iso?.slice(0, 10)})
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-muted-foreground">보통 추가 지연</span>
            <span>
              {selectedLane.latestDelay.median_delay_d !== null
                ? `${Math.round(selectedLane.latestDelay.median_delay_d * 10) / 10}일`
                : "—"}
            </span>
            <span className="text-muted-foreground">심한 경우 추가 지연</span>
            <span>
              {selectedLane.latestDelay.p90_delay_d !== null
                ? `${Math.round(selectedLane.latestDelay.p90_delay_d * 10) / 10}일`
                : "—"}
            </span>
            <span className="text-muted-foreground">정상 도착 비율</span>
            <span>
              {selectedLane.latestDelay.otp_pct !== null
                ? `${selectedLane.latestDelay.otp_pct}%`
                : "—"}
            </span>
            <span className="text-muted-foreground">관측 건수</span>
            <span>{selectedLane.latestDelay.sample_count ?? "—"}</span>
            <span className="text-muted-foreground">마일스톤</span>
            <span>{selectedLane.latestDelay.milestone ?? "—"}</span>
            <span className="text-muted-foreground">데이터 품질</span>
            <span>{selectedLane.latestDelay.data_quality ?? "—"}</span>
          </div>
        </div>
      )}

      {/* TCR global counts (informational) */}
      {latestTcr && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            TCR 글로벌 집계 ({latestTcr.snapshot_date})
          </h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">전체</span>
            <span>{latestTcr.total ?? "—"}</span>
            <span className="text-muted-foreground">운송 중</span>
            <span>{latestTcr.in_transit ?? "—"}</span>
            <span className="text-muted-foreground">도착</span>
            <span>{latestTcr.arrived ?? "—"}</span>
            <span className="text-muted-foreground">알림</span>
            <span>{latestTcr.alert_count ?? "—"}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            TCR 전체 화물 집계 — 회랑별 분리 아님 · 출처: tcr_snapshots (TCR 자동)
          </p>
        </div>
      )}

      {/* Disruption causes */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          장애 원인 (어드민 보완)
        </h3>
        {selectedLane.activeDisruptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">활성 장애 없음</p>
        ) : (
          <div className="space-y-2">
            {selectedLane.activeDisruptions.map((d) => (
              <div
                key={d.id}
                className="rounded border border-border bg-muted/30 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.title}</span>
                  <SevBadge level={d.severity} />
                </div>
                <p className="text-muted-foreground">구간: {d.segment}</p>
                {d.delay_contribution_days !== null && (
                  <p className="text-muted-foreground">
                    기여 지연: {d.delay_contribution_days}일 추정
                  </p>
                )}
                {d.started_at && <p className="text-muted-foreground">시작: {d.started_at}</p>}
                {d.confidence && <p className="text-muted-foreground">신뢰도: {d.confidence}</p>}
                <button
                  type="button"
                  onClick={() =>
                    resolveMut.mutate({
                      data: { id: d.id, resolved_at: new Date().toISOString().slice(0, 10) },
                    })
                  }
                  className="mt-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  해결로 표시
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison lanes (real transit + delay) */}
      {(() => {
        const others = lanesWithDelay.filter((l) => l.id !== selectedLane.id);
        if (others.length === 0) return null;
        return (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              다른 회랑 비교 (리드타임·지연)
            </h3>
            <div className="space-y-1.5">
              {others.slice(0, 4).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate">{l.name_ko ?? l.name_en ?? l.id}</span>
                  <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                    <span>
                      {l.transit_min !== null && l.transit_max !== null
                        ? `${l.transit_min}–${l.transit_max}일`
                        : "리드타임 —"}
                    </span>
                    <span>
                      {l.latestDelay?.median_delay_d !== null &&
                      l.latestDelay?.median_delay_d !== undefined
                        ? `지연 ${l.latestDelay.median_delay_d}일`
                        : "지연 —"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              lanes·delay_index_weekly 실측 비교 · 운임 비교는 데이터 수집 중
            </p>
          </div>
        );
      })()}

      {/* Operational checklist (derived from real route structure) */}
      {((selectedLane.border_points ?? []).length > 0 ||
        selectedLane.activeDisruptions.length > 0) && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            확인해야 할 운영사항
          </h3>
          <ul className="space-y-1.5 text-xs">
            {(selectedLane.border_points ?? []).map((bp) => (
              <li key={`bp-${bp}`} className="flex items-start gap-2">
                <span className="mt-0.5 text-muted-foreground">▢</span>
                <span>{bp} 환적·통관 서류 사전 확인</span>
              </li>
            ))}
            {selectedLane.activeDisruptions.map((d) => (
              <li key={`dis-${d.id}`} className="flex items-start gap-2">
                <span className="mt-0.5 text-status-alert">▢</span>
                <span>
                  {d.segment}: {d.title} 대응 확인
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related policy */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          관련 정책
        </h3>
        <Link
          to="/policy"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-cyan)] hover:underline"
        >
          제재·통관 정책 모니터링 보기 → 정책 탭
        </Link>
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        원본 shipment_legs 비공개 — 집계 지연·신뢰도만 표시
      </p>
    </div>
  ) : null;

  const detailModes = [
    { key: "index", label: "집계 지연 지수" },
    { key: "manual", label: "수동 이슈" },
  ] as const;

  const dataQualitySources = [
    {
      label: "delay_index_weekly (FESCO 자동)",
      asOf: latestWeek?.slice(0, 10) ?? null,
      expectedDays: 7,
    },
    {
      label: "tcr_snapshots (TCR 자동)",
      asOf: latestTcr?.snapshot_date ?? null,
      expectedDays: 1,
    },
    {
      label: "eurasia_disruptions (어드민 보완)",
      asOf: disruptions.at(0)?.created_at?.slice(0, 10) ?? null,
      expectedDays: 7,
    },
  ];

  // 운영 현재 지연(operational) TCR 레코드 → CorridorRecord 매핑. 원본 컨테이너 비노출, 집계만.
  const opDelay = (r: (typeof operational.records)[number]) =>
    Math.max(0, Math.round(r.alert_delay_days ?? r.max_delay_days ?? r.median_delay_days ?? 0));
  const tcrRecords: CorridorRecord[] = operational.records
    .filter((r) => r.source_system === "TCR")
    .map((r) => ({
      route_label:
        r.route_label ||
        [r.current_from ?? r.origin, r.current_to ?? r.destination].filter(Boolean).join(" → ") ||
        "경로 미확인",
      original_eta: r.original_expected_arrival_date ?? null,
      current_eta: r.current_eta ?? null,
      delay_days: opDelay(r),
      active_containers: Math.max(0, r.active_delayed_count || r.container_count || 0),
    }))
    .sort((a, b) => (b.delay_days ?? 0) - (a.delay_days ?? 0));

  // operational SourceStatus → 컴포넌트 SourceStatus(name/state/detail) 매핑.
  const eurasiaSources: EuSourceStatus[] = operational.sources.map((s) => ({
    name: s.source_system === "FESCO" ? "FESCO · TSR" : "TCR · 중국 철도",
    state: s.state,
    detail:
      s.state === "active"
        ? `정상 · ${s.rows}건`
        : s.state === "error"
          ? "오류"
          : s.state === "view_missing"
            ? "보류 · 뷰 미생성"
            : "보류 · 미수집",
  }));

  // 마지막 업데이트 = 레코드 last_checked_at 최신값(날짜). 없으면 "수집 중".
  const lastChecked = operational.records
    .map((r) => r.last_checked_at)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);
  const updatedLabel = lastChecked
    ? (/^(\d{4})-(\d{2})-(\d{2})/.exec(lastChecked)?.slice(1).join(".") ?? lastChecked)
    : "수집 중";

  return (
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="insight" />
      <InsightSubNav />
      <LogisightEurasia
        showNav={false}
        records={tcrRecords}
        sources={eurasiaSources}
        updatedLabel={updatedLabel}
      >
        <button
          type="button"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] font-bold text-slate-800 hover:bg-slate-50"
        >
          운영 상세 — 집계 지연 지수 · 수동 이슈
          <span
            className={`text-[11px] text-slate-400 transition-transform ${detailOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {detailOpen && (
          <div className="mt-4">
            <nav className="flex flex-wrap gap-3" aria-label="유라시아 상세 보기">
              {detailModes.map((mode) => {
                const active = detailMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setDetailMode(mode.key)}
                    className={[
                      "inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-xl border px-5 text-sm font-extrabold transition",
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                        : "border-slate-200 bg-white text-slate-900 shadow-md shadow-slate-900/5 hover:border-blue-200 hover:bg-blue-50",
                    ].join(" ")}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </nav>

            <OperationalSourceStatusBar sources={operational.sources} className="mt-4" />

            {showAdminForm && (
              <div className="mt-4 space-y-3 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-950">장애 원인 입력 (어드민)</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">회랑</label>
                    <select
                      value={draft.lane_id}
                      onChange={(e) => setDraft((d) => ({ ...d, lane_id: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="">선택</option>
                      {lanes.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name_ko ?? l.name_en ?? l.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">구간</label>
                    <input
                      value={draft.segment}
                      onChange={(e) => setDraft((d) => ({ ...d, segment: e.target.value }))}
                      placeholder="예: 알라산커우 환적"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500">제목</label>
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="예: 알라산커우 세관 검사 지연"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">심각도</label>
                    <select
                      value={draft.severity}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          severity: e.target.value as "high" | "medium" | "low",
                        }))
                      }
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="high">높음</option>
                      <option value="medium">중간</option>
                      <option value="low">낮음</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">
                      기여 지연 (일)
                    </label>
                    <input
                      type="number"
                      value={draft.delay_contribution_days}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, delay_contribution_days: e.target.value }))
                      }
                      placeholder="0"
                      min={0}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">시작일</label>
                    <input
                      type="date"
                      value={draft.started_at}
                      onChange={(e) => setDraft((d) => ({ ...d, started_at: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">출처</label>
                    <input
                      value={draft.source}
                      onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                      placeholder="예: FESCO 공지"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!draft.segment || !draft.title || upsertMut.isPending}
                    onClick={() =>
                      upsertMut.mutate({
                        data: {
                          lane_id: draft.lane_id || null,
                          segment: draft.segment,
                          title: draft.title,
                          severity: draft.severity,
                          delay_contribution_days: draft.delay_contribution_days
                            ? parseFloat(draft.delay_contribution_days)
                            : null,
                          started_at: draft.started_at || null,
                          source: draft.source || null,
                          confidence: draft.confidence,
                        },
                      })
                    }
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {upsertMut.isPending ? "저장 중…" : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminForm(false);
                      setDraft(EMPTY_DRAFT);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  {adminMsg && <span className="text-xs text-slate-500">{adminMsg}</span>}
                </div>
              </div>
            )}

            <div className="mt-4">
              {detailMode === "index" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <KpiCard
                      label="현재 병목"
                      value={disruptions.length === 0 ? "없음" : `${disruptions.length} 건`}
                      sub="활성 구간 기준"
                      iconColor="var(--status-alert)"
                      icon={<span style={{ fontWeight: 700 }}>!</span>}
                      mono={false}
                    />
                    <KpiCard
                      label="평균 추가 지연"
                      value={avgDelay !== null ? `+${avgDelay} 일` : "—"}
                      sub="평시 대비 (관측 노선)"
                      iconColor="var(--status-caution)"
                      icon={<span style={{ fontWeight: 700 }}>⏱</span>}
                      mono={false}
                    />
                    <KpiCard
                      label="정상 도착 비율"
                      value={avgOtp !== null ? `${avgOtp}%` : "—"}
                      sub="최근 관측 주차 기준"
                      iconColor="var(--status-observe)"
                      icon={<span style={{ fontWeight: 700 }}>◷</span>}
                      mono={false}
                    />
                    <KpiCard
                      label="TCR 운송중"
                      value={latestTcr?.in_transit != null ? `${latestTcr.in_transit} 편` : "—"}
                      sub={
                        latestTcr?.snapshot_date
                          ? `스냅샷 ${latestTcr.snapshot_date}`
                          : "스냅샷 수집 중"
                      }
                      iconColor="var(--cyan)"
                      icon={<span style={{ fontWeight: 700 }}>🚉</span>}
                      mono={false}
                    />
                  </div>

                  {focusLane && <RouteAnswerPanel lane={focusLane} />}

                  <Panel
                    title="유라시아 지연 지도"
                    badge={<PBadge variant="navy">집계 지수 {calcDelays.calculated.length}</PBadge>}
                  >
                    <div
                      className="mb-3 rounded-lg border px-3 py-2 text-[12px] leading-relaxed"
                      style={{
                        borderColor: "var(--status-caution)",
                        background: "color-mix(in oklch, var(--status-caution) 8%, transparent)",
                      }}
                    >
                      <b className="font-semibold text-foreground">
                        이 화면은 현재 운영 컨테이너 지연이 아니라 집계된 지연 지수 기준입니다.
                      </b>{" "}
                      현재 컨테이너 현황은 ‘현재 지연’ 탭을 보세요. (delay_index_weekly = 주간/집계
                      median, 일부 노선은 stale·저표본)
                    </div>
                    <DelayHotspotMap
                      calculated={calcDelays.calculated}
                      calcUnmapped={calcDelays.unmapped}
                      manual={manualMarkers}
                    />

                    {featuredLanes.length > 0 && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          노선별 개념도 상세 ({featuredLanes.length}개 회랑)
                        </summary>
                        <div className="mt-3" style={{ display: "flex", flexDirection: "column" }}>
                          {featuredLanes.map((lane, i) => {
                            const tier = TIER[tierOf(positiveDelayDays(lane))];
                            return (
                              <div
                                key={lane.id}
                                style={{
                                  paddingTop: i ? 14 : 0,
                                  marginTop: i ? 14 : 0,
                                  borderTop: i ? "1px solid var(--border)" : "none",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 9,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span
                                    style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}
                                  >
                                    {lane.name_ko ?? lane.name_en ?? lane.id}
                                  </span>
                                  <PBadge variant="secondary">{tier.label}</PBadge>
                                  {lane.activeDisruptions.length > 0 && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--status-alert)",
                                      }}
                                    >
                                      활성 병목 {lane.activeDisruptions.length}
                                    </span>
                                  )}
                                </div>
                                <CorridorDiagram lane={lane} />
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-muted)" }}>
                      ※ 미확인 실시간 위치는 표시하지 않습니다. 국경·환적 지점과 활성
                      병목(eurasia_disruptions)만 표기합니다.
                    </div>
                  </Panel>

                  <Panel
                    title="주간 지연 지수 추이"
                    badge={<PBadge>FESCO · delay_index_weekly</PBadge>}
                  >
                    {weeklyTrend.length >= 2 ? (
                      <ResponsiveContainer width="100%" height={210}>
                        <LineChart
                          data={weeklyTrend}
                          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v: number) => `${v}일`}
                            width={40}
                            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(v: number) => [`${v}일`, "평균 추가 지연"]}
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="avg"
                            stroke="var(--status-caution)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Collecting note="주간 지연 관측이 2주 이상 누적되면 추이가 표시됩니다." />
                    )}
                  </Panel>

                  <Panel
                    title="노선별 회랑 상태"
                    badge={<PBadge>{lanesWithDelay.length}개 노선 · 행 클릭 시 상세</PBadge>}
                    bodyPad={0}
                  >
                    {lanesWithDelay.length === 0 ? (
                      <Collecting note="노선 데이터 수집 중" />
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 13,
                            minWidth: 640,
                          }}
                        >
                          <thead>
                            <tr>
                              <th style={thStyle("left")}>노선</th>
                              <th style={thStyle("right")}>평시</th>
                              <th style={thStyle("right")}>현재 예상</th>
                              <th style={thStyle("right")}>추가 지연</th>
                              <th style={thStyle("left")}>상태</th>
                              <th style={thStyle("left")}>근거</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lanesWithDelay.map((lane) => {
                              const delay = positiveDelayDays(lane);
                              const tierKey = tierOf(delay);
                              const tier = TIER[tierKey];
                              const collecting = tierKey === "none";
                              return (
                                <tr
                                  key={lane.id}
                                  onClick={() => {
                                    setSelectedLane(lane);
                                    setFocusLaneId(lane.id);
                                  }}
                                  className="cursor-pointer transition-colors hover:bg-muted/40"
                                  style={{ opacity: collecting ? 0.72 : 1 }}
                                >
                                  <td
                                    style={{
                                      ...tdStyle("left"),
                                      fontWeight: 600,
                                      color: "var(--ink)",
                                    }}
                                  >
                                    {lane.name_ko ?? lane.name_en ?? lane.id}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle("right"),
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--ink-muted)",
                                    }}
                                  >
                                    {baseTransitLabel(lane)}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle("right"),
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 700,
                                      color: collecting ? "var(--ink-muted)" : "var(--ink)",
                                    }}
                                  >
                                    {currentTransitLabel(lane)}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle("right"),
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 700,
                                      color: tier.color,
                                    }}
                                  >
                                    {delay !== null ? `+${formatDays(delay)}` : "—"}
                                  </td>
                                  <td style={tdStyle("left")}>
                                    {collecting ? (
                                      <PBadge variant="outline">수집 중</PBadge>
                                    ) : (
                                      <StatusPill state={tier.state} label={tier.label} />
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle("left"),
                                      fontSize: 11.5,
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--ink-muted)",
                                    }}
                                  >
                                    {evidenceText(lane)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div
                      style={{
                        padding: "12px 18px",
                        borderTop: "1px solid var(--border)",
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                      }}
                    >
                      ※ 데이터가 충분치 않은 노선은 추정치를 지어내지 않고 "수집 중"으로 표기합니다.
                    </div>
                  </Panel>

                  <ForecastTracking
                    forecasts={forecasts}
                    module="eurasia"
                    title="유라시아 전망 트래킹"
                  />
                  <DataQualityBar sources={dataQualitySources} />

                  <p className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
                    원본 shipment_legs 비공개 — 집계 지연·신뢰도만 표시
                  </p>
                </div>
              )}

              {detailMode === "manual" && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <Panel
                    title="수동 이슈"
                    badge={<PBadge>{disruptions.length}건 · eurasia_disruptions</PBadge>}
                  >
                    {disruptions.length === 0 ? (
                      <Collecting note="현재 수동 입력 활성 이슈가 없습니다." />
                    ) : (
                      <div className="space-y-2">
                        {disruptions.map((d) => {
                          const lane = lanes.find((l) => l.id === d.lane_id);
                          return (
                            <div
                              key={d.id}
                              className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs"
                            >
                              <SevBadge level={d.severity} />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900">{d.title}</p>
                                <p className="text-slate-500">
                                  {lane ? (lane.name_ko ?? lane.name_en) : "—"} · {d.segment}
                                  {d.delay_contribution_days !== null
                                    ? ` · ${d.delay_contribution_days}일 기여 추정`
                                    : ""}
                                </p>
                                {d.started_at && (
                                  <p className="text-slate-500">시작: {d.started_at}</p>
                                )}
                              </div>
                              {d.confidence && (
                                <span className="text-[10px] text-slate-500">
                                  신뢰도 {d.confidence}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                  <div className="space-y-5">
                    <Panel title="입력 관리" badge={<PBadge variant="outline">어드민 보완</PBadge>}>
                      <p className="text-sm leading-relaxed text-slate-500">
                        자동 집계로 단정할 수 없는 구간 원인만 수동 이슈로 보완합니다. 현재 지연
                        산식이나 FESCO/TCR 집계 행과 합산하지 않습니다.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAdminForm((v) => !v)}
                        className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        {showAdminForm ? "입력 폼 닫기" : "장애 입력"}
                      </button>
                    </Panel>

                    <Panel
                      title="수동 이슈 기준"
                      badge={<PBadge variant="outline">raw 비노출</PBadge>}
                    >
                      <ul className="space-y-2 text-xs leading-relaxed text-slate-500">
                        <li>· 원본 shipment_legs 또는 컨테이너 ID는 표시하지 않습니다.</li>
                        <li>· 수동 이슈는 위치와 사유 설명용 오버레이입니다.</li>
                        <li>
                          · TCR 현재 지연은 실제 뷰/행이 생길 때까지 완료 상태로 표시하지 않습니다.
                        </li>
                      </ul>
                    </Panel>
                  </div>

                  <div className="lg:col-span-2">
                    <DataQualityBar sources={dataQualitySources} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DetailDrawer
          open={selectedLane !== null}
          onClose={() => setSelectedLane(null)}
          title={
            selectedLane ? (selectedLane.name_ko ?? selectedLane.name_en ?? selectedLane.id) : ""
          }
        >
          {drawerContent}
        </DetailDrawer>
      </LogisightEurasia>
      <HomeFooter />
    </div>
  );
}
