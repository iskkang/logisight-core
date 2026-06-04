type StatusState = "normal" | "observe" | "caution" | "alert";

const STATE_STYLES: Record<StatusState, string> = {
  normal: "bg-status-normal/10 text-status-normal border-status-normal/20",
  observe: "bg-status-observe/10 text-status-observe border-status-observe/20",
  caution: "bg-status-caution/10 text-status-caution border-status-caution/20",
  alert: "bg-status-alert/10 text-status-alert border-status-alert/20",
};

const DOT_STYLES: Record<StatusState, string> = {
  normal: "bg-status-normal",
  observe: "bg-status-observe",
  caution: "bg-status-caution",
  alert: "bg-status-alert animate-pulse",
};

export type StatusItem = {
  label: string;
  value: string;
  state: StatusState;
};

type Props = { items: StatusItem[] };

export function StatusStrip({ items }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={[
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium",
            STATE_STYLES[item.state],
          ].join(" ")}
        >
          <span className={["h-1.5 w-1.5 rounded-full flex-shrink-0", DOT_STYLES[item.state]].join(" ")} />
          <span className="text-foreground/60">{item.label}</span>
          <span className="font-semibold tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
