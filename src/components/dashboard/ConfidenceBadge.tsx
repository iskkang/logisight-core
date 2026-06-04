type Props = { level: "high" | "medium" | "low" };

const STYLES: Record<Props["level"], string> = {
  high: "bg-status-normal/10 text-status-normal border-status-normal/30",
  medium: "bg-status-caution/10 text-status-caution border-status-caution/30",
  low: "bg-status-alert/10 text-status-alert border-status-alert/30",
};

const LABELS: Record<Props["level"], string> = {
  high: "신뢰↑",
  medium: "신뢰중",
  low: "신뢰↓",
};

export function ConfidenceBadge({ level }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
        STYLES[level],
      ].join(" ")}
    >
      {LABELS[level]}
    </span>
  );
}
