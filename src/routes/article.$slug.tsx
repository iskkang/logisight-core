import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import {
  articleQueryOptions,
  articleParam,
  relatedArticlesQueryOptions,
  estimateReadMinutes,
} from "@/lib/api/article";
import { formatPublishedAt } from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ params, context }) => {
    const slug = params.slug?.trim();
    if (!slug) throw notFound();
    const article = await context.queryClient.ensureQueryData(
      articleQueryOptions(slug),
    );
    context.queryClient.prefetchQuery(
      relatedArticlesQueryOptions({ id: article.id, category: article.category }),
    );
    return { article };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article;
    const title = a ? `${a.title} — Logisight` : "기사 — Logisight";
    const desc =
      (a?.summary && a.summary.trim().length > 0
        ? a.summary
        : a?.title) ?? "Logisight 큐레이션 시장 뉴스 상세 기사.";
    const slugParam =
      a?.slug && a.slug.length > 0 ? a.slug : a ? String(a.id) : params.slug;
    const url = `https://logisight-core.lovable.app/article/${slugParam}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: a?.title ?? "기사 — Logisight" },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: a?.title ?? "기사 — Logisight" },
      { name: "twitter:description", content: desc },
    ];
    if (a?.image_url) {
      meta.push({ property: "og:image", content: a.image_url });
      meta.push({ name: "twitter:image", content: a.image_url });
    }
    const scripts: Array<{ type: string; children: string }> = [];
    if (a) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description: desc,
          image: a.image_url ?? undefined,
          datePublished: a.published_at ?? undefined,
          author: a.source ? { "@type": "Organization", name: a.source } : undefined,
          mainEntityOfPage: url,
        }),
      });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">
        기사를 찾을 수 없습니다
      </h1>
      <Link
        to="/news"
        className="mt-6 inline-block text-sm font-semibold text-[var(--color-navy-600)] underline"
      >
        시장 뉴스로 돌아가기
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  ),
  component: ArticlePage,
});

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  해상: { bg: "var(--color-cat-sea, var(--color-navy-900))", fg: "#fff" },
  항공: { bg: "var(--color-cat-air, var(--color-navy-600))", fg: "#fff" },
  철도: { bg: "var(--color-cat-rail, #6b3a2a)", fg: "#fff" },
  물류: { bg: "var(--color-cat-logistics, #1f2937)", fg: "#fff" },
  무역: { bg: "var(--color-cat-trade, #0d7a5f)", fg: "#fff" },
};

function categoryStyle(cat: string | null) {
  if (!cat) return { bg: "var(--color-navy-900)", fg: "var(--color-cyan)" };
  return CATEGORY_COLORS[cat] ?? {
    bg: "var(--color-navy-900)",
    fg: "var(--color-cyan)",
  };
}

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data: article } = useSuspenseQuery(articleQueryOptions(slug));
  const { data: related } = useSuspenseQuery(
    relatedArticlesQueryOptions({
      id: article.id,
      category: article.category,
    }),
  );

  const readMin = estimateReadMinutes(article.content);
  const catStyle = categoryStyle(article.category);
  const hasContent = !!article.content && article.content.trim().length > 0;
  const isExternalSource =
    !!article.url &&
    /^https?:\/\//.test(article.url) &&
    !article.url.includes("logisight.mtlship.com/sample");

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:py-14">
      <header className="border-b border-[var(--color-line)] pb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em]">
          {article.category && (
            <span
              className="rounded-sm px-2 py-0.5 font-semibold"
              style={{ background: catStyle.bg, color: catStyle.fg }}
            >
              {article.category}
            </span>
          )}
        </div>
        <h1
          className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] lg:text-4xl"
          style={{ wordBreak: "keep-all" }}
        >
          {article.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-ink-muted)]">
          <span className="font-semibold">{article.source}</span>
          <span>·</span>
          <time dateTime={article.published_at ?? undefined}>
            {formatPublishedAt(article.published_at)}
          </time>
          {readMin && (
            <>
              <span>·</span>
              <span>읽는 시간 약 {readMin}분</span>
            </>
          )}
        </div>
      </header>

      {article.image_url && (
        <figure className="my-8">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full rounded-lg border border-[var(--color-line)]"
            loading="lazy"
          />
        </figure>
      )}

      {hasContent ? (
        <div
          className="prose prose-neutral max-w-none text-[var(--color-ink)]"
          style={{ lineHeight: 1.8, wordBreak: "keep-all" }}
        >
          <ReactMarkdown>{article.content!}</ReactMarkdown>
        </div>
      ) : (
        <div
          className="my-8 rounded-lg border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-navy-900)_4%,white)] p-6"
          style={{ lineHeight: 1.8, wordBreak: "keep-all" }}
        >
          {article.summary && (
            <p className="text-base text-[var(--color-ink)]">
              {article.summary}
            </p>
          )}
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            이 기사의 전문은 수집 예정입니다.
          </p>
        </div>
      )}

      {article.tags && article.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {article.tags.map((t: string) => (
            <li
              key={t}
              className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-ink-muted)]"
            >
              #{t}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-10 border-t border-[var(--color-line)] pt-6 text-sm text-[var(--color-ink-muted)]">
        출처:{" "}
        {isExternalSource ? (
          <a
            href={article.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--color-navy-600)] underline"
          >
            {article.source}
          </a>
        ) : (
          <span className="font-semibold text-[var(--color-ink)]">
            {article.source}
          </span>
        )}
      </footer>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-lg font-bold text-[var(--color-ink)]">
            관련 기사
          </h2>
          <ul className="grid gap-6 sm:grid-cols-3">
            {related.map((n) => (
              <RelatedCard key={n.id} item={n} />
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function RelatedCard({ item }: { item: NewsItem }) {
  return (
    <li>
      <Link
        to="/article/$slug"
        params={{ slug: articleParam(item) }}
        className="block h-full rounded-lg border border-[var(--color-line)] bg-white p-4 transition hover:border-[var(--color-navy-600)]"
      >
        {item.category && (
          <span
            className="inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{
              background: "var(--color-navy-900)",
              color: "var(--color-cyan)",
            }}
          >
            {item.category}
          </span>
        )}
        <h3
          className="mt-2 text-sm font-bold leading-snug text-[var(--color-ink)]"
          style={{ wordBreak: "keep-all" }}
        >
          {item.title}
        </h3>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          {item.source} · {formatPublishedAt(item.published_at)}
        </p>
      </Link>
    </li>
  );
}