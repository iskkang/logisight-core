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
      { title: "정책·리스크 — Logisight" },
      {
        name: "description",
        content: "물류 정책 시행 타임라인, 영향 매트릭스, 출처·검증 현황.",
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

// --- Policy page ---
function PolicyPage() {
  const { data: policies } = useSuspenseQuery(policiesQueryOptions());
  const [selected, setSelected] = useState<PolicyRow | null>(null);

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

  const statusItems = useMemo((): StatusItem[] => [
    {
      label: "전체",
      value: `${policies.length}건`,
      state: "normal",
    },
    {
      label: "30일 이내 시행",
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
  ], [policies, upcoming30, highCount, unverified]);

  // Exposure matrix columns
  const COLS: ColDef<PolicyRow>[] = [
    {
      key: "title_ko",
      header: "정책·리스크",
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
      header: "시행일",
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
                  d <= 30 ? "bg-status-alert/10 text-status-alert" : "bg-status-caution/10 text-status-caution",
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
    <DashboardShell title="정책·리스크" subtitle="물류 정책 시행 타임라인 및 영향 매트릭스">
      <StatusStrip items={statusItems} />

      {/* Timeline — 180일 */}
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">시행 타임라인 — 향후 180일</h2>
        <div className="relative h-16 overflow-hidden rounded-lg border border-border bg-card px-5">
          {/* Axis line */}
          <div className="absolute bottom-4 left-5 right-5 h-px bg-border" />
          {/* Axis labels */}
          <span className="absolute bottom-1 left-5 text-[10px] text-muted-foreground">오늘</span>
          <span className="absolute bottom-1 text-[10px] text-muted-foreground" style={{ left: "calc(16.7% + 1.25rem)" }}>30일</span>
          <span className="absolute bottom-1 text-[10px] text-muted-foreground" style={{ left: "calc(50% + 1.25rem)" }}>90일</span>
          <span className="absolute bottom-1 right-5 text-[10px] text-muted-foreground">180일</span>

          {timelinePolicies.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              180일 이내 시행 예정 정책 없음
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

      {/* Exposure matrix */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">
          정책 영향 매트릭스{" "}
          <span className="text-[11px] font-normal text-muted-foreground">행 클릭 시 상세</span>
        </h2>
        {policies.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            정책 데이터 수집 중 — 어드민에서 입력하세요
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
          현재 {policies.length}건 입력 · 검증 전 정책은 "검증 전" 배지 표시 · 출처 확인 후 last_verified_at 갱신 필요
        </p>
      </section>

      <DataQualityBar
        sources={[
          {
            label: "정책 DB",
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
        <span><SevBadge sev={policy.severity} /></span>
        <span className="text-muted-foreground">시행일</span>
        <span>
          {policy.effective_date ?? "—"}
          {d !== null && d >= 0 && (
            <span className="ml-1.5 text-muted-foreground">(D−{d})</span>
          )}
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
