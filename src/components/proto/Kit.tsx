// 프로토타입(Logisight 인터랙티브 프로토타입) 디자인 시스템의 공용 프리미티브.
// Panel / KpiCard / Badge / DeltaValue / StatusPill / Segment / Spark — 6개 대시보드 페이지 공통.
import type { CSSProperties, ReactNode } from "react";

/* ── Card ── */
export function PCard({
  children,
  pad = "md",
  style,
  className,
  onClick,
}: {
  children: ReactNode;
  pad?: "none" | "md" | "lg";
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  const padding = pad === "none" ? 0 : pad === "lg" ? 22 : 16;
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 12px)",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Panel — 제목 + 배지 + 우측 액션 + 본문 ── */
export function Panel({
  title,
  badge,
  action,
  bodyPad = 18,
  style,
  className,
  children,
}: {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  bodyPad?: number;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={className}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 12px)",
        overflow: "hidden",
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{title}</h2>
        {badge}
        {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
      </header>
      <div style={{ padding: bodyPad }}>{children}</div>
    </section>
  );
}

/* ── Badge ── */
export function PBadge({
  variant = "secondary",
  children,
  style,
}: {
  variant?: "secondary" | "navy" | "outline";
  children: ReactNode;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10.5,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  };
  const byVariant: Record<string, CSSProperties> = {
    secondary: { background: "var(--surface-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" },
    navy: { background: "color-mix(in oklch, var(--navy-600) 12%, transparent)", color: "var(--navy-600)" },
    outline: { background: "transparent", color: "var(--ink-muted)", border: "1px solid var(--border)" },
  };
  return <span style={{ ...base, ...byVariant[variant], ...style }}>{children}</span>;
}

/* ── DeltaValue — ▲/▼ + 부호 퍼센트 (서구식: 상승=녹, 하락=적). null → "—" ── */
export function DeltaValue({
  value,
  decimals = 1,
  size = 12,
  suffix = "%",
}: {
  value: number | null | undefined;
  decimals?: number;
  size?: number;
  suffix?: string;
}) {
  if (value == null || Number.isNaN(value)) {
    return <span style={{ fontSize: size, fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>—</span>;
  }
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? "var(--direction-flat)" : up ? "var(--direction-up)" : "var(--direction-down)";
  const glyph = flat ? "—" : up ? "▲" : "▼";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 3,
        fontSize: size,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: size - 2 }}>{glyph}</span>
      {up ? "+" : ""}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ── StatusPill ── */
export const STATE_COLOR: Record<string, string> = {
  normal: "var(--status-normal)",
  observe: "var(--status-observe)",
  caution: "var(--status-caution)",
  alert: "var(--status-alert)",
};

export function StatusPill({ state, label }: { state: string; label: string }) {
  const c = STATE_COLOR[state] ?? "var(--ink-muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 999,
        color: c,
        background: `color-mix(in oklch, ${c} 13%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {label}
    </span>
  );
}

/* ── Segment — 필터 세그먼트 버튼 ── */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 9,
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: on ? 700 : 500,
              padding: "5px 11px",
              borderRadius: 7,
              fontFamily: "inherit",
              color: on ? "var(--ink)" : "var(--ink-muted)",
              background: on ? "var(--card)" : "transparent",
              boxShadow: on ? "0 1px 2px rgb(15 45 90 / 0.10)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function FilterSeg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{label}</span>
      <Segment options={options} value={value} onChange={onChange} />
    </div>
  );
}

/* ── Spark — 미니 스파크라인 (SVG) ── */
export function Spark({
  data,
  width = 120,
  height = 28,
  color = "var(--cyan)",
  fill = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (!data || data.length < 2) {
    return (
      <span style={{ fontSize: 10, color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
        수집 중
      </span>
    );
  }
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  const path = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(data.length - 1).toFixed(1)} ${height - pad} L${pad} ${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: "block", maxWidth: "100%" }}>
      {fill && <path d={area} fill={`color-mix(in oklch, ${color} 14%, transparent)`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.4" fill={color} />
    </svg>
  );
}

/* ── KpiCard — 라벨/값/서브 + 아이콘 + 스파크 ── */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  spark,
  sparkColor = "var(--cyan)",
  iconColor = "var(--cyan)",
  icon,
  mono = true,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  spark?: number[];
  sparkColor?: string;
  iconColor?: string;
  icon?: ReactNode;
  mono?: boolean;
}) {
  return (
    <PCard pad="md" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        {icon && (
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              flexShrink: 0,
              color: iconColor,
              background: `color-mix(in oklch, ${iconColor} 13%, transparent)`,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 23,
            fontWeight: 700,
            color: "var(--ink)",
            fontFamily: mono ? "var(--font-mono)" : '"Pretendard Variable", Pretendard, sans-serif',
            letterSpacing: "-0.01em",
          }}
        >
          {value}
        </span>
        {delta != null && <DeltaValue value={delta} size={12} />}
      </div>
      {(sub || spark) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {sub && <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{sub}</span>}
          {spark && spark.length > 1 && <Spark data={spark} width={84} height={24} color={sparkColor} />}
        </div>
      )}
    </PCard>
  );
}

/* ── 테이블 공통 스타일 ── */
export const thStyle = (align: "left" | "right" = "left"): CSSProperties => ({
  padding: "12px 18px",
  fontWeight: 600,
  fontSize: 11.5,
  color: "var(--ink-muted)",
  textAlign: align,
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
});

export const tdStyle = (align: "left" | "right" = "left"): CSSProperties => ({
  padding: "12px 18px",
  textAlign: align,
  borderBottom: "1px solid var(--border)",
});

/* ── RankedBars — 가로 랭킹 바 + 임계 가이드라인(예: 주의 60 / 경보 75) ── */
export function RankedBars({
  rows,
  max = 100,
  thresholds = [],
  valueFormat = (v: number) => `${v}%`,
}: {
  rows: { label: string; value: number; color: string }[];
  max?: number;
  thresholds?: { at: number; label: string; color: string }[];
  valueFormat?: (v: number) => string;
}) {
  return (
    <div style={{ position: "relative" }}>
      {/* 임계 가이드 세로선 — 라벨 영역(120px) 이후 바 영역에 겹침 */}
      <div style={{ position: "absolute", left: 120, right: 64, top: 0, bottom: 0, pointerEvents: "none" }}>
        {thresholds.map((t) => (
          <div
            key={t.at}
            style={{
              position: "absolute",
              left: `${(t.at / max) * 100}%`,
              top: 0,
              bottom: 0,
              borderLeft: `1.5px dashed ${t.color}`,
              opacity: 0.55,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -2,
                left: 4,
                fontSize: 9.5,
                fontWeight: 700,
                color: t.color,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: thresholds.length ? 16 : 0 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span
              style={{
                width: 120,
                flexShrink: 0,
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                paddingRight: 10,
              }}
            >
              {r.label}
            </span>
            <div style={{ flex: 1, height: 14, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, (r.value / max) * 100)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: r.color,
                }}
              />
            </div>
            <span
              style={{
                width: 64,
                flexShrink: 0,
                textAlign: "right",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: r.color,
              }}
            >
              {valueFormat(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut — 비중 도넛 + 중앙 라벨 + 범례 ── */
const DONUT_COLORS = [
  "var(--navy-600)",
  "var(--cyan)",
  "var(--status-observe)",
  "var(--status-caution)",
  "color-mix(in oklch, var(--navy-600) 45%, var(--card))",
  "var(--ink-muted)",
];

export function Donut({
  segments,
  centerLabel,
  centerSub,
  size = 168,
  thickness = 26,
  format = (v: number) => String(Math.round(v)),
}: {
  segments: { label: string; value: number }[];
  centerLabel?: string;
  centerSub?: string;
  size?: number;
  thickness?: number;
  format?: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0 || segments.length === 0) return <Collecting />;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", justifyContent: "center" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: "rotate(-90deg)" }}>
          {segments.map((seg, i) => {
            const frac = Math.max(0, seg.value) / total;
            const dash = frac * C;
            const offset = -acc * C;
            acc += frac;
            return (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        {(centerLabel || centerSub) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {centerLabel && (
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                {centerLabel}
              </span>
            )}
            {centerSub && <span style={{ fontSize: 10.5, color: "var(--ink-muted)", marginTop: 2 }}>{centerSub}</span>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 130 }}>
        {segments.map((seg, i) => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                flexShrink: 0,
                background: DONUT_COLORS[i % DONUT_COLORS.length],
              }}
            />
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{seg.label}</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
              {format(seg.value)} · {Math.round((Math.max(0, seg.value) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DivergingBars — 중앙 라벨 기준 좌(수입)·우(수출) 다이버징 바 ── */
export function DivergingBars({
  rows,
  leftLabel = "수입",
  rightLabel = "수출",
  format = (v: number) => String(Math.round(v)),
}: {
  rows: { label: string; left: number; right: number }[];
  leftLabel?: string;
  rightLabel?: string;
  format?: (v: number) => string;
}) {
  if (rows.length === 0) return <Collecting />;
  const max = Math.max(...rows.map((r) => Math.max(r.left, r.right)), 1);
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "64px 1fr 110px 1fr 64px",
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          color: "var(--ink-muted)",
          paddingBottom: 8,
        }}
      >
        <span />
        <span style={{ textAlign: "right" }}>{leftLabel}</span>
        <span />
        <span>{rightLabel}</span>
        <span />
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: "grid",
            gridTemplateColumns: "64px 1fr 110px 1fr 64px",
            alignItems: "center",
            gap: 8,
            padding: "5px 0",
          }}
        >
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-muted)", textAlign: "right" }}>
            {format(r.left)}
          </span>
          <div style={{ display: "flex", justifyContent: "flex-end", height: 14, background: "var(--surface-alt)", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, (Math.max(0, r.left) / max) * 100)}%`,
                height: "100%",
                background: "color-mix(in oklch, var(--navy-600) 38%, var(--card))",
                borderRadius: 999,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink)",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {r.label}
          </span>
          <div style={{ height: 14, background: "var(--surface-alt)", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, (Math.max(0, r.right) / max) * 100)}%`,
                height: "100%",
                background: "var(--navy-600)",
                borderRadius: 999,
              }}
            />
          </div>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink)" }}>
            {format(r.right)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── TreemapChart — 면적 = 값 (이진 분할 트리맵) ── */
type TmRect = { label: string; value: number; x: number; y: number; w: number; h: number };

function splitTreemap(
  items: { label: string; value: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
  out: TmRect[],
) {
  if (items.length === 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  const total = items.reduce((s, i) => s + i.value, 0);
  let acc = 0;
  let idx = 0;
  for (; idx < items.length - 1; idx++) {
    acc += items[idx].value;
    if (acc >= total / 2) break;
  }
  const a = items.slice(0, idx + 1);
  const b = items.slice(idx + 1);
  const frac = total > 0 ? a.reduce((s, i) => s + i.value, 0) / total : 0.5;
  if (w >= h) {
    splitTreemap(a, x, y, w * frac, h, out);
    splitTreemap(b, x + w * frac, y, w * (1 - frac), h, out);
  } else {
    splitTreemap(a, x, y, w, h * frac, out);
    splitTreemap(b, x, y + h * frac, w, h * (1 - frac), out);
  }
}

export function TreemapChart({
  items,
  height = 300,
  format = (v: number) => String(Math.round(v)),
}: {
  items: { label: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (positive.length === 0) return <Collecting />;
  const rects: TmRect[] = [];
  splitTreemap(positive, 0, 0, 100, 100, rects);
  const max = positive[0].value;
  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 8 }}>
      {rects.map((r) => {
        // 감마 곡선(0.45) — 1개 챕터가 압도해도 작은 박스 색이 뭉개지지 않게 대비 확보.
        const intensity = 22 + Math.round(Math.pow(max > 0 ? r.value / max : 0, 0.45) * 62);
        const dark = intensity > 50;
        const showText = r.w >= 6 && r.h >= 8;
        return (
          <div
            key={r.label}
            title={`${r.label} · ${format(r.value)}`}
            style={{
              position: "absolute",
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.w}%`,
              height: `${r.h}%`,
              boxSizing: "border-box",
              border: "2px solid var(--card)",
              borderRadius: 6,
              background: `color-mix(in oklch, var(--navy-600) ${intensity}%, var(--card))`,
              color: dark ? "#fff" : "var(--ink)",
              padding: "8px 10px",
              overflow: "hidden",
            }}
          >
            {showText && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.85, marginTop: 2 }}>
                  {format(r.value)}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 데이터 없음 플레이스홀더 — 더미 수치 금지, "데이터 수집 중" 표기 ── */
export function Collecting({ note }: { note?: string }) {
  return (
    <div style={{ padding: "28px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>데이터 수집 중</p>
      {note && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--ink-muted)" }}>{note}</p>}
    </div>
  );
}
