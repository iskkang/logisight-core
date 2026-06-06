import type { ForecastSeries } from "@/lib/api/forecasts";

// 그림이 결론을 말하는 층: 이력 라인 + 발행 시점에서 horizon까지 range_low/high 예측 콘 +
// 발행 이후 도착한 실측 점 오버레이. 단일 청색 계열(방향색 아님).
type Props = {
  series: ForecastSeries | undefined;
  valueAtPublish: number | null | undefined;
  rangeLowPct: number | null | undefined;
  rangeHighPct: number | null | undefined;
  className?: string;
};

const W = 600;
const H = 180;
const PAD = { top: 16, right: 56, bottom: 24, left: 12 };

const toX = (t: number, t0: number, t1: number) =>
  t1 === t0 ? PAD.left : PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
const ms = (d: string) => Date.parse(d.length <= 7 ? `${d}-01` : d);
const monthLabel = (d: string) => `${Number(d.slice(5, 7))}월`;

export function ForecastSparkline({ series, valueAtPublish, rangeLowPct, rangeHighPct, className }: Props) {
  const points = series?.points ?? [];
  const actuals = series?.actuals ?? [];
  const horizon = series?.horizon_date ?? null;
  if (points.length === 0 && valueAtPublish == null) {
    return (
      <div className={`flex h-[180px] items-center justify-center text-xs text-muted-foreground ${className ?? ""}`}>
        시계열 데이터 수집 중
      </div>
    );
  }

  const pub = valueAtPublish ?? points[points.length - 1]?.value ?? null;
  const hasCone = pub != null && horizon != null && (rangeLowPct != null || rangeHighPct != null);
  const lo = hasCone && pub != null ? pub * (1 + (rangeLowPct ?? 0) / 100) : null;
  const hi = hasCone && pub != null ? pub * (1 + (rangeHighPct ?? 0) / 100) : null;

  // x 도메인: 가장 이른 관측 ~ horizon(없으면 마지막 관측)
  const allDates = [...points, ...actuals].map((p) => ms(p.date));
  const t0 = Math.min(...(allDates.length ? allDates : [Date.now()]));
  const t1 = horizon ? ms(horizon) : Math.max(...(allDates.length ? allDates : [Date.now()]));

  // y 도메인: 관측 + 콘 경계
  const yVals = [
    ...points.map((p) => p.value),
    ...actuals.map((p) => p.value),
    ...(pub != null ? [pub] : []),
    ...(lo != null ? [lo] : []),
    ...(hi != null ? [hi] : []),
  ];
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const span = yMax - yMin || 1;
  const yPad = span * 0.15;
  const toY = (v: number) =>
    PAD.top + (1 - (v - (yMin - yPad)) / (span + 2 * yPad)) * (H - PAD.top - PAD.bottom);

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(ms(p.date), t0, t1).toFixed(1)},${toY(p.value).toFixed(1)}`)
    .join(" ");

  const pubX = pub != null ? toX(points.length ? ms(points[points.length - 1].date) : t0, t0, t1) : null;
  const pubY = pub != null ? toY(pub) : null;
  const hx = toX(t1, t0, t1);

  // 콘 폴리곤: 발행점 → (horizon hi) → (horizon lo)
  const conePath =
    hasCone && pubX != null && pubY != null && hi != null && lo != null
      ? `M${pubX.toFixed(1)},${pubY.toFixed(1)} L${hx.toFixed(1)},${toY(hi).toFixed(1)} L${hx.toFixed(1)},${toY(lo).toFixed(1)} Z`
      : null;

  // x축 라벨 — 이력 점 중 균등 간격 + horizon
  const labelEvery = Math.max(1, Math.ceil(points.length / 4));
  const ticks = points.filter((_, i) => i % labelEvery === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full text-status-observe ${className ?? ""}`} role="img" aria-label="운임 시계열과 예측 범위">
      {conePath && <path d={conePath} fill="currentColor" opacity={0.16} />}
      {hasCone && pubX != null && pubY != null && hi != null && lo != null && (
        <>
          <line x1={pubX} y1={pubY} x2={hx} y2={toY(hi)} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <line x1={pubX} y1={pubY} x2={hx} y2={toY(lo)} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          {rangeHighPct != null && (
            <text x={hx + 6} y={toY(hi) + 4} className="fill-status-observe text-[11px]">
              {rangeHighPct > 0 ? "+" : ""}{rangeHighPct}%
            </text>
          )}
          {rangeLowPct != null && (
            <text x={hx + 6} y={toY(lo) + 4} className="fill-status-observe text-[11px]">
              {rangeLowPct > 0 ? "+" : ""}{rangeLowPct}%
            </text>
          )}
        </>
      )}

      {lineD && <path d={lineD} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

      {/* 발행 시점 값 점 + 라벨 */}
      {pub != null && pubX != null && pubY != null && (
        <>
          <circle cx={pubX} cy={pubY} r={4} fill="currentColor" />
          <text x={pubX} y={pubY - 10} textAnchor="middle" className="fill-foreground text-[12px] font-medium">
            {Math.round(pub).toLocaleString()}
          </text>
        </>
      )}

      {/* 발행 이후 실측 점(판정 시각화) — 청색 링(이력 점과 구분) */}
      {actuals.map((p) => (
        <circle
          key={p.date}
          cx={toX(ms(p.date), t0, t1)}
          cy={toY(p.value)}
          r={3.5}
          className="fill-card stroke-status-observe"
          strokeWidth={2}
        />
      ))}

      {/* x축 라벨 */}
      {ticks.map((p) => (
        <text key={p.date} x={toX(ms(p.date), t0, t1)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {monthLabel(p.date)}
        </text>
      ))}
      {horizon && (
        <text x={hx} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
          {`${Number(horizon.slice(5, 7))}/${Number(horizon.slice(8, 10))} 판정`}
        </text>
      )}
    </svg>
  );
}
