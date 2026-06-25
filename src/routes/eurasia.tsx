import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { operationalCurrentDelayQueryOptions } from "@/lib/api/operational-delay";
import LogisightEurasia, {
  type CorridorRecord,
  type SourceStatus as EuSourceStatus,
} from "@/components/eurasia-page/LogisightEurasia";
import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";

export const Route = createFileRoute("/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(operationalCurrentDelayQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "유라시아 코리도어 — Logisight" },
      {
        name: "description",
        content:
          "TCR(중국횡단철도) 노선의 운영 상태·ETA 지연을 한눈에. 지연은 최초 관측 ETA(baseline) 대비로 산출합니다.",
      },
    ],
  }),
  component: EurasiaPage,
});

function EurasiaPage() {
  const { data: operational } = useSuspenseQuery(operationalCurrentDelayQueryOptions());

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
      // 영향 컨테이너(active_delayed_count)는 회사 기밀 — 외부 페이지에 노출/전송하지 않는다.
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
      />
      <HomeFooter />
    </div>
  );
}
