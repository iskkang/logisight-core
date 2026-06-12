import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { Sparkline } from "@/components/dashboard/Sparkline";
import {
  Collecting,
  DeltaValue,
  Panel,
  PBadge,
  PCard,
  RankedBars,
  StatusPill,
  tdStyle,
  thStyle,
} from "@/components/proto/Kit";

import { policiesQueryOptions, type PolicyRow } from "@/lib/api/policies";
import {
  riskSnapshotQueryOptions,
  type AiRiskBriefing,
  type ChokepointRiskRow,
  type MacroTrend,
} from "@/lib/api/risk";

export const Route = createFileRoute("/policy")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policiesQueryOptions());
    context.queryClient.ensureQueryData(riskSnapshotQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "포트 리스크 인텔리전스 — Logisight" },
      {
        name: "description",
        content: "항만 혼잡, 해상 병목, 초크포인트와 규제 이벤트 리스크 모니터.",
      },
    ],
  }),
  component: PolicyPage,
});

// --- Helpers ---
const SEV_COLOR: Record<string, string> = {
  high: "var(--color-status-alert)",
  medium: "var(--color-status-caution)",
  low: "var(--color-status-normal)",
  info: "var(--color-status-observe)",
};
const SEV_LABEL: Record<string, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
  info: "정보",
};

function SevBadge({ sev }: { sev: PolicyRow["severity"] | null }) {
  if (!sev) return <span className="text-muted-foreground">—</span>;
  const color = SEV_COLOR[sev] ?? SEV_COLOR.info;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {SEV_LABEL[sev]}
    </span>
  );
}

function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const SEV_RANK: Record<string, number> = { high: 4, medium: 3, low: 2, info: 1 };

function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtTeu(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M TEU`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000).toLocaleString("en-US")}k TEU`;
  return `${Math.round(v).toLocaleString("en-US")} TEU`;
}

