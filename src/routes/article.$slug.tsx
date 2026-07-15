import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import {
  articleQueryOptions,
  articleParam,
  relatedArticlesQueryOptions,
  estimateReadMinutes,
} from "@/lib/api/article";
import { formatPublishedAt, isInternalNewsItem } from "@/lib/api/news";
import { normalizeArticleContent } from "@/lib/article-content";
import LogisightArticle from "@/components/article-page/LogisightArticle";
import type {
  Article as LsArticle,
  RelatedArticle,
} from "@/components/article-page/LogisightArticle";

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ params, context }) => {
    const slug = params.slug?.trim();
    if (!slug) throw notFound();
    const article = await context.queryClient.ensureQueryData(articleQueryOptions(slug));
    if (
      article.agent_type === "external" &&
      !article.content?.trim() &&
      article.url &&
      /^https?:\/\//.test(article.url)
    ) {
      throw redirect({ href: article.url });
    }
    context.queryClient.prefetchQuery(
      relatedArticlesQueryOptions({ id: article.id, category: article.category }),
    );
    return { article };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article;
    const title = a ? `${a.title} — Logisight` : "기사 — Logisight";
    const desc =
      (a?.summary && a.summary.trim().length > 0 ? a.summary : a?.title) ??
      "Logisight 큐레이션 물류 뉴스 상세 기사.";
    const slugParam = a?.slug && a.slug.length > 0 ? a.slug : a ? String(a.id) : params.slug;
    // canonical·og:url은 sitemap <loc>와 문자 단위로 일치해야 통합이 작동 — 동일하게 percent-인코딩
    const url = `https://logisight.mtlship.com/article/${encodeURIComponent(slugParam)}`;
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
          "@type": "NewsArticle",
          headline: a.title,
          description: desc,
          image: a.image_url ? [a.image_url] : undefined,
          datePublished: a.published_at ?? undefined,
          dateModified: a.published_at ?? undefined,
          author: {
            "@type": "Organization",
            name: a.source ?? "MTL Shipping Agency",
          },
          publisher: {
            "@type": "Organization",
            name: "MTL Shipping Agency",
            logo: {
              "@type": "ImageObject",
              url: "https://logisight.mtlship.com/logisight_logo.svg",
            },
          },
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
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">404</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">기사를 찾을 수 없습니다</h1>
      <Link
        to="/news"
        className="mt-6 inline-block text-sm font-semibold text-[var(--color-navy-600)] underline"
      >
        물류 뉴스로 돌아가기
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

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data: article } = useSuspenseQuery(articleQueryOptions(slug));
  const { data: related } = useSuspenseQuery(
    relatedArticlesQueryOptions({
      id: article.id,
      category: article.category,
    }),
  );

  const normalizedContent = normalizeArticleContent({
    content: article.content,
    title: article.title,
    summary: article.summary,
    imageUrl: article.image_url,
    imageCredit: article.image_credit,
  });
  const hasContent = normalizedContent.length > 0;
  const readMin = estimateReadMinutes(normalizedContent);
  const isExternalSource =
    !!article.url &&
    /^https?:\/\//.test(article.url) &&
    !article.url.includes("logisight.mtlship.com/sample");

  // 인텔리전스 필드(summary_points·impact)는 maritime_news 에 없으므로 전달하지 않는다 → 자동 숨김.
  const articleProp: LsArticle = {
    id: String(article.id),
    category: article.category,
    title: article.title,
    deck: article.summary,
    source: article.source,
    published_at: formatPublishedAt(article.published_at),
    registered_at: formatPublishedAt(article.fetched_at ?? null),
    read_minutes: readMin,
    image_url: article.image_url,
    image_caption: article.image_credit,
    contentNode: hasContent ? (
      <ReactMarkdown>{normalizedContent}</ReactMarkdown>
    ) : (
      // 본문 없음 → 더미 대신 "수집 예정" 안내(데이터 안전 규칙).
      <p>이 기사의 전문은 수집 예정입니다.</p>
    ),
    source_origin: isExternalSource ? null : article.source,
    source_url: isExternalSource ? article.url : null,
    tags: article.tags,
  };

  const relatedById = new Map(related.map((n) => [String(n.id), n]));
  const relatedProp: RelatedArticle[] = related.map((n) => ({
    id: String(n.id),
    category: n.category,
    title: n.title,
    source: n.source,
    published_at: formatPublishedAt(n.published_at),
  }));

  return (
    <LogisightArticle
      article={articleProp}
      related={relatedProp}
      reportCta={{
        heading: "이 뉴스가 운임과 공급망에 미치는 영향은?",
        body: "이번 주 Logisight 레포트에서 주요 노선 전망과 대응 포인트를 확인하세요.",
        buttonLabel: "이번 주 레포트 보기",
      }}
      renderRelatedLink={(item, children, className) => {
        const n = item.id ? relatedById.get(item.id) : undefined;
        return n && isInternalNewsItem(n) ? (
          <Link to="/article/$slug" params={{ slug: articleParam(n) }} className={className}>
            {children}
          </Link>
        ) : (
          <a href={n?.url ?? "#"} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
          </a>
        );
      }}
    />
  );
}
