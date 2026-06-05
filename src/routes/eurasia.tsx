import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { IntelTable, type ColDef } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";
import { Sparkline } from "@/components/dashboard/Sparkline";

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

export const Route = createFileRoute("/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(eurasiaLanesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(tcrSnapshotsQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsActiveQueryOptions());
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

// --- Data quality badge ---
const DQ_STYLES: Record<string, string> = {
  high: "text-status-normal",
  medium: "text-status-caution",
  low: "text-status-alert",
};

function DataQualityDot({ level }: { level: string }) {
  const cls = DQ_STYLES[level] ?? "text-muted-foreground";
  return <span className={`font-medium text-xs ${cls}`}>{level}</span>;
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
                ▲ {title}{days}
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

// --- Page ---
function EurasiaPage() {
  const qc = useQueryClient();
  const { data: lanes } = useSuspenseQuery(eurasiaLanesQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: tcrSnapshots } = useSuspenseQuery(tcrSnapshotsQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsActiveQueryOptions());

  const [selectedLane, setSelectedLane] = useState<LaneWithDelay | null>(null);
  const [focusLaneId, setFocusLaneId] = useState<string | null>(null);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [draft, setDraft] = useState<DisruptionDraft>(EMPTY_DRAFT);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const upsertMut = useMutation({
    mutationFn: (d: Parameters<typeof upsertEurasiaDisruption>[0]) =>
      upsertEurasiaDisruption(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eurasia_disruptions", "active"] });
      setDraft(EMPTY_DRAFT);
      setAdminMsg("저장됨");
      setTimeout(() => setAdminMsg(null), 3000);
    },
    onError: (e: Error) => setAdminMsg(`오류: ${e.message}`),
  });

  const resolveMut = useMutation({
    mutationFn: (d: Parameters<typeof resolveEurasiaDisruption>[0]) =>
      resolveEurasiaDisruption(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eurasia_disruptions", "active"] });
    },
  });

  // --- Derived: per-lane data ---
  const lanesWithDelay = useMemo((): LaneWithDelay[] => {
    return lanes.map((lane) => {
      const laneDelays = delays
        .filter((d) => d.lane_id === lane.id)
        .sort((a, b) => a.week_iso.localeCompare(b.week_iso));
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

  const focusLane =
    lanesWithDelay.find((l) => l.id === focusLaneId) ?? featuredLanes[0] ?? null;

  // --- Aggregate metrics ---
  const latestTcr = tcrSnapshots.at(0) ?? null;
  const latestWeek = useMemo(() => {
    const weeks = delays.map((d) => d.week_iso).filter(Boolean).sort();
    return weeks.at(-1) ?? null;
  }, [delays]);

  const avgDelay = useMemo(() => {
    const latestDelays = lanesWithDelay
      .map((l) => l.latestDelay?.median_delay_d)
      .filter((v): v is number => v !== null && v !== undefined);
    if (latestDelays.length === 0) return null;
    return Math.round((latestDelays.reduce((s, v) => s + v, 0) / latestDelays.length) * 10) / 10;
  }, [lanesWithDelay]);

  const avgOtp = useMemo(() => {
    const otps = lanesWithDelay
      .map((l) => l.latestDelay?.otp_pct)
      .filter((v): v is number => v !== null && v !== undefined);
    if (otps.length === 0) return null;
    return Math.round(otps.reduce((s, v) => s + v, 0) / otps.length);
  }, [lanesWithDelay]);

  // --- StatusStrip ---
  const statusItems = useMemo((): StatusItem[] => {
    const activeCount = disruptions.length;
    return [
      {
        label: "활성 장애",
        value: activeCount === 0 ? "없음" : `${activeCount}건`,
        state: activeCount === 0 ? "normal" : activeCount >= 3 ? "alert" : "caution",
      },
      {
        label: "평균 지연",
        value: avgDelay !== null ? `${avgDelay}일` : "—",
        state: avgDelay === null ? "normal" : avgDelay >= 7 ? "alert" : avgDelay >= 3 ? "caution" : "normal",
      },
      {
        label: "정시율",
        value: avgOtp !== null ? `${avgOtp}%` : "—",
        state: avgOtp === null ? "normal" : avgOtp < 60 ? "alert" : avgOtp < 80 ? "caution" : "normal",
      },
      {
        label: "기준주",
        value: latestWeek?.slice(0, 10) ?? "—",
        state: "normal",
      },
      ...(latestTcr
        ? [
            {
              label: "TCR 운송중",
              value: latestTcr.in_transit !== null ? String(latestTcr.in_transit) : "—",
              state: "normal" as const,
            },
          ]
        : []),
    ];
  }, [disruptions, avgDelay, avgOtp, latestWeek, latestTcr]);

  // --- Corridor board columns ---
  const CORRIDOR_COLS: ColDef<LaneWithDelay>[] = [
    {
      key: "name",
      header: "회랑",
      cell: (r) => (
        <span className="font-medium text-foreground">{r.name_ko ?? r.name_en ?? r.id}</span>
      ),
    },
    {
      key: "median_delay",
      header: "중위 지연",
      cell: (r) =>
        r.latestDelay?.median_delay_d !== null && r.latestDelay?.median_delay_d !== undefined ? (
          <span
            className={
              r.latestDelay.median_delay_d >= 7
                ? "text-status-alert"
                : r.latestDelay.median_delay_d >= 3
                ? "text-status-caution"
                : "text-status-normal"
            }
          >
            {r.latestDelay.median_delay_d}일
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "p90",
      header: "P90 지연",
      cell: (r) =>
        r.latestDelay?.p90_delay_d !== null && r.latestDelay?.p90_delay_d !== undefined
          ? `${r.latestDelay.p90_delay_d}일`
          : "—",
      className: "text-right text-muted-foreground",
      headerClassName: "text-right",
    },
    {
      key: "otp",
      header: "정시율",
      cell: (r) => {
        const otp = r.latestDelay?.otp_pct;
        if (otp == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={otp < 60 ? "text-status-alert" : otp < 80 ? "text-status-caution" : "text-status-normal"}
          >
            {otp}%
          </span>
        );
      },
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "quality",
      header: "데이터 품질",
      cell: (r) =>
        r.latestDelay?.data_quality ? (
          <DataQualityDot level={r.latestDelay.data_quality as string} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "disruptions",
      header: "활성 장애",
      cell: (r) =>
        r.activeDisruptions.length > 0 ? (
          <span className="text-status-alert font-medium">{r.activeDisruptions.length}건</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "week",
      header: "기준주",
      cell: (r) =>
        r.latestDelay?.week_iso ? (
          <span className="text-muted-foreground text-[11px]">{r.latestDelay.week_iso.slice(0, 10)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  // Drawer for selected lane
  const drawerContent = selectedLane ? (
    <div className="space-y-5">
      {/* Delay trend */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          지연 추이 (중위 지연일)
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
              최근 {Math.min(24, selectedLane.delayHistory.length)}주 · 출처: delay_index_weekly (FESCO TSR 자동)
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
            최신 지표 ({selectedLane.latestDelay.week_iso?.slice(0, 10)})
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-muted-foreground">중위 지연</span>
            <span>{selectedLane.latestDelay.median_delay_d !== null ? `${selectedLane.latestDelay.median_delay_d}일` : "—"}</span>
            <span className="text-muted-foreground">P90 지연</span>
            <span>{selectedLane.latestDelay.p90_delay_d !== null ? `${selectedLane.latestDelay.p90_delay_d}일` : "—"}</span>
            <span className="text-muted-foreground">정시율</span>
            <span>{selectedLane.latestDelay.otp_pct !== null ? `${selectedLane.latestDelay.otp_pct}%` : "—"}</span>
            <span className="text-muted-foreground">샘플 수</span>
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
            <span className="text-muted-foreground">전체</span><span>{latestTcr.total ?? "—"}</span>
            <span className="text-muted-foreground">운송 중</span><span>{latestTcr.in_transit ?? "—"}</span>
            <span className="text-muted-foreground">도착</span><span>{latestTcr.arrived ?? "—"}</span>
            <span className="text-muted-foreground">알림</span><span>{latestTcr.alert_count ?? "—"}</span>
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
              <div key={d.id} className="rounded border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.title}</span>
                  <SevBadge level={d.severity} />
                </div>
                <p className="text-muted-foreground">구간: {d.segment}</p>
                {d.delay_contribution_days !== null && (
                  <p className="text-muted-foreground">기여 지연: {d.delay_contribution_days}일 추정</p>
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
                      {l.latestDelay?.median_delay_d !== null && l.latestDelay?.median_delay_d !== undefined
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

  return (
    <DashboardShell
      title="유라시아 Control Tower"
      subtitle="한·중–CIS·유럽 철도 회랑 운영 현황"
      toolbar={
        <button
          type="button"
          onClick={() => setShowAdminForm((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          + 장애 입력
        </button>
      }
    >
      <StatusStrip items={statusItems} />

      {/* Admin form */}
      {showAdminForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">장애 원인 입력 (어드민)</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-muted-foreground">회랑</label>
              <select
                value={draft.lane_id}
                onChange={(e) => setDraft((d) => ({ ...d, lane_id: e.target.value }))}
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
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
              <label className="text-[11px] text-muted-foreground">구간</label>
              <input
                value={draft.segment}
                onChange={(e) => setDraft((d) => ({ ...d, segment: e.target.value }))}
                placeholder="예: 알라산커우 환적"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-muted-foreground">제목</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="예: 알라산커우 세관 검사 지연"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">심각도</label>
              <select
                value={draft.severity}
                onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as "high" | "medium" | "low" }))}
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="high">높음</option>
                <option value="medium">중간</option>
                <option value="low">낮음</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">기여 지연 (일)</label>
              <input
                type="number"
                value={draft.delay_contribution_days}
                onChange={(e) => setDraft((d) => ({ ...d, delay_contribution_days: e.target.value }))}
                placeholder="0"
                min={0}
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">시작일</label>
              <input
                type="date"
                value={draft.started_at}
                onChange={(e) => setDraft((d) => ({ ...d, started_at: e.target.value }))}
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">출처</label>
              <input
                value={draft.source}
                onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                placeholder="예: FESCO 공지"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
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
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {upsertMut.isPending ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdminForm(false); setDraft(EMPTY_DRAFT); }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              취소
            </button>
            {adminMsg && <span className="text-xs text-muted-foreground">{adminMsg}</span>}
          </div>
        </div>
      )}

      {/* Corridor board */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">
          회랑 운영 현황{" "}
          <span className="text-[11px] font-normal text-muted-foreground">
            delay_index_weekly (FESCO TSR 자동) · 주간
          </span>
        </h2>
        {lanesWithDelay.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">데이터 수집 중</p>
        ) : (
          <IntelTable
            cols={CORRIDOR_COLS}
            rows={lanesWithDelay}
            rowKey={(r) => r.id}
            onRowClick={(r) => {
              setSelectedLane(r);
              setFocusLaneId(r.id);
            }}
          />
        )}
      </section>

      {/* Corridor concept diagram */}
      {focusLane && (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold">
              선택 노선 개념도{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                {focusLane.name_ko ?? focusLane.name_en ?? focusLane.id}
              </span>
            </h2>
            {featuredLanes.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {featuredLanes.map((l) => {
                  const active = l.id === focusLane.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setFocusLaneId(l.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                        active
                          ? "border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {l.name_ko ?? l.name_en ?? l.id}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <CorridorDiagram lane={focusLane} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              지원 노선·국경/환적 구간·활성 장애만 표시 · 장식 요소나 미확인 실시간 위치 없음 ·
              구간 지연 기여는 어드민 보완(eurasia_disruptions) 추정치
            </p>
          </div>
        </section>
      )}

      {/* Active disruptions list */}
      {disruptions.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">
            활성 장애{" "}
            <span className="text-[11px] font-normal text-muted-foreground">eurasia_disruptions (어드민 보완)</span>
          </h2>
          <div className="space-y-2">
            {disruptions.map((d) => {
              const lane = lanes.find((l) => l.id === d.lane_id);
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-3 text-xs"
                >
                  <SevBadge level={d.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{d.title}</p>
                    <p className="text-muted-foreground">
                      {lane ? (lane.name_ko ?? lane.name_en) : "—"} · {d.segment}
                      {d.delay_contribution_days !== null
                        ? ` · ${d.delay_contribution_days}일 기여 추정`
                        : ""}
                    </p>
                    {d.started_at && (
                      <p className="text-muted-foreground">시작: {d.started_at}</p>
                    )}
                  </div>
                  {d.confidence && (
                    <span className="text-[10px] text-muted-foreground">신뢰도 {d.confidence}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <DataQualityBar
        sources={[
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
        ]}
      />

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        원본 shipment_legs 비공개 — 집계 지연·신뢰도만 표시
      </p>

      <DetailDrawer
        open={selectedLane !== null}
        onClose={() => setSelectedLane(null)}
        title={selectedLane ? (selectedLane.name_ko ?? selectedLane.name_en ?? selectedLane.id) : ""}
      >
        {drawerContent}
      </DetailDrawer>
    </DashboardShell>
  );
}
