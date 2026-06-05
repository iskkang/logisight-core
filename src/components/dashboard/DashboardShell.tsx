import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ title, subtitle, toolbar, children }: Props) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]"
          />
          <div>
            <h1 className="text-xl font-bold text-heading">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>
      <div className="space-y-6">{children}</div>
    </main>
  );
}
