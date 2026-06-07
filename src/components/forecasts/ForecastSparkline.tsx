import type { ForecastSeries } from "@/lib/api/forecasts";

// 그림이 결론을 말하는 층: 발행 전 이력 라인(실선) + 발행 후 실측 점(구분 마커) +
// published_at "전망 구간" 구분선 + horizon까지 range_low/high 예측 콘. 단일 청색(방향색 아님).
type Props = {
  series: ForecastSeries | undefined;
  valueAtPublish: number | null | undefined;
  rangeLowPct: number | null | undefined;
  rangeHighPct: number | null | undefined;
  mini?: boolean; // 카드용: 축·라벨·값·구분선 생략, 라인+콘만
  colorClass?: string; // 방향 토큰(text-direction-up/down/flat). 기본 청색.
  className?: string;
};

const ms = (d: string) => Date.parse(d.length <= 7 ? `${d}-01` : d);
const monthLabel = (d: string) => `${Number(d.slice(5, 7))}월`;

export function ForecastSparkline({ series, valueAtPublish, rangeLowPct, rangeHighPct, mini, colorClass, className }: Props) {
  const points = series?.points ?? [];
  const actuals = series?.actuals ?? [];
  const horizon = series?.horizon_date ?? null;
  const publishedAt = series?.published_at ? String(series.published_at).slice(0, 10) : null;

  const W = 600;
  const H = mini ? 64 : 200;
  const PAD = mini ? { top: 6, right: 8, bottom: 6, left: 6 } : { top: 18, right: 56, bottom: 26, left: 12 };

  if (points.length === 0 && valueAtPublish == null) {
    return (
      <div className={`flex items-center justify-center text-xs text-muted-foreground ${className ?? ""}`} style={{ height: H }}>
        시계열 데이터 수집 중
      </div>
    );
  }

  const pub = valueAtPublish ?? points[points.length - 1]?.value ?? null;
  const hasCone = pub != null && horizon != null && (rangeLowPct != null || rangeHighPct != null);
  const lo = hasCone && pub != null ? pub * (1 + (rangeLowPct ?? 0) / 100) : null;
  const hi = hasCone && pub != null ? pub * (1 + (rangeHighPct ?? 0) / 100) : null;

  const allDates = [...points, ...actuals].map((p) => ms(p.date));
  const t0 = Math.min(...(allDates.length ? allDates : [Date.now()]));
  const t1 = horizon ? ms(horizon) : Math.max(...(allDates.length ? allDates : [Date.now()]));
  const toX = (t: number) => (t1 === t0 ? PAD.left : PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right));

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
  const toY = (v: number) => PAD.top + (1 - (v - (yMin - yPad)) / (span + 2 * yPad)) * (H - PAD.top - PAD.bottom);

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(ms(p.date)).toFixed(1)},${toY(p.value).toFixed(1)}`).join(" ");
  const pubT = publishedAt ? ms(publishedAt) : points.length ? ms(points[points.length - 1].date) : t0;
  const pubX = toX(pubT);
  const pubY = pub != null ? toY(pub) : null;
  const hx = toX(t1);
  const conePath =
    hasCone && pubY != null && hi != null && lo != null
      ? `M${pubX.toFixed(1)},${pubY.toFixed(1)} L${hx.toFixed(1)},${toY(hi).toFixed(1)} L${hx.toFixed(1)},${toY(lo).toFixed(1)} Z`
      : null;

  const labelEvery = Math.max(1, Math.ceil(points.length / 4));
  const ticks = points.filter((_, i) => i % labelEvery === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${colorClass ?? "text-status-observe"} ${className ?? ""}`} role="img" aria-label="운임 시계열과 예측 범위" preserveAspectRatio="none">
      {conePath && <path d={conePath} fill="currentColor" opacity={0.16} />}
      {hasCone && pubY != null && hi != null && lo != null && (
        <>
          <line x1={pubX} y1={pubY} x2={hx} y2={toY(hi)} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <line x1={pubX} y1={pubY} x2={hx} y2={toY(lo)} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          {!mini && rangeHighPct != null && (
            <text x={hx + 6} y={toY(hi) + 4} className="fill-current text-[11px]">{rangeHighPct > 0 ? "+" : ""}{rangeHighPct}%</text>
          )}
          {!mini && rangeLowPct != null && (
            <text x={hx + 6} y={toY(lo) + 4} className="fill-current text-[11px]">{rangeLowPct > 0 ? "+" : ""}{rangeLowPct}%</text>
          )}
        </>
      )}

      {/* 전망 구간 구분선(발행 시점) — full only */}
      {!mini && publishedAt && (
        <>
          <line x1={pubX} y1={PAD.top} x2={pubX} y2={H - PAD.bottom} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" opacity={0.35} />
          <text x={pubX + 4} y={PAD.top + 9} className="fill-muted-foreground text-[10px]">전망 구간</text>
        </>
      )}

      {lineD && <path d={lineD} fill="none" stroke="currentColor" strokeWidth={mini ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />}

      {pub != null && pubY != null && (
        <>
          <circle cx={pubX} cy={pubY} r={mini ? 2.5 : 4} fill="currentColor" />
          {!mini && (
            <text x={pubX} y={pubY - 10} textAnchor="middle" className="fill-foreground text-[12px] font-medium">
              {Math.round(pub).toLocaleString()}
            </text>
          )}
        </>
      )}

      {/* 발행 후 실측 점 — 청색 링(이력 점과 구분) */}
      {actuals.map((p) => (
        <circle key={p.date} cx={toX(ms(p.date))} cy={toY(p.value)} r={mini ? 2.5 : 3.5} className="fill-card stroke-current" strokeWidth={2} />
      ))}

      {!mini &&
        ticks.map((p) => (
          <text key={p.date} x={toX(ms(p.date))} y={H - 7} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {monthLabel(p.date)}
          </text>
        ))}
      {!mini && horizon && (
        <text x={hx} y={H - 7} textAnchor="end" className="fill-muted-foreground text-[11px]">
          {`${Number(horizon.slice(5, 7))}/${Number(horizon.slice(8, 10))} 판정`}
        </text>
      )}
    </svg>
  );
}
