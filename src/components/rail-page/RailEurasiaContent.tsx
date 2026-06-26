// 유라시아 철도 콘텐츠 — 기존 /eurasia 페이지의 데이터 변환 + LogisightEurasia 렌더만 추출(로직 보존).
// 체크롬(HomeNav·InsightSubNav·Footer)은 /rail 레이아웃이 제공하므로 여기선 콘텐츠만 렌더.
import { useSuspenseQuery } from "@tanstack/react-query";

import { operationalCurrentDelayQueryOptions } from "@/lib/api/operational-delay";
import { latestNewsQueryOptions } from "@/lib/api/news";
import LogisightEurasia, {
  type CorridorRecord,
  type SourceStatus as EuSourceStatus,
} from "@/components/eurasia-page/LogisightEurasia";
import { EraiWidget, RailNewsFeed } from "./RailWidgets";

export function RailEurasiaContent() {
  const { data: operational } = useSuspenseQuery(operationalCurrentDelayQueryOptions());
  const { data: news } = useSuspenseQuery(latestNewsQueryOptions({ category: "철도", lang: "en", limit: 20 }));

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
    }));

  // 수동 입력(자동 파이프라인 밖, 어드민 수기 레이어 성격의 실정보): 인천-청도-알마티.
  // 청도 40일 대기 후 발차, 기준 리드타임 40일 → 현재 70일+ (지연 약 30일). 일반 지연 행으로 표기.
  tcrRecords.push({
    route_label: "인천 → 청도 → 알마티",
    note: "청도 40일 대기 후 발차 · 기준 40일 → 현재 70일+",
    original_eta: null,
    current_eta: null,
    delay_days: 30,
  });
  tcrRecords.sort((a, b) => (b.delay_days ?? 0) - (a.delay_days ?? 0));

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
    <>
      <LogisightEurasia
        showNav={false}
        records={tcrRecords}
        sources={eurasiaSources}
        updatedLabel={updatedLabel}
      />
      <EraiWidget />
      <RailNewsFeed
        title="유라시아 철도 뉴스"
        chip="index1520 메타피드"
        items={news}
        emptyText="수집된 유라시아 철도 뉴스가 없습니다."
      />
    </>
  );
}
