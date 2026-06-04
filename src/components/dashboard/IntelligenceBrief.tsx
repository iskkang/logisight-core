import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export function IntelligenceBrief({ title, children }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
