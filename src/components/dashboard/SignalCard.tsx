import { EvidenceBadge } from "./EvidenceBadge";
import { FreshnessBadge } from "./FreshnessBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";

export type SignalState = "normal" | "observe" | "caution" | "alert";

export type Signal = {
  label: string;
  state: SignalState;
  basis: string;
  sources: string[];
  asOf: string | null;
  confidence: "high" | "medium" | "low";
};

const STATE_BORDER: Record<SignalState, string> = {
  normal: "border-l-status-normal",
  observe: "border-l-status-observe",
  caution: "border-l-status-caution",
  alert: "border-l-status-alert",
};

const STATE_LABEL: Record<SignalState, string> = {
  normal: "정상",
  observe: "관찰",
  caution: "주의",
  alert: "경보",
};

const STATE_LABEL_COLOR: Record<SignalState, string> = {
  normal: "text-status-normal",
  observe: "text-status-observe",
  caution: "text-status-caution",
  alert: "text-status-alert",
};

type Props = { signal: Signal };

export function SignalCard({ signal }: Props) {
  return (
    <div
      className={[
        "rounded-lg border border-border bg-card border-l-4 p-4",
        STATE_BORDER[signal.state],
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{signal.label}</p>
          <p className={["text-sm font-semibold", STATE_LABEL_COLOR[signal.state]].join(" ")}>
            {STATE_LABEL[signal.state]}
          </p>
        </div>
        <ConfidenceBadge level={signal.confidence} />
      </div>
      <p className="mt-2 text-xs text-foreground/80 leading-relaxed">{signal.basis}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {signal.sources.map((src) => (
          <EvidenceBadge key={src} label={src} />
        ))}
        {signal.asOf && <FreshnessBadge asOf={signal.asOf} />}
      </div>
    </div>
  );
}
