import type { ReactNode } from "react";

import { PageHero, type HeroChip } from "@/components/site/PageHero";

type Props = {
  title: string;
  titleAccent?: string;
  eyebrow?: string;
  subtitle?: string;
  chips?: HeroChip[];
  toolbar?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  title,
  titleAccent,
  eyebrow,
  subtitle,
  chips,
  toolbar,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <PageHero
        eyebrow={eyebrow}
        titleMain={title}
        titleAccent={titleAccent}
        subtitle={subtitle}
        chips={chips}
        action={toolbar}
      />
      <main className="mx-auto max-w-[1540px] px-4 py-[26px] lg:px-12">
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
