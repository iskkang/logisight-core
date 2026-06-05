import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export function IntelligenceBrief({ title, children }: Props) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden className="h-3 w-0.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
        {title}
      </h2>
      {children}
    </section>
  );
}
