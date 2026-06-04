type Props = {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
};

export function Sparkline({ values, width = 80, height = 24, color = "currentColor" }: Props) {
  const valid = values.filter((v): v is number => v !== null && isFinite(v));
  if (valid.length < 2) return <span className="text-muted-foreground/40">—</span>;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const pts = values
    .map((v, i) => {
      if (v === null || !isFinite(v)) return null;
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean);

  if (pts.length < 2) return <span className="text-muted-foreground/40">—</span>;

  const d = pts
    .map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`))
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="inline-block"
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
