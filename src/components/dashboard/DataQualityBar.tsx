import { FreshnessBadge } from "./FreshnessBadge";

export type DataSource = {
  label: string;
  asOf: string | null;
  expectedDays: number;
};

type Props = { sources: DataSource[] };

export function DataQualityBar({ sources }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-2.5">
      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">데이터 기준</span>
      {sources.map((src) => (
        <div key={src.label} className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{src.label}</span>
          <FreshnessBadge asOf={src.asOf} expectedDays={src.expectedDays} />
        </div>
      ))}
    </div>
  );
}
