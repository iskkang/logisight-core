import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function ActionCard({ title, description, action, icon }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      {icon && (
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