function fmtDays(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}일`;
}

function riskTone(value: number | null | undefined): "alert" | "caution" | "normal" {
  if (value == null) return "normal";
  if (value >= 75) return "alert";
  if (value >= 60) return "caution";
  return "normal";
}

function strongestChokepointMove(rows: ChokepointRiskRow[]): ChokepointRiskRow | null {
  return [...rows].sort((a, b) => Math.abs(b.wowPct ?? 0) - Math.abs(a.wowPct ?? 0))[0] ?? null;
}

// First 2 digits = HS chapter
function chapterPrefix(s: string): string {
  return s.replace(/\D/g, "").slice(0, 2);
}

function parseChapters(input: string): Set<string> {
  const set = new Set<string>();
  for (const tok of input.split(/[,\s]+/)) {
    const p = chapterPrefix(tok);
    if (p) set.add(p);
  }
  return set;
}

// --- Reusable checklist (built from real policy rows) ---
function PolicyChecklist({
  items,
  checkedIds,
  onToggle,
  onSelect,
  emptyText = "해당 항목 없음",
}: {
  items: PolicyRow[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (p: PolicyRow) => void;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((p) => {
        const d = p.effective_date ? daysUntil(p.effective_date) : null;
        const checked = checkedIds.has(p.id);
        return (
          <li
            key={p.id}
            className="flex items-start gap-2.5 rounded-md border border-border bg-card px-3 py-2"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={`${p.title_ko} 점검 완료 표시`}
              onClick={() => onToggle(p.id)}
              className={[
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                checked
                  ? "border-[var(--color-cyan)] bg-[var(--color-cyan)]/15 text-[var(--color-cyan)]"
                  : "border-border text-transparent",
              ].join(" ")}
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={[
                    "text-left text-sm font-medium hover:underline",
                    checked ? "text-muted-foreground line-through" : "text-foreground",
                  ].join(" ")}
                >
                  {p.title_ko}
                </button>
                <SevBadge sev={p.severity} />
                {d !== null && d >= 0 && (
                  <span
                    suppressHydrationWarning
                    className={[
                      "rounded px-1 py-0.5 text-[10px] font-medium tabular-nums",
                      d <= 30
                        ? "bg-status-alert/10 text-status-alert"
                        : "bg-status-caution/10 text-status-caution",
                    ].join(" ")}
                  >
                    D−{d}
                  </span>
                )}
                {!p.last_verified_at && (
                  <span className="rounded bg-status-caution/10 px-1 py-0.5 text-[10px] text-status-caution">
                    검증 전
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  {[p.region, p.country_code].filter(Boolean).join(" · ") || p.policy_type}
                </span>
                {p.effective_date && <span>발효 {p.effective_date}</span>}
                {p.affected_hs_chapters && p.affected_hs_chapters.length > 0 && (
                  <span>HS {p.affected_hs_chapters.slice(0, 4).join(", ")}</span>
                )}
                {p.source_url && (
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    출처↗
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AiRiskBriefingPanel({ briefing }: { briefing: AiRiskBriefing | null | undefined }) {
  if (!briefing?.analysisReport) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          AI 해상 리스크 브리핑
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {briefing.generatedAt ?? "—"} · Shipfinder AI
        </span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/80">{briefing.analysisReport}</p>
      {briefing.coreTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {briefing.coreTags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MacroTrendGrid({ trends }: { trends: MacroTrend[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {trends.map((trend) => (
        <div key={trend.label} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{trend.label}</p>
              <p className="text-[11px] text-muted-foreground">{trend.source}</p>
            </div>
            <Sparkline values={trend.spark} color="var(--color-cyan)" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="text-lg font-semibold tabular-nums">{fmtNum(trend.latest, 1)}</p>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              {fmtPct(trend.changePct)}
            </p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">기준 {trend.asOf ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

// --- Policy page ---
function PolicyPage() {
  const { data: policies } = useSuspenseQuery(policiesQueryOptions());
  const { data: risk } = useSuspenseQuery(riskSnapshotQueryOptions());
  const [selected, setSelected] = useState<PolicyRow | null>(null);

  // Checklist + cargo impact analysis state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const toggleChecked = (id: string) =>
    setCheckedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [showImpact, setShowImpact] = useState(false);
  const [hsInput, setHsInput] = useState("");
  const [regionInput, setRegionInput] = useState("");

  // StatusStrip
  const highCount = policies.filter((p) => p.severity === "high").length;
  const unverified = policies.filter((p) => !p.last_verified_at).length;
  const upcoming30 = policies.filter((p) => {
    if (!p.effective_date) return false;
    const d = daysUntil(p.effective_date);
    return d >= 0 && d <= 30;
  }).length;
  const delayedPorts = risk.ports.filter((p) => (p.delayPercent ?? 0) >= 70).length;
  const topChokepoint = strongestChokepointMove(risk.chokepoints);

  // 항만 지연율 Top 8 — 지연율 내림차순 (프로토타입 RankedBars·테이블 공통)
  const top8Ports = useMemo(
    () =>
      [...risk.ports]
        .filter((p) => p.delayPercent != null)
        .sort((a, b) => (b.delayPercent ?? 0) - (a.delayPercent ?? 0))
        .slice(0, 8),
    [risk.ports],
  );

  // 내 화물 영향 분석 — HS 챕터·지역으로 DB 리스크 이벤트 필터
  const impactChapters = useMemo(() => parseChapters(hsInput), [hsInput]);
  const regionQuery = regionInput.trim().toLowerCase();
  const impactMatches = useMemo(() => {
    if (impactChapters.size === 0 && !regionQuery) return null;
    return policies
      .filter((p) => {
        const hsOk =
          impactChapters.size === 0 ||
          (p.affected_hs_chapters ?? []).some((c) => impactChapters.has(chapterPrefix(c)));
        const regionOk =
          !regionQuery ||
          [p.region, p.country_code]
            .filter((x): x is string => Boolean(x))
            .some((x) => x.toLowerCase().includes(regionQuery));
        return hsOk && regionOk;
      })
      .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0));
  }, [policies, impactChapters, regionQuery]);

  return (
    <DashboardShell
      eyebrow="Port Risk Intelligence"
      title="포트"
      titleAccent="리스크"
      subtitle="항만 혼잡·해상 병목·초크포인트·호르무즈 통항을 한 화면에서 모니터링합니다."
      toolbar={
        <button
          type="button"
          onClick={() => setShowImpact((v) => !v)}
          className={[
            "inline-flex h-10 items-center whitespace-nowrap rounded-md px-[18px] text-[13.5px] font-bold transition-opacity hover:opacity-90",
            showImpact
              ? "bg-white text-[var(--color-navy-900)]"
              : "border border-white/30 bg-white/10 text-white",
          ].join(" ")}
        >
          {showImpact ? "분석 닫기" : "내 화물 영향 분석"}
        </button>
      }
    >
      {/* KPI 4칸 — 프로토타입, 전부 실데이터 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <PCard pad="md">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>지연 70%+ 항만</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 6,
              color: delayedPorts > 0 ? "var(--status-alert)" : "var(--ink)",
              fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
            }}
          >
            {risk.ports.length === 0 ? "—" : `${delayedPorts}곳`}
          </div>
        </PCard>
        <PCard pad="md">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>초크포인트 최대 변동</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 6,
              color: "var(--status-caution)",
              fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
            }}
          >
            {topChokepoint ? fmtPct(topChokepoint.wowPct) : "—"}
          </div>
          {topChokepoint && (
            <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
              {topChokepoint.name} · 기준 {topChokepoint.asOf ?? "—"}
            </div>
          )}
        </PCard>
        <PCard pad="md">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>호르무즈 일별 통항</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 6,
              color: "var(--status-observe)",
              fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
            }}
          >
            {risk.hormuz.crossingCount}척
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
            {risk.hormuz.crossingDate}
          </div>
        </PCard>
        <PCard pad="md">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>활성 리스크 이벤트</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 6,
              color: "var(--status-caution)",
              fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
            }}
          >
            {policies.length}건
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
            높음 {highCount} · 30일 내 발효 {upcoming30}
          </div>
        </PCard>
      </div>

      <AiRiskBriefingPanel briefing={risk.hormuz.aiRiskBriefing} />

      {/* 항만 지연율 Top 8 — 임계 가이드 60/75 */}
      <Panel title="항만 지연율 — Top 8" badge={<PBadge>임계 가이드 60 / 75</PBadge>}>
        {top8Ports.length === 0 ? (
          <Collecting note="EconDB 항만 혼잡 데이터를 수집 중입니다." />
        ) : (
          <RankedBars
            rows={top8Ports.map((p) => ({
              label: p.name,
              value: p.delayPercent ?? 0,
              color:
                riskTone(p.delayPercent) === "alert"
                  ? "var(--status-alert)"
                  : riskTone(p.delayPercent) === "caution"
                    ? "var(--status-caution)"
                    : "var(--status-normal)",
            }))}
            max={100}
            thresholds={[
              { at: 60, label: "주의 60%", color: "var(--status-caution)" },
              { at: 75, label: "경보 75%", color: "var(--status-alert)" },
            ]}
          />
        )}
      </Panel>

      {/* 초크포인트 TEU 흐름 — 5열 카드 */}
      <Panel title="초크포인트 TEU 흐름" badge={<PBadge>EconDB · 주간</PBadge>}>
        {risk.chokepoints.length === 0 ? (
          <Collecting note="초크포인트 TEU 데이터를 수집 중입니다." />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {risk.chokepoints.map((row) => {
              const tone =
                row.wowPct == null
                  ? "normal"
                  : Math.abs(row.wowPct) >= 20
                    ? "alert"
                    : Math.abs(row.wowPct) >= 10
                      ? "caution"
                      : "normal";
              const dot =
                tone === "alert"
                  ? "var(--status-alert)"
                  : tone === "caution"
                    ? "var(--status-caution)"
                    : "var(--status-normal)";
              return (
                <PCard key={row.name} pad="md">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {row.name}
                    </span>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-muted)",
                    }}
                  >
                    {row.asOf ?? "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 700,
                      color: "var(--ink)",
                      marginTop: 10,
                      fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
                    }}
                  >
                    {fmtTeu(row.latestTotalTeu)}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
                    <DeltaValue value={row.wowPct} size={11} />
                    <span style={{ fontSize: 10, color: "var(--ink-muted)" }}>WoW</span>
                  </div>
                </PCard>
              );
            })}
          </div>
        )}
      </Panel>

      {/* 항만 Top 8 테이블 + 호르무즈 상황판/뉴스 */}
      <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="전세계 항만 Top 8 — 지연·혼잡"
          badge={<PBadge>지연율 ≥75% 경보 · ≥60% 주의</PBadge>}
          bodyPad={0}
        >
          {top8Ports.length === 0 ? (
            <Collecting note="EconDB 항만 혼잡 데이터를 수집 중입니다." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={thStyle("left")}>항만</th>
                    <th style={thStyle("right")}>지연율</th>
                    <th style={thStyle("right")}>Import dwell</th>
                    <th style={thStyle("right")}>TEU MoM</th>
                    <th style={thStyle("left")}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {top8Ports.map((port) => {
                    const tone = riskTone(port.delayPercent);
                    return (
                      <tr key={`${port.rank}-${port.name}`}>
                        <td style={{ ...tdStyle("left"), fontWeight: 600, color: "var(--ink)" }}>
                          {port.name}
                          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-muted)" }}>
                            {port.country ?? ""}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle("right"),
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            color:
                              tone === "alert"
                                ? "var(--status-alert)"
                                : tone === "caution"
                                  ? "var(--status-caution)"
                                  : "var(--ink)",
                          }}
                        >
                          {fmtPct(port.delayPercent)}
                        </td>
                        <td
                          style={{
                            ...tdStyle("right"),
                            fontFamily: "var(--font-mono)",
                            color: "var(--ink-muted)",
                          }}
                        >
                          {fmtDays(port.importDwell)}
                        </td>
                        <td style={tdStyle("right")}>
                          <DeltaValue value={port.importTeuMom} size={12} />
                        </td>
                        <td style={tdStyle("left")}>
                          <StatusPill
                            state={tone}
                            label={tone === "alert" ? "경보" : tone === "caution" ? "주의" : "정상"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="호르무즈 상황판" bodyPad={16}>
            {(
              [
                ["걸프 선박 수", fmtNum(risk.hormuz.gulfShipCount) + "척", risk.hormuz.gulfShipWowPct],
                ["일별 통항", `${risk.hormuz.crossingCount}척`, null],
                ["유조선 / 벌크", `${risk.hormuz.tankerCount} / ${risk.hormuz.bulkCount}척`, null],
                ...risk.hormuz.macro.map(
                  (m) =>
                    [m.label, fmtNum(m.value, 2), null, m.change] as [
                      string,
                      string,
                      number | null,
                      string?,
                    ],
                ),
              ] as [string, string, number | null, string?][]
            ).map(([k, v, chg, changeText], i) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "8px 0",
                  borderTop: i ? "1px solid var(--border)" : "none",
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--ink-muted)", paddingRight: 10 }}>{k}</span>
                <span
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink)" }}>
                    {v}
                  </span>
                  {chg != null && <DeltaValue value={chg} size={11} />}
                  {changeText && (
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: changeText.startsWith("-")
                          ? "var(--direction-down)"
                          : "var(--direction-up)",
                      }}
                    >
                      {changeText}
                    </span>
                  )}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--ink-muted)" }}>
              기준 {risk.hormuz.asOf ?? "—"} · Shipfinder
            </div>
          </Panel>

          <Panel title="호르무즈 관련 뉴스" bodyPad={16}>
            {risk.hormuz.news.length === 0 ? (
              <Collecting note="Shipfinder 뉴스 수집 중입니다." />
            ) : (
              risk.hormuz.news.slice(0, 3).map((news) => (
                <a
                  key={`${news.url}-${news.title}`}
                  href={news.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "10px 4px",
                    borderTop: "1px solid var(--border)",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>
                    {news.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-muted)",
                      marginTop: 3,
                    }}
                  >
                    {[news.source, news.publishedAt?.slice(0, 10)].filter(Boolean).join(" · ") || "—"}
                  </div>
                </a>
              ))
            )}
          </Panel>
        </div>
      </div>

      <Panel title="글로벌 TEU·운임 매크로" badge={<PBadge>EconDB</PBadge>}>
        <MacroTrendGrid trends={risk.macroTrends} />
      </Panel>

      {/* 내 화물 영향 분석 */}
      {showImpact && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold">내 화물 영향 분석</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              화물 HS 챕터·지역을 입력하면 현재 DB의 리스크 이벤트 중 영향 항목을 추려 점검
              체크리스트를 만듭니다 · DB 기준, 추정·임의 수치 없음
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-muted-foreground">HS 챕터 (쉼표로 구분)</label>
              <input
                value={hsInput}
                onChange={(e) => setHsInput(e.target.value)}
                placeholder="예: 84, 85, 87"
                inputMode="numeric"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">지역·국가 (선택)</label>
              <input
                value={regionInput}
                onChange={(e) => setRegionInput(e.target.value)}
                placeholder="예: EU, US, CN"
                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
          </div>
          {impactMatches === null ? (
            <p className="text-xs text-muted-foreground">HS 챕터 또는 지역을 입력하세요.</p>
          ) : impactMatches.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              입력 조건에 해당하는 리스크 이벤트가 없습니다 (현재 DB 기준).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium">{impactMatches.length}건 해당 — 점검 체크리스트</p>
              <PolicyChecklist
                items={impactMatches}
                checkedIds={checkedIds}
                onToggle={toggleChecked}
                onSelect={setSelected}
              />
            </div>
          )}
        </section>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title_ko ?? ""}
      >
        {selected && <PolicyDetail policy={selected} />}
      </DetailDrawer>
    </DashboardShell>
  );
}

function PolicyDetail({ policy }: { policy: PolicyRow }) {
  const d = policy.effective_date ? daysUntil(policy.effective_date) : null;

  return (
    <div className="space-y-5">
      {!policy.last_verified_at && (
        <div className="rounded bg-status-caution/10 px-3 py-2 text-[11px] font-medium text-status-caution">
          검증 전 — last_verified_at 미입력. 내용을 확인 후 어드민에서 갱신하세요.
        </div>
      )}

      {policy.summary_ko && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            변경 내용 요약
          </p>
          <p className="text-sm leading-relaxed">{policy.summary_ko}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-y-2 text-xs">
        <span className="text-muted-foreground">유형</span>
        <span>{policy.policy_type}</span>
        <span className="text-muted-foreground">지역·국가</span>
        <span>{[policy.region, policy.country_code].filter(Boolean).join(" · ") || "—"}</span>
        <span className="text-muted-foreground">심각도</span>
        <span>
          <SevBadge sev={policy.severity} />
        </span>
        <span className="text-muted-foreground">발효일</span>
        <span>
          {policy.effective_date ?? "—"}
          {d !== null && d >= 0 && <span className="ml-1.5 text-muted-foreground">(D−{d})</span>}
        </span>
        <span className="text-muted-foreground">만료일</span>
        <span>{policy.expiry_date ?? "—"}</span>
        <span className="text-muted-foreground">영향 HS 챕터</span>
        <span>{policy.affected_hs_chapters?.join(", ") || "—"}</span>
        <span className="text-muted-foreground">최종 검증</span>
        <span className={policy.last_verified_at ? "" : "text-status-caution"}>
          {policy.last_verified_at?.slice(0, 10) ?? "검증 전"}
        </span>
      </div>

      {policy.source_url && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            출처
          </p>
          <a
            href={policy.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline break-all"
          >
            {policy.source_url}
          </a>
        </div>
      )}

      {policy.summary_en && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Summary (EN)
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{policy.summary_en}</p>
        </div>
      )}
    </div>
  );
}
