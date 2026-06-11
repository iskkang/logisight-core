import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { Sparkline } from "@/components/dashboard/Sparkline";

import { policiesQueryOptions, type PolicyRow } from "@/lib/api/policies";
import {
  riskSnapshotQueryOptions,
  type AiRiskBriefing,
  type ChokepointRiskRow,
  type HormuzRisk,
  type MacroRiskRow,
  type MacroTrend,
  type PortRiskRow,
} from "@/lib/api/risk";

export const Route = createFileRoute("/policy")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policiesQueryOptions());
    context.queryClient.ensureQueryData(riskSnapshotQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "리스크 인텔리전스 — Logisight" },
      {
        name: "description",
        content: "해상 병목, 항만 혼잡, 규제 이벤트 리스크 모니터.",
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

function toneClasses(tone: "alert" | "caution" | "normal"): string {
  if (tone === "alert") return "border-status-alert/35 bg-status-alert/10 text-status-alert";
  if (tone === "caution")
    return "border-status-caution/35 bg-status-caution/10 text-status-caution";
  return "border-border bg-card text-foreground";
}

function maxDirectionValue(row: ChokepointRiskRow): number {
  return Math.max(1, ...row.directions.map((d) => d.value ?? 0));
}

function highestPortDelay(ports: PortRiskRow[]): PortRiskRow | null {
  return [...ports].sort((a, b) => (b.delayPercent ?? -1) - (a.delayPercent ?? -1))[0] ?? null;
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

function RiskMetricCard({
  label,
  value,
  note,
  spark,
  tone = "normal",
}: {
  label: string;
  value: string;
  note: string;
  spark?: (number | null)[];
  tone?: "alert" | "caution" | "normal";
}) {
  return (
    <div className={["rounded-lg border p-3", toneClasses(tone)].join(" ")}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        {spark && <Sparkline values={spark} color="var(--color-cyan)" />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

function ChokepointCard({ row }: { row: ChokepointRiskRow }) {
  const max = maxDirectionValue(row);
  const tone =
    row.wowPct == null
      ? "normal"
      : Math.abs(row.wowPct) >= 20
        ? "alert"
        : Math.abs(row.wowPct) >= 10
          ? "caution"
          : "normal";

  return (
    <div className={["rounded-lg border p-3", toneClasses(tone)].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">기준 {row.asOf ?? "—"}</p>
        </div>
        <Sparkline values={row.spark} color="var(--color-cyan)" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-muted-foreground">최신</p>
          <p className="font-semibold tabular-nums text-foreground">{fmtTeu(row.latestTotalTeu)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">WoW</p>
          <p className="font-semibold tabular-nums text-foreground">{fmtPct(row.wowPct)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">8주 평균</p>
          <p className="font-semibold tabular-nums text-foreground">{fmtTeu(row.avg8w)}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {row.directions.map((direction) => (
          <div key={direction.code} className="space-y-0.5">
            <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {direction.name} ({direction.code})
              </span>
              <span className="tabular-nums">{fmtTeu(direction.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-[var(--color-cyan)]"
                style={{ width: `${Math.max(2, ((direction.value ?? 0) / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        최신 선박 {row.latestCrossings}척
        {row.topCrossingName ? ` · 최대 ${row.topCrossingName} ${fmtTeu(row.topCrossingTeu)}` : ""}
      </p>
    </div>
  );
}

function PortsHeatmap({ ports }: { ports: PortRiskRow[] }) {
  if (ports.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        EconDB 항만 혼잡 데이터를 가져오지 못했습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">항만</th>
              <th className="px-3 py-2">지연율</th>
              <th className="px-3 py-2">혼잡도</th>
              <th className="px-3 py-2">Import dwell</th>
              <th className="px-3 py-2">Export dwell</th>
              <th className="px-3 py-2">TS dwell</th>
              <th className="px-3 py-2">선석 선박</th>
              <th className="px-3 py-2">TEU MoM</th>
            </tr>
          </thead>
          <tbody>
            {ports.map((port) => {
              const tone = riskTone(port.delayPercent);
              return (
                <tr key={`${port.rank}-${port.name}`} className="border-b border-border/70">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {port.rank ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{port.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[port.country, port.locode].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={["rounded px-2 py-1 font-semibold", toneClasses(tone)].join(" ")}
                    >
                      {fmtPct(port.delayPercent)}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(port.congestion, 1)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDays(port.importDwell)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDays(port.exportDwell)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDays(port.transshipDwell)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(port.vesselsBerthed)}</td>
                  <td className="px-3 py-2 text-[11px] tabular-nums text-muted-foreground">
                    수입 {fmtPct(port.importTeuMom)} · 수출 {fmtPct(port.exportTeuMom)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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

function MacroIndexGrid({ macro }: { macro: MacroRiskRow[] }) {
  if (!macro.length) return null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {macro.map((m) => {
        const isNeg = m.change?.startsWith("-") ?? false;
        return (
          <div key={m.label} className="rounded border border-border bg-background/60 p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {fmtNum(m.value, 2)}
                </p>
              </div>
              {(m.spark?.length ?? 0) > 1 && (
                <Sparkline
                  values={m.spark}
                  color={isNeg ? "var(--color-status-alert)" : "var(--color-status-normal)"}
                />
              )}
            </div>
            {m.change && (
              <p
                className={[
                  "mt-0.5 text-[11px] font-medium tabular-nums",
                  isNeg ? "text-status-alert" : "text-status-normal",
                ].join(" ")}
              >
                {m.change}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">{m.asOf ?? "—"}</p>
          </div>
        );
      })}
    </div>
  );
}

function HormuzPanel({ hormuz }: { hormuz: HormuzRisk }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold">호르무즈 상황판</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Persian Gulf 선박 수와 Strait of Hormuz 일별 통항 상세
            </p>
          </div>
          <Sparkline values={hormuz.gulfShipSpark} color="var(--color-cyan)" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Gulf 선박 수</p>
            <p className="text-lg font-semibold tabular-nums">{fmtNum(hormuz.gulfShipCount)}</p>
            <p className="text-[11px] text-muted-foreground">
              7일 변화 {fmtPct(hormuz.gulfShipWowPct)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">통항 기준일</p>
            <p className="text-lg font-semibold tabular-nums">{hormuz.crossingDate}</p>
            <p className="text-[11px] text-muted-foreground">
              {hormuz.crossingCount}척 · DWT {fmtNum(hormuz.totalDwt)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">방향 0 / 1</p>
            <p className="font-semibold tabular-nums">
              {hormuz.eastbound} / {hormuz.westbound}척
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">유조선 / 벌크</p>
            <p className="font-semibold tabular-nums">
              {hormuz.tankerCount} / {hormuz.bulkCount}척
            </p>
          </div>
        </div>
        <MacroIndexGrid macro={hormuz.macro} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold">호르무즈 최근 뉴스</h2>
        <div className="mt-3 space-y-3">
          {hormuz.news.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Shipfinder 뉴스 데이터를 가져오지 못했습니다.
            </p>
          ) : (
            hormuz.news.slice(0, 3).map((news) => (
              <a
                key={`${news.url}-${news.title}`}
                href={news.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-border bg-background/60 p-3 hover:bg-muted/50"
              >
                <p className="text-sm font-medium text-foreground">{news.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {[news.source, news.publishedAt].filter(Boolean).join(" · ") || "—"}
                </p>
                {news.summary && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {news.summary}
                  </p>
                )}
              </a>
            ))
          )}
        </div>
      </div>
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
  const topPort = highestPortDelay(risk.ports);
  const topChokepoint = strongestChokepointMove(risk.chokepoints);

  const statusItems = useMemo(
    (): StatusItem[] => [
      {
        label: "항만 지연 70%+",
        value: delayedPorts === 0 ? "없음" : `${delayedPorts}곳`,
        state: delayedPorts >= 5 ? "alert" : delayedPorts > 0 ? "caution" : "normal",
      },
      {
        label: "초크포인트 변동",
        value: topChokepoint ? `${topChokepoint.name} ${fmtPct(topChokepoint.wowPct)}` : "—",
        state:
          Math.abs(topChokepoint?.wowPct ?? 0) >= 20
            ? "alert"
            : Math.abs(topChokepoint?.wowPct ?? 0) >= 10
              ? "caution"
              : "normal",
      },
      {
        label: "호르무즈 통항",
        value: `${risk.hormuz.crossingCount}척`,
        state: risk.hormuz.crossingCount === 0 ? "caution" : "normal",
      },
      {
        label: "DB 이벤트",
        value: `${policies.length}건 · 예정 ${upcoming30}건`,
        state: highCount > 0 ? "alert" : unverified > 0 ? "caution" : "normal",
      },
    ],
    [
      policies.length,
      upcoming30,
      highCount,
      unverified,
      delayedPorts,
      topChokepoint,
      risk.hormuz.crossingCount,
    ],
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
      eyebrow="Risk Intelligence"
      title="리스크"
      titleAccent="인텔리전스"
      subtitle="해상 병목·항만 혼잡·초크포인트·호르무즈 통항을 모니터링합니다."
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
      <StatusStrip items={statusItems} />

      <section>
        <div className="mb-2">
          <h2 className="text-[13px] font-semibold">실시간 리스크 개요</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            EconDB·Shipfinder API를 서버에서 직접 수집해 항만 혼잡, 초크포인트 TEU, 호르무즈 통항,
            매크로 지표를 화면에 표시합니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RiskMetricCard
            label="최고 항만 지연율"
            value={topPort ? `${topPort.name} ${fmtPct(topPort.delayPercent)}` : "—"}
            note={
              topPort
                ? `${topPort.country ?? "—"} · 혼잡도 ${fmtNum(topPort.congestion, 1)} · Import dwell ${fmtDays(topPort.importDwell)}`
                : "EconDB 항만 데이터 없음"
            }
            tone={riskTone(topPort?.delayPercent)}
          />
          <RiskMetricCard
            label="초크포인트 최대 변동"
            value={topChokepoint ? `${topChokepoint.name} ${fmtPct(topChokepoint.wowPct)}` : "—"}
            note={
              topChokepoint
                ? `${fmtTeu(topChokepoint.latestTotalTeu)} · 기준 ${topChokepoint.asOf ?? "—"}`
                : "EconDB 초크포인트 데이터 없음"
            }
            spark={topChokepoint?.spark}
            tone={
              Math.abs(topChokepoint?.wowPct ?? 0) >= 20
                ? "alert"
                : Math.abs(topChokepoint?.wowPct ?? 0) >= 10
                  ? "caution"
                  : "normal"
            }
          />
          <RiskMetricCard
            label="Persian Gulf 선박"
            value={fmtNum(risk.hormuz.gulfShipCount)}
            note={`${risk.hormuz.asOf ?? "—"} · 7일 변화 ${fmtPct(risk.hormuz.gulfShipWowPct)}`}
            spark={risk.hormuz.gulfShipSpark}
            tone={Math.abs(risk.hormuz.gulfShipWowPct ?? 0) >= 15 ? "caution" : "normal"}
          />
          <RiskMetricCard
            label="호르무즈 일별 통항"
            value={`${risk.hormuz.crossingCount}척`}
            note={`${risk.hormuz.crossingDate} · 유조선 ${risk.hormuz.tankerCount}척 · 벌크 ${risk.hormuz.bulkCount}척`}
            tone={risk.hormuz.crossingCount === 0 ? "caution" : "normal"}
          />
        </div>
      </section>

      <AiRiskBriefingPanel briefing={risk.hormuz.aiRiskBriefing} />

      <section>
        <div className="mb-2">
          <h2 className="text-[13px] font-semibold">초크포인트 TEU 흐름</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Suez, Panama, Cape, Malacca, Hormuz의 방향별 통과 TEU와 최신 선박 통항 데이터를 함께
            표시합니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {risk.chokepoints.map((row) => (
            <ChokepointCard key={row.name} row={row} />
          ))}
        </div>
      </section>

      <HormuzPanel hormuz={risk.hormuz} />

      <section>
        <div className="mb-2">
          <h2 className="text-[13px] font-semibold">전세계 항만 Top 20</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            지연율 75% 이상은 alert, 60% 이상은 caution으로 표시합니다. dwell time과 TEU MoM은 같은
            항만 행에서 비교합니다.
          </p>
        </div>
        <PortsHeatmap ports={risk.ports} />
      </section>

      <section>
        <div className="mb-2">
          <h2 className="text-[13px] font-semibold">글로벌 TEU·운임 매크로</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Global exports, Shanghai freight index, Global TEU liftings를 최신 기준일과 변화율로
            표시합니다.
          </p>
        </div>
        <MacroTrendGrid trends={risk.macroTrends} />
      </section>

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
