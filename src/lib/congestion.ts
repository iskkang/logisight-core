// 혼잡도 심각도 — 지연일(median/p90 delay)을 4단계로 정규화.
// 단일 소스로 유지해 임계값을 한 곳에서 조정한다. (기존 eurasia tierOf 임계와 정렬)
export type Severity = "severe" | "moderate" | "warning" | "normal";

// delayDays = 평시 대비 추가 지연(일). null = 데이터 없음.
export function congestionSeverity(delayDays: number | null | undefined): Severity | null {
  if (delayDays == null || Number.isNaN(delayDays)) return null;
  if (delayDays >= 7) return "severe"; // 7일+ : 심각
  if (delayDays >= 3) return "moderate"; // 3–7일 : 명백히 평시 이상
  if (delayDays >= 1) return "warning"; // 1–3일 : 소폭 상승
  return "normal"; // 0일 : 유의미한 문제 없음
}

// 심각도별 표기 — 색은 두 테마(라이트/다크) 모두에서 읽히는 채도 높은 고정색.
// (지도 마커/라인 전용. 카드·텍스트 등 UI 크롬은 CSS 토큰 사용)
export const SEVERITY_META: Record<
  Severity,
  { label: string; color: string; rank: number }
> = {
  severe: { label: "심각", color: "#ef4444", rank: 3 }, // red
  moderate: { label: "중간", color: "#f97316", rank: 2 }, // orange
  warning: { label: "주의", color: "#eab308", rank: 1 }, // yellow
  normal: { label: "정상", color: "#64748b", rank: 0 }, // slate/gray
};

export const NO_DATA_COLOR = "#475569";

export function severityColor(s: Severity | null): string {
  return s ? SEVERITY_META[s].color : NO_DATA_COLOR;
}

// 활성 장애(disruption)의 자체 등급 → 심각도. 지연일이 0이어도 장애는 최소 등급을 반영.
export function disruptionLevelToSeverity(level: "high" | "medium" | "low"): Severity {
  return level === "high" ? "severe" : level === "medium" ? "moderate" : "warning";
}

// 두 심각도 중 더 심한 쪽.
export function worstSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_META[b].rank > SEVERITY_META[a].rank ? b : a;
}
