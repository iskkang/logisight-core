import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { IntelTable, type ColDef } from "@/components/dashboard/IntelTable";
import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { DataQualityBar } from "@/components/dashboard/DataQualityBar";

import { policiesQueryOptions, type PolicyRow } from "@/lib/api/policies";

export const Route = createFileRoute("/policy")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policiesQueryOptions());
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

const RISK_SOURCES = [
  {
    group: "Hormuz·Persian Gulf",
    note: "선박 체류, 호르무즈 통항, 최근 뉴스, 매크로 지표",
    links: [
      [
        "Persian Gulf ships",
        "https://www.shipfinder.com/Special/ShipsInPersianGulfDetail?date=2026-06-04",
      ],
      [
        "Hormuz crossings",
        "https://www.shipfinder.com/Special/CrossStraitOfHormuzDetail?date=2026-06-04",
      ],
      [
        "Hormuz recent news",
        "https://www.shipfinder.com/Special/GetHormuzNewsRecent?skip=0&limit=50",
      ],
      ["Hormuz AI judge", "https://www.shipfinder.com/Special/CallAiToJudge"],
      ["Persian Gulf stats", "https://www.shipfinder.com/Special/ShipsInPersianGulfStats"],
      ["Macro index", "https://www.shipfinder.com/Special/GetMacroIndexLatest"],
    ],
  },
  {
    group: "Top Ports",
    note: "전세계 항만 Top 20, dwell time, congestion, delay, turnaround",
    links: [
      [
        "EconDB ports top 20",
        "https://www.econdb.com/maritime/search/ports/?page_size=20&page=1&s=&fl=rank%2Cname%2Clocode%2Clast_import_teu%2Clast_export_teu%2Cimport_dwell_time%2Cexport_dwell_time%2Cts_dwell_time%2Cschedule%2Ctransshipments%2Creefer%2Cport_congestion%2Cdelay_percent%2Cregion%2Cvessels_berthed%2Cturnaround%2Clast_export_teu_mom%2Clast_import_teu_mom%2Cglobal_trade%2Ccountry%2Cid%2Crank",
      ],
    ],
  },
  {
    group: "Chokepoints",
    note: "Suez, Panama, Cape, Malacca, Hormuz 최신 통항과 TEU 방향별 흐름",
    links: [
      [
        "Suez data",
        "https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=Suez",
      ],
      ["Suez latest", "https://www.econdb.com/maritime/latest_crossings/?chokepoint_name=Suez"],
      [
        "Panama data",
        "https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=Panama",
      ],
      ["Panama latest", "https://www.econdb.com/maritime/latest_crossings/?chokepoint_name=Panama"],
      [
        "Cape data",
        "https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=Cape",
      ],
      [
        "Malacca data",
        "https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=Malacca",
      ],
      [
        "Hormuz data",
        "https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=Hormuz",
      ],
    ],
  },
  {
    group: "Trade·Freight Macro",
    note: "Global exports, SCFI, global TEU liftings",
    links: [
      [
        "Global exports TEU",
        "https://www.econdb.com/widgets/global-trade/data/?type=export&net=0&transform=0&freq=month",
      ],
      ["SCFI", "https://www.econdb.com/widgets/shanghai-containerized-index/data/"],
      ["Global TEU liftings", "https://www.econdb.com/widgets/global-seasonal/data/"],
    ],
  },
] as const;

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

