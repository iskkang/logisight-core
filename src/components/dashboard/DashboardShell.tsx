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
    <>
      <PageHero
        eyebrow={eyebrow}
        titleMain={title}
        titleAccent={titleAccent}
        subtitle={subtitle}
        chips={chips}
        action={toolbar}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="space-y-6">{children}</div>
      </main>
    </>
  );
}
