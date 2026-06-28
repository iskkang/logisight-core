import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import {
  latestBriefingQueryOptions,
  formatBriefingDate,
} from "@/lib/api/briefing";
import type { BriefingPoint } from "@/lib/api/briefing";
import { RouteBreadcrumb } from "@/components/site/Breadcrumb";

const SLOTS = [
  { key: "shipping", label: "시황" },
  { key: "corp", label: "기업" },
  { key: "brief", label: "글로벌" },
] as const;

const DEFAULT_DESC = "이번 주 해운·항공·철도·무역 시장의 핵심 이슈를 한눈에 정리한 주간 브리핑.";

export const Route = createFileRoute("/briefing")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(latestBriefingQueryOptions());
    return { subtitle: data?.briefing?.subtitle ?? null };
  },
  head: ({ loaderData }) => {
    const subtitle = loaderData?.subtitle;
    const desc = subtitle && subtitle.trim().length > 0 ? subtitle : DEFAULT_DESC;
    const url = "https://logisight.mtlship.com/briefing";
    return {
      meta: [
        { title: "주간 시장 브리핑 — Logisight" },
        { name: "description", content: desc },
        { property: "og:title", content: "주간 시장 브리핑 — Logisight" },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BriefingPage,
});

function PointCard({ point, label }: { point: BriefingPoint | undefined; label: string }) {
  return (
    <div className="h-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-alt,#f7f9fc)] p-4">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
        <span style={{ color: "var(--color-cyan)" }}>{label}</span>
        {point && (
          <span className="text-[var(--color-ink-muted)]/70">
            BY {point.agent_type.toUpperCase()}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-[var(--color-ink)]" style={{ wordBreak: "keep-all" }}>
        {point?.headline ?? "수집 예정"}
      </p>
    </div>
  );
}

function BriefingPage() {
  const { data } = useSuspenseQuery(latestBriefingQueryOptions());
  const briefing = data?.briefing ?? null;
  const points = data?.points ?? [];

  if (!briefing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
        >
          주간 인사이트
        </span>
        <h1 className="mt-4 text-2xl font-bold text-[var(--color-ink)]">주간 시장 브리핑</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">이번 주 브리핑을 준비 중입니다.</p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]/80">매주 월요일 발행</p>
        <Link to="/news" className="mt-6 inline-block text-sm font-semibold text-[var(--color-navy-600)] underline">
          시장 뉴스로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:py-14">
      <RouteBreadcrumb className="mb-6" />
      <header className="border-b border-[var(--color-line)] pb-6">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
        >
          주간 인사이트
        </span>
        <h1
          className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] lg:text-4xl"
          style={{ wordBreak: "keep-all" }}
        >
          {briefing.title}
        </h1>
        {briefing.subtitle && (
          <p className="mt-3 text-base text-[var(--color-ink-muted)]">{briefing.subtitle}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-ink-muted)]">
          <time dateTime={briefing.week_of}>{formatBriefingDate(briefing.week_of)} 주간</time>
          <span>·</span>
          <span>{formatBriefingDate(briefing.published_at)} 발행</span>
        </div>
      </header>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {SLOTS.map(({ key, label }) => {
          const point =
            points.find((p) => p.agent_type === key) ??
            points.find((p) => p.category === key);
          return (
            <li key={key}>
              <PointCard point={point} label={label} />
            </li>
          );
        })}
      </ul>

      {briefing.content && briefing.content.trim().length > 0 ? (
        <div
          className="prose prose-neutral mt-10 max-w-none text-[var(--color-ink)]"
          style={{ lineHeight: 1.8, wordBreak: "keep-all" }}
        >
          <ReactMarkdown>{briefing.content}</ReactMarkdown>
        </div>
      ) : (
        <div
          className="mt-10 rounded-lg border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-navy-900)_4%,white)] p-6 text-sm text-[var(--color-ink-muted)]"
          style={{ lineHeight: 1.8, wordBreak: "keep-all" }}
        >
          이번 주 분석은 준비 중입니다.
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--color-line)] pt-6">
        <Link to="/news" className="text-sm font-semibold text-[var(--color-navy-600)] underline">
          시장 뉴스 전체 보기 →
        </Link>
      </footer>
    </article>
  );
}
