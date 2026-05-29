import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  policyAlertsQueryOptions,
  policyRelatedNewsQueryOptions,
  formatPublishedAt,
  codeStyle,
  CODE_DESCRIPTIONS,
  type PolicyAlertRow,
  type PolicyNewsItem,
} from "@/lib/api/policy";
import { articleParam } from "@/lib/api/article";

export const Route = createFileRoute("/policy")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(policyAlertsQueryOptions());
    context.queryClient.ensureQueryData(policyRelatedNewsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "정책·규제 모니터 — Logisight" },
      {
        name: "description",
        content:
          "CBAM·EU ETS·대러 제재·EAR·전략물자 등 무역·물류에 영향을 주는 정책·규제 변동을 한 화면에서 추적하세요.",
      },
      { property: "og:title", content: "정책·규제 모니터 — Logisight" },
      {
        property: "og:description",
        content:
          "활성 정책 알림과 관련 기사를 코드별로 모아 보는 무역·물류 규제 모니터.",
      },
      { property: "og:url", content: "https://logisight-core.lovable.app/policy" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/policy" }],
  }),
  component: PolicyPage,
  errorComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      페이지를 찾을 수 없습니다.
    </div>
  ),
});

function PolicyPage() {
  const { data: alerts } = useSuspenseQuery(policyAlertsQueryOptions());
  const { data: news } = useSuspenseQuery(policyRelatedNewsQueryOptions());

  // Unique codes preserving alert order
  const codes = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const a of alerts) {
      if (!seen.has(a.code)) {
        seen.add(a.code);
        list.push(a.code);
      }
    }
    return list;
  }, [alerts]);

  const newsByCode = useMemo(() => {
    const m = new Map<string, PolicyNewsItem[]>();
    for (const code of codes) {
      const matched = news
        .filter((n) => (n.tags ?? []).some((t) => t === code))
        .slice(0, 6);
      if (matched.length) m.set(code, matched);
    }
    return m;
  }, [news, codes]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
      <Hero />
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px]">
        <div>
          <ActiveAlerts alerts={alerts} />
          {codes.length > 0 ? (
            <section className="mt-12 space-y-10">
              {codes.map((code) => {
                const items = newsByCode.get(code);
                if (!items || items.length === 0) return null;
                return <RelatedNews key={code} code={code} items={items} />;
              })}
            </section>
          ) : null}
        </div>
        <Sidebar />
      </div>
    </main>
  );
}

function Hero() {
  return (
    <header className="border-b border-border pb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-cyan)]">
        Policy & Compliance
      </p>
      <h1 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
        정책·규제 모니터
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground lg:text-base">
        무역·물류 운영에 영향을 주는 정책·규제 변동을 한 화면에서 추적합니다.
        새 알림이 등록되면 자동으로 노출됩니다.
      </p>
    </header>
  );
}

function ActiveAlerts({ alerts }: { alerts: PolicyAlertRow[] }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">활성 알림</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        is_active = true 인 정책 알림만 표시됩니다.
      </p>

      {alerts.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          현재 활성 알림 없음
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {alerts.map((a) => {
            const s = codeStyle(a.code);
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {a.code}
                  </span>
                </div>
                <h3 className="mt-1.5 break-keep text-sm font-medium text-foreground">
                  {a.title}
                </h3>
                {a.meta ? (
                  <p className="mt-1 text-xs text-muted-foreground">{a.meta}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RelatedNews({ code, items }: { code: string; items: PolicyNewsItem[] }) {
  const s = codeStyle(code);
  return (
    <section>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {code}
        </span>
        <h3 className="text-base font-semibold text-foreground">관련 기사</h3>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((n) => (
          <li
            key={n.id}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-[var(--color-cyan)]"
          >
            <Link to="/article/$slug" params={{ slug: articleParam(n) }} className="block">
              <h4 className="break-keep text-sm font-medium text-foreground">
                {n.title}
              </h4>
              {n.summary ? (
                <p className="mt-1 line-clamp-2 break-keep text-xs text-muted-foreground">
                  {n.summary}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium">{n.source}</span>
                <span>·</span>
                <span>{formatPublishedAt(n.published_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sidebar() {
  return (
    <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">코드 가이드</h3>
        <ul className="mt-3 space-y-3">
          {CODE_DESCRIPTIONS.map(({ code, desc }) => {
            const s = codeStyle(code);
            return (
              <li key={code} className="text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {code}
                </span>
                <p className="mt-1 break-keep text-muted-foreground">{desc}</p>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        출처: 정부·EU 공식 고시 · 주요 매체 기사 큐레이션
      </p>
    </aside>
  );
}