import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  latestNewsQueryOptions,
  formatPublishedAt,
} from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";

const newsSearchSchema = z.object({
  cat: z.string().min(1).max(40).optional(),
});

export const Route = createFileRoute("/news")({
  validateSearch: newsSearchSchema,
  loaderDeps: ({ search }) => ({ cat: search.cat }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      latestNewsQueryOptions({ lang: "ko", limit: 30, category: deps.cat }),
    ),
  head: () => ({
    meta: [
      { title: "시장 뉴스 — Logisight" },
      {
        name: "description",
        content:
          "해상·항공·철도·물류·무역. 글로벌 운임과 공급망을 흔드는 핵심 뉴스를 한국어 요약과 함께 매주 정리합니다.",
      },
      { property: "og:title", content: "시장 뉴스 — Logisight" },
      {
        property: "og:description",
        content:
          "해상·항공·철도·물류·무역 분야의 글로벌 시장 뉴스를 한국어로 큐레이션.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { cat } = Route.useSearch();
  const { data } = useSuspenseQuery(
    latestNewsQueryOptions({ lang: "ko", limit: 30, category: cat }),
  );
  const items: NewsItem[] = data ?? [];
  const [hero, ...rest] = items;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
      <header className="mb-10 border-b border-[var(--color-line)] pb-6">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--color-navy-600)" }}
        >
          Market News
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--color-ink)] lg:text-4xl">
          시장 뉴스
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)]">
          해상·항공·철도·물류·무역. 글로벌 운임과 공급망을 흔드는 핵심 뉴스를 한국어 요약과
          함께 매주 정리합니다.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          수집 예정 (매주 업데이트)
        </p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-3">
          {hero && (
            <article className="lg:col-span-2">
              <Meta item={hero} />
              <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-ink)] lg:text-3xl">
                <Link to="/article/$slug" params={{ slug: articleParam(hero) }}>
                  {hero.title}
                </Link>
              </h2>
              {hero.summary && (
                <p className="mt-4 text-base leading-relaxed text-[var(--color-ink-muted)]">
                  {hero.summary}
                </p>
              )}
            </article>
          )}

          <ul className="space-y-6 lg:col-span-1">
            {rest.slice(0, 6).map((n) => (
              <li
                key={n.id}
                className="border-b border-[var(--color-line)] pb-6 last:border-0"
              >
                <Meta item={n} />
                <h3 className="mt-2 text-base font-semibold leading-snug text-[var(--color-ink)]">
                  <Link to="/article/$slug" params={{ slug: articleParam(n) }}>
                    {n.title}
                  </Link>
                </h3>
                {n.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                    {n.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <ul className="grid gap-6 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
            {rest.slice(6).map((n) => (
              <li key={n.id}>
                <article className="h-full rounded-lg border border-[var(--color-line)] bg-white p-5">
                  <Meta item={n} />
                  <h3 className="mt-3 text-base font-bold leading-snug text-[var(--color-ink)]">
                    <Link to="/article/$slug" params={{ slug: articleParam(n) }}>
                      {n.title}
                    </Link>
                  </h3>
                  {n.summary && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      {n.summary}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
      {item.category && (
        <span
          className="rounded-sm px-1.5 py-0.5 font-semibold"
          style={{
            background: "var(--color-navy-900)",
            color: "var(--color-cyan)",
          }}
        >
          {item.category}
        </span>
      )}
      <span>{item.source}</span>
      <span>·</span>
      <time dateTime={item.published_at ?? undefined}>
        {formatPublishedAt(item.published_at)}
      </time>
    </div>
  );
}