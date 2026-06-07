// KPI 5칸 — 전부 실데이터. 합성 "운임 압력 N/10" 금지.
// ②종합 판단만 방향색(적/녹/황), 나머지는 중립/위험색.
export type DashboardKpiData = {
  alertCount: number;
  alertState: "normal" | "caution" | "alert";
  judgment: { glyph: string; label: string; range: string | null; dir: "up" | "down" | "flat" } | null;
  awaiting: number;
  laneCount: number;
  indexCount: number;
};

const DIR_TEXT: Record<string, string> = {
  up: "text-direction-up",
  down: "text-direction-down",
  flat: "text-direction-flat",
};

function Cell({ label, children, sub }: { label: string; children: React.ReactNode; sub: string }) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums text-heading">{children}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

export function DashboardKpis({ data }: { data: DashboardKpiData }) {
  const { alertCount, alertState, judgment, awaiting, laneCount, indexCount } = data;
  const alertColor =
    alertState === "alert" ? "text-status-alert" : alertState === "caution" ? "text-status-caution" : "text-heading";
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card sm:flex-row sm:divide-x sm:divide-y-0">
      <Cell label="오늘의 경보" sub="경고 + 주의">
        <span className={alertColor}>{alertCount}건</span>
      </Cell>
      <Cell label="종합 판단 · 대표 전망(KCCI)" sub="방향 + 예상 밴드">
        {judgment ? (
          <span className={DIR_TEXT[judgment.dir]}>
            {judgment.glyph} {judgment.label}
            {judgment.range ? ` ${judgment.range}%` : ""}
          </span>
        ) : (
          <span className="text-base font-semibold text-muted-foreground">데이터 수집 중</span>
        )}
      </Cell>
      <Cell label="판정 대기" sub="확인 대기 중인 전망">
        {awaiting}건
      </Cell>
      <Cell label="모니터링 노선" sub="KEY_LANES 고정">
        {laneCount}
      </Cell>
      <Cell label="추적 지수" sub="freight_indices 계열">
        {indexCount}
      </Cell>
    </div>
  );
}
