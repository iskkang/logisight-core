// G — 방법론 스트립(실제 파이프라인만 기술). Z-Score·50+ 지표 등 시안 문구 사용 금지.
const STEPS = [
  { t: "데이터 수집", d: "관세청·Drewry·상하이해운거래소·KITA·SCFI/WCI" },
  { t: "5팩터 채점", d: "모멘텀·공급·수요·비용·가격 −2~+2" },
  { t: "가중 합산", d: "해상 공급30·모멘텀25·수요25·비용10·가격10 · 한국발 중국 수급 보정" },
  { t: "AI 산문 + 자동 검증", d: "단정·단위·결측 단정 검사" },
  { t: "에디터 검수 후 발행", d: "발행 후 본문 불변 · 판정일 실측 적중" },
];

export function ForecastMethodology() {
  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5">
      <div className="mb-3 text-sm font-semibold text-foreground">모델 방법론</div>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {STEPS.map((s, i) => (
          <li key={s.t} className="flex flex-1 items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-observe/15 text-[11px] font-bold text-status-observe">
              {i + 1}
            </span>
            <div>
              <div className="text-xs font-semibold text-foreground">{s.t}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.d}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        본 전망은 정보 제공 목적이며 투자·계약 권유가 아닙니다. 결측 팩터는 가중치를 재분배하고,
        인과 단정 없이 상관·정합·추정으로만 기술합니다. 적중률은 발행된 전망 전수를 분모로 합니다.
      </p>
    </section>
  );
}
