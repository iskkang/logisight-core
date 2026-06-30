// 극단·비표준 수치에 맥락을 붙이는 공통 배지. 네이티브 title 툴팁(SSR 안전·JS 불필요)으로
// "숨기지 않고 설명한다" 원칙을 구현한다. 값은 그대로 두고 옆에 배지만 덧붙인다.
type Kind = "stat" | "estimate" | "ai-draft";

const PRESET: Record<Kind, { label: string; title: string; cls: string }> = {
  // 신고/통계 기준 극저가 레인 — 실제 all-in 견적과 차이 가능.
  stat: {
    label: "통계 기준",
    title:
      "통계상 극저가 레인 · 실제 all-in 견적과 차이 가능. 일부 단거리 항로는 신고/통계 기준상 극저가로 집계될 수 있습니다. 실제 선사 all-in rate, THC, local charge, surcharge는 별도 확인이 필요합니다.",
    cls: "border-[#fed7aa] bg-[#fff7ed] text-[#b54708]",
  },
  estimate: {
    label: "추정",
    title: "산정 방식: 공개 집계 지표 기반 추정값입니다. 단정이 아닌 추정·정합 관점으로 제공됩니다.",
    cls: "border-[#dbeafe] bg-[#eff6ff] text-[#1d4ed8]",
  },
  "ai-draft": {
    label: "AI 초안",
    title: "AI가 생성한 초안으로, 에디터 검수 전 상태입니다.",
    cls: "border-[#ccfbf1] bg-[#e9f8f4] text-[#0d9488]",
  },
};

export function StatBadge({ kind = "stat", className = "" }: { kind?: Kind; className?: string }) {
  const p = PRESET[kind];
  return (
    <span
      title={p.title}
      className={`ml-1 inline-flex cursor-help select-none items-center rounded-[5px] border px-1.5 py-px align-middle text-[10px] font-bold leading-none ${p.cls} ${className}`}
    >
      {p.label}
    </span>
  );
}

// 해상 $/FEU(또는 $/TEU) 극저가(신고/통계 artifact) 판정 — 정상 운임은 수백~수천 USD 수준이라
// 100 USD 미만은 통계 기준 극저가로 본다(예: $1/FEU, $54 권역값).
export function isStatLowOceanUsd(usd: number | null | undefined): boolean {
  return usd != null && Number.isFinite(usd) && usd > 0 && usd < 100;
}