// --- Policy page ---
function PolicyPage() {
  const { data: policies } = useSuspenseQuery(policiesQueryOptions());
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

  const today = new Date();
  const horizon = new Date(today.getTime() + 180 * 86400000);
  const horizonMs = horizon.getTime() - today.getTime();

  // Timeline policies: effective_date within 180 days from today
  const timelinePolicies = useMemo(
    () =>
      policies.filter((p) => {
        if (!p.effective_date) return false;
        const d = new Date(p.effective_date);
        return d >= today && d <= horizon;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policies],
  );

  function timelinePct(dateStr: string): number {
    const ms = new Date(dateStr).getTime() - today.getTime();
    return Math.max(0, Math.min(97, (ms / horizonMs) * 100));
  }

  // StatusStrip
  const highCount = policies.filter((p) => p.severity === "high").length;
  const unverified = policies.filter((p) => !p.last_verified_at).length;
  const upcoming30 = policies.filter((p) => {
    if (!p.effective_date) return false;
    const d = daysUntil(p.effective_date);
    return d >= 0 && d <= 30;
  }).length;

  const statusItems = useMemo(
    (): StatusItem[] => [
      {
        label: "전체",
        value: `${policies.length}건`,
        state: "normal",
      },
      {
        label: "30일 이내 예정",
        value: upcoming30 === 0 ? "없음" : `${upcoming30}건`,
        state: upcoming30 === 0 ? "normal" : upcoming30 >= 2 ? "alert" : "caution",
      },
      {
        label: "높음 심각도",
        value: highCount === 0 ? "없음" : `${highCount}건`,
        state: highCount === 0 ? "normal" : "alert",
      },
      {
        label: "검증 전",
        value: unverified === 0 ? "없음" : `${unverified}건`,
        state: unverified === 0 ? "normal" : "caution",
      },
    ],
    [policies, upcoming30, highCount, unverified],
  );

  // 대응 체크리스트 — 향후 90일 이벤트 (실데이터)
  const imminentPolicies = useMemo(
    () =>
      policies
        .filter((p) => {
          if (!p.effective_date) return false;
          const d = daysUntil(p.effective_date);
          return d >= 0 && d <= 90;
        })
        .sort((a, b) => a.effective_date!.localeCompare(b.effective_date!)),
    [policies],
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

  // Exposure matrix columns
  const COLS: ColDef<PolicyRow>[] = [
    {
      key: "title_ko",
      header: "리스크 이벤트",
      cell: (r) => (
        <div>
          <span className="font-medium text-foreground">{r.title_ko}</span>
          {!r.last_verified_at && (
            <span className="ml-1.5 rounded bg-status-caution/10 px-1 py-0.5 text-[10px] text-status-caution">
              검증 전
            </span>
          )}
        </div>
      ),
    },
    {
      key: "region",
      header: "지역·국가",
      cell: (r) => (
        <span className="text-muted-foreground">
          {[r.region, r.country_code].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "policy_type",
      header: "유형",
      cell: (r) => <span className="text-muted-foreground text-[11px]">{r.policy_type}</span>,
    },
    {
      key: "affected_hs_chapters",
      header: "영향 HS",
      cell: (r) =>
        r.affected_hs_chapters && r.affected_hs_chapters.length > 0
          ? r.affected_hs_chapters.slice(0, 3).join(", ")
          : "—",
    },
    {
      key: "effective_date",
      header: "발효일",
      cell: (r) => {
        if (!r.effective_date) return <span className="text-muted-foreground">—</span>;
        const d = daysUntil(r.effective_date);
        return (
          <div suppressHydrationWarning className="tabular-nums">
            <span>{r.effective_date}</span>
            {d >= 0 && d <= 90 && (
              <span
                className={[
                  "ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium",
                  d <= 30
                    ? "bg-status-alert/10 text-status-alert"
                    : "bg-status-caution/10 text-status-caution",
                ].join(" ")}
              >
                D−{d}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "severity",
      header: "심각도",
      cell: (r) => <SevBadge sev={r.severity} />,
    },
  ];

  return (
    <DashboardShell
      title="리스크 인텔리전스"
      subtitle="해상 병목·항만 혼잡·규제 이벤트 리스크 모니터"
      toolbar={
        <button
          type="button"
          onClick={() => setShowImpact((v) => !v)}
          className={[
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            showImpact
              ? "border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          ].join(" ")}
        >
          {showImpact ? "분석 닫기" : "내 화물 영향 분석"}
        </button>
      }
    >
      <StatusStrip items={statusItems} />

      {/* 외부 리스크 소스 */}
      <section>
        <div className="mb-2">
          <h2 className="text-[13px] font-semibold">외부 리스크 소스</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            아직 DB 자동 수집 전 단계입니다. 원천 링크를 보존하고, 수집 파이프라인 연결 전에는
            무리하게 "리스크 없음"으로 표시하지 않습니다.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {RISK_SOURCES.map((source) => (
            <div key={source.group} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-semibold">{source.group}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{source.note}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {source.links.map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-border px-2 py-0.5 text-[11px] text-primary hover:bg-muted"
                  >
                    {label}↗
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
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

      {/* Timeline — 180일 */}
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">리스크 타임라인 — 향후 180일</h2>
        <div className="relative h-16 overflow-hidden rounded-lg border border-border bg-card px-5">
          {/* Axis line */}
          <div className="absolute bottom-4 left-5 right-5 h-px bg-border" />
          {/* Axis labels */}
          <span className="absolute bottom-1 left-5 text-[10px] text-muted-foreground">오늘</span>
          <span
            className="absolute bottom-1 text-[10px] text-muted-foreground"
            style={{ left: "calc(16.7% + 1.25rem)" }}
          >
            30일
          </span>
          <span
            className="absolute bottom-1 text-[10px] text-muted-foreground"
            style={{ left: "calc(50% + 1.25rem)" }}
          >
            90일
          </span>
          <span className="absolute bottom-1 right-5 text-[10px] text-muted-foreground">180일</span>

          {timelinePolicies.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              DB에 입력된 180일 이내 예정 이벤트 없음
            </p>
          ) : (
            timelinePolicies.map((p) => {
              const pct = timelinePct(p.effective_date!);
              const color = SEV_COLOR[p.severity] ?? SEV_COLOR.info;
              const d = daysUntil(p.effective_date!);
              return (
                <div
                  key={p.id}
                  className="absolute bottom-3 flex cursor-pointer flex-col items-center"
                  style={{ left: `calc(${pct}% + 1.25rem)`, transform: "translateX(-50%)" }}
                  onClick={() => setSelected(p)}
                  title={p.title_ko}
                >
                  <span className="mb-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
                    {p.title_ko.length > 10 ? `${p.title_ko.slice(0, 10)}…` : p.title_ko} D−{d}
                  </span>
                  <span
                    className="h-3 w-3 rounded-full border-2"
                    style={{ background: color, borderColor: color }}
                  />
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 대응 체크리스트 */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold">
            대응 체크리스트{" "}
            <span className="text-[11px] font-normal text-muted-foreground">
              향후 90일 예정 이벤트
            </span>
          </h2>
          {checkedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setCheckedIds(new Set())}
              className="text-[11px] text-muted-foreground hover:underline"
            >
              체크 초기화
            </button>
          )}
        </div>
        <PolicyChecklist
          items={imminentPolicies}
          checkedIds={checkedIds}
          onToggle={toggleChecked}
          onSelect={setSelected}
          emptyText="DB에 입력된 90일 이내 예정 이벤트 없음"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          실제 리스크 이벤트 행에서 생성 · 체크 상태는 저장되지 않는 점검용 보조 기능
        </p>
      </section>

      {/* Exposure matrix */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">
          입력된 리스크 이벤트{" "}
          <span className="text-[11px] font-normal text-muted-foreground">행 클릭 시 상세</span>
        </h2>
        {policies.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            리스크 이벤트 데이터 수집 중 — 어드민에서 입력하세요
          </div>
        ) : (
          <IntelTable
            cols={COLS}
            rows={policies}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelected(r)}
          />
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          현재 {policies.length}건 입력 · 검증 전 이벤트는 "검증 전" 배지 표시 · 출처 확인 후
          last_verified_at 갱신 필요
        </p>
      </section>

      <DataQualityBar
        sources={[
          {
            label: "리스크 DB",
            asOf: policies.at(0)?.updated_at?.slice(0, 10) ?? null,
            expectedDays: 30,
          },
        ]}
      />

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
