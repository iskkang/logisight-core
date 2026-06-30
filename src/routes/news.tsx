import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import type { ReactNode } from "react";

import {
  latestNewsQueryOptions,
  formatPublishedAt,
  todayKST,
  isInternalNewsItem,
} from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";
import { articleParam } from "@/lib/api/article";
import { seoHead } from "@/lib/seo";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import LogisightNewsTop from "@/components/news-page/LogisightNewsTop";
import type { Pick as NewsPick } from "@/components/news-page/LogisightNewsTop";

const newsSearchSchema = z.object({
  cat: z.string().min(1).max(40).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const Route = createFileRoute("/news")({
  validateSearch: newsSearchSchema,
  loaderDeps: ({ search }) => ({ cat: search.cat, date: search.date }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      latestNewsQueryOptions({ lang: "ko", limit: 40, category: deps.cat, date: deps.date }),
    ),
  head: () =>
    seoHead({
      title: "물류 뉴스 — Logisight",
      description:
        "해상·항공·철도·물류·무역. 글로벌 운임과 공급망을 흔드는 핵심 뉴스를 한국어 요약과 함께 매주 정리합니다.",
      path: "/news",
    }),
  component: NewsPage,
});

function NewsPage() {
  const navigate = useNavigate();
  const { cat, date } = Route.useSearch();
  const { data } = useSuspenseQuery(
    latestNewsQueryOptions({ lang: "ko", limit: 40, category: cat, date }),
  );
  const allItems: NewsItem[] = data ?? [];

  // 기간 세그먼트는 클라이언트 측 최신성 필터(전체=비필터)로 동작 — 초기 렌더는 항상 "전체"라
  // SSR/하이드레이션 불일치가 없다. 카테고리는 URL(cat)로 서버 측 필터된다.
  const [period, setPeriod] = useState("전체");
  const items = filterByPeriod(allItems, period);

  // "이번 주 주목" = 현재 노출 목록의 최신 대표 헤드라인(실데이터). 별도 큐레이션 소스가 없으므로
  // 최신 수집 기사를 자동 노출하고, 본문 목록에서는 중복을 피하려 해당 기사를 제외한다.
  const featured = items[0] ?? null;
  const pick: NewsPick | null = featured ? toPick(featured) : null;
  const stories = items.slice(1);
  const [lead, ...rest] = stories;
  const secondary = rest.slice(0, 2);
  const opinionStrip = rest.slice(2, 5);
  const gridSection = rest.slice(5, 14);
  const moreSection = rest.slice(14, 22);
  const mostPopular = stories.slice(0, 6);

  return (
    // 다크 래퍼: 반투명 HomeNav(bg #070b16cc) 뒤 배경을 홈과 동일하게 어둡게 둬 슬레이트색 번짐 방지.
    // 본문(LogisightNewsTop 흰색 + theme-light 카드 + 다크 푸터)이 내비 아래를 모두 덮는다.
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="news" />
      <LogisightNewsTop
        showNav={false}
        date={kstDateLabel()}
        category={cat ?? "전체"}
        onCategoryChange={(label) =>
          navigate({ to: "/news", search: label === "전체" ? {} : { cat: label } })
        }
        period={period}
        onPeriodChange={setPeriod}
        pick={pick}
        pickLoading={false}
        noteText="최신 수집 기사 중 대표 헤드라인을 자동으로 선별해 보여줍니다."
        renderPickLink={(_p, children, className) =>
          featured && isInternalNewsItem(featured) ? (
            <Link
              to="/article/$slug"
              params={{ slug: articleParam(featured) }}
              className={className}
            >
              {children}
            </Link>
          ) : (
            <a
              href={featured?.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {children}
            </a>
          )
        }
      />

      <div className="theme-light bg-[var(--color-card)]">
        {stories.length === 0 ? (
          <div className="mx-auto max-w-[1280px] px-4 py-20 text-center text-sm text-[var(--color-ink-muted)] lg:px-6">
            {allItems.length === 0
              ? "기사가 수집되는 대로 게재합니다."
              : "선택한 기간에 해당하는 기사가 더 없습니다."}
          </div>
        ) : (
          <div className="mx-auto max-w-[1280px] px-4 py-10 lg:px-6 lg:py-14">
            {/* Section label */}
            <SectionRule
              label={period === "전체" ? "주요 기사" : `${period} · 주요 기사`}
              eyebrow="Top Stories"
            />

            {/* Lead + secondary */}
            <div className="grid gap-10 lg:grid-cols-12">
              {/* Lead story */}
              {lead && (
                <article className="lg:col-span-7 lg:border-r lg:border-[var(--color-line)] lg:pr-10">
                  <Exclusive item={lead} />
                  <h2 className="font-serif-display mt-3 text-3xl font-black leading-[1.1] text-[var(--color-navy-900)] lg:text-[44px]">
                    <NewsItemLink
                      item={lead}
                      className="hover:underline decoration-[var(--color-cyan)] decoration-2 underline-offset-4"
                    >
                      {lead.title}
                    </NewsItemLink>
                  </h2>
                  {lead.summary && (
                    <p className="mt-4 text-[17px] leading-[1.65] text-[var(--color-ink)]">
                      {lead.summary}
                    </p>
                  )}
                  <Byline item={lead} className="mt-4" />
                  {lead.image_url && (
                    <NewsItemLink item={lead} className="mt-6 block">
                      <figure>
                        <img
                          src={lead.image_url}
                          alt={lead.title}
                          className="aspect-[16/10] w-full object-cover"
                          loading="eager"
                        />
                        <figcaption className="mt-2 text-[12px] text-[var(--color-ink-muted)]">
                          사진 · {lead.source}
                        </figcaption>
                      </figure>
                    </NewsItemLink>
                  )}
                </article>
              )}

              {/* Secondary stories column */}
              <div className="lg:col-span-5 lg:pl-2">
                <ul className="divide-y divide-[var(--color-line)]">
                  {secondary.map((n) => (
                    <li key={n.id} className="grid grid-cols-3 gap-4 py-5 first:pt-0">
                      <div className="col-span-2">
                        <KickerCat item={n} />
                        <h3 className="font-serif-display mt-2 text-xl font-bold leading-snug text-[var(--color-navy-900)]">
                          <NewsItemLink
                            item={n}
                            className="hover:underline decoration-[var(--color-cyan)] underline-offset-4"
                          >
                            {n.title}
                          </NewsItemLink>
                        </h3>
                        {n.summary && (
                          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                            {n.summary}
                          </p>
                        )}
                        <Byline item={n} className="mt-2 text-[11px]" />
                      </div>
                      {n.image_url ? (
                        <NewsItemLink item={n} className="col-span-1 block">
                          <img
                            src={n.image_url}
                            alt={n.title}
                            className="aspect-[4/3] h-full w-full object-cover"
                            loading="lazy"
                          />
                        </NewsItemLink>
                      ) : (
                        <div className="col-span-1 aspect-[4/3] bg-[var(--color-surface)]" />
                      )}
                    </li>
                  ))}
                </ul>

                {/* Most Popular */}
                <aside className="mt-8 border-t-[3px] border-[var(--color-navy-900)] pt-4">
                  <h3 className="font-serif-display text-lg font-bold text-[var(--color-navy-900)]">
                    추천 기사
                  </h3>
                  <ol className="mt-4 space-y-3">
                    {mostPopular.map((n, i) => (
                      <li
                        key={n.id}
                        className="flex gap-3 border-b border-[var(--color-line)] pb-3 last:border-0"
                      >
                        <span className="font-serif-display text-2xl font-black leading-none text-[var(--color-cyan)]">
                          {i + 1}
                        </span>
                        <NewsItemLink
                          item={n}
                          className="text-[13px] font-semibold leading-snug text-[var(--color-navy-900)] hover:underline"
                        >
                          {n.title}
                        </NewsItemLink>
                      </li>
                    ))}
                  </ol>
                </aside>
              </div>
            </div>

            {/* Opinion / In-depth strip */}
            {opinionStrip.length > 0 && (
              <>
                <div className="mt-14">
                  <SectionRule label="기획·심층" eyebrow="In Depth" />
                </div>
                <div className="grid gap-8 border-y border-[var(--color-line)] py-6 md:grid-cols-3">
                  {opinionStrip.map((n) => (
                    <article key={n.id} className="border-l-2 border-[var(--color-navy-900)] pl-4">
                      <KickerCat item={n} />
                      <h3 className="font-serif-display mt-2 text-lg font-bold italic leading-snug text-[var(--color-navy-900)]">
                        <NewsItemLink item={n} className="hover:underline">
                          {n.title}
                        </NewsItemLink>
                      </h3>
                      <Byline item={n} className="mt-2 text-[11px]" />
                    </article>
                  ))}
                </div>
              </>
            )}

            {/* Grid section */}
            {gridSection.length > 0 && (
              <>
                <div className="mt-14">
                  <SectionRule label="더 많은 보도" eyebrow="More News" />
                </div>
                <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
                  {gridSection.map((n) => (
                    <article key={n.id} className="flex flex-col">
                      {n.image_url && (
                        <NewsItemLink item={n} className="mb-3 block overflow-hidden">
                          <img
                            src={n.image_url}
                            alt={n.title}
                            className="aspect-[16/10] w-full object-cover transition-transform duration-500 hover:scale-105"
                            loading="lazy"
                          />
                        </NewsItemLink>
                      )}
                      <KickerCat item={n} />
                      <h3 className="font-serif-display mt-2 text-xl font-bold leading-snug text-[var(--color-navy-900)]">
                        <NewsItemLink
                          item={n}
                          className="hover:underline decoration-[var(--color-cyan)] underline-offset-4"
                        >
                          {n.title}
                        </NewsItemLink>
                      </h3>
                      {n.summary && (
                        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                          {n.summary}
                        </p>
                      )}
                      <Byline item={n} className="mt-3 text-[11px]" />
                    </article>
                  ))}
                </div>
              </>
            )}

            {/* Wire feed (compact list) */}
            {moreSection.length > 0 && (
              <>
                <div className="mt-14">
                  <SectionRule label="실시간 와이어" eyebrow="Latest Wire" />
                </div>
                <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                  {moreSection.map((n) => (
                    <li
                      key={n.id}
                      className="flex gap-4 border-b border-dotted border-[var(--color-line)] pb-4"
                    >
                      <time
                        dateTime={n.published_at ?? undefined}
                        className="shrink-0 pt-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-muted)]"
                      >
                        {formatPublishedAt(n.published_at)}
                      </time>
                      <div>
                        <KickerCat item={n} small />
                        <h4 className="mt-1 text-[14px] font-semibold leading-snug text-[var(--color-navy-900)]">
                          <NewsItemLink item={n} className="hover:underline">
                            {n.title}
                          </NewsItemLink>
                        </h4>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Newsletter band */}
            <div
              className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-lg px-7 py-6 text-white"
              style={{ background: "var(--color-navy-900)" }}
            >
              <div>
                <div className="text-lg font-bold">📨 매주 한 편의 물류 브리핑</div>
                <p className="mt-1.5 text-[13px] text-white/78">
                  운임 지수·정책 변화·회랑 동향을 정리한 뉴스레터를 받아보세요.
                </p>
              </div>
              <div className="min-w-[280px] max-w-[460px] flex-1">
                <NewsletterForm compact />
              </div>
            </div>
          </div>
        )}
      </div>

      <HomeFooter />
    </div>
  );
}

function SectionRule({ label, eyebrow }: { label: string; eyebrow: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-3 border-b border-[var(--color-navy-900)] pb-2">
      <h2 className="font-serif-display text-xl font-bold uppercase tracking-wide text-[var(--color-navy-900)]">
        {label}
      </h2>
      <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-ink-muted)]">
        {eyebrow}
      </span>
    </div>
  );
}

function Exclusive({ item }: { item: NewsItem }) {
  return (
    <div className="flex items-center gap-2">
      <span className="border border-[var(--color-navy-900)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-navy-900)]">
        Exclusive
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: "var(--color-navy-600)" }}
      >
        {item.category ?? "Market"} Report
      </span>
    </div>
  );
}

function KickerCat({ item, small = false }: { item: NewsItem; small?: boolean }) {
  if (!item.category) return null;
  return (
    <p
      className={`font-bold uppercase tracking-[0.22em] ${small ? "text-[10px]" : "text-[11px]"}`}
      style={{ color: "var(--color-navy-600)" }}
    >
      {item.category}
    </p>
  );
}

function Byline({ item, className = "" }: { item: NewsItem; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 text-[12px] text-[var(--color-ink-muted)] ${className}`}
    >
      <span className="font-semibold text-[var(--color-navy-900)]">By {item.source}</span>
      <span>·</span>
      <time dateTime={item.published_at ?? undefined}>{formatPublishedAt(item.published_at)}</time>
    </div>
  );
}

/** 기간 세그먼트(전체/오늘/이번 주/이번 달) — 클라이언트 측 최신성 필터.
 *  "전체"는 비필터라 초기 SSR 렌더에서 Date 호출이 없어 하이드레이션 불일치가 없다. */
function filterByPeriod(items: NewsItem[], period: string): NewsItem[] {
  if (period === "전체") return items;
  const today = todayKST(); // "YYYY-MM-DD" (KST)
  return items.filter((n) => {
    if (!n.published_at) return false;
    const pub = new Date(n.published_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    if (period === "오늘") return pub === today;
    const diff = daysBetween(pub, today);
    if (period === "이번 주") return diff >= 0 && diff <= 7;
    if (period === "이번 달") return diff >= 0 && diff <= 31;
    return true;
  });
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "2026.06.24 (수)" — TZ 고정이라 서버/클라이언트 동일 출력. */
function kstDateLabel(): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} (${get("weekday")})`;
}

/** 실데이터 NewsItem → LogisightNewsTop의 Pick. 지표 기반 선정 소스가 없으므로 조회수(views)는
 *  싣지 않고, 선정 근거는 "최신 헤드라인"으로 정직하게 표기한다. */
function toPick(item: NewsItem): NewsPick {
  const internal = isInternalNewsItem(item);
  return {
    category: item.category ?? "뉴스",
    why: "최신 헤드라인",
    headline: item.title,
    source: item.source,
    date: formatPublishedAt(item.published_at),
    imageUrl: item.image_url ?? undefined,
    internal,
    href: internal ? undefined : item.url,
    periodLabel: "",
  };
}

function NewsItemLink({
  item,
  className,
  children,
}: {
  item: NewsItem;
  className?: string;
  children: ReactNode;
}) {
  return isInternalNewsItem(item) ? (
    <Link to="/article/$slug" params={{ slug: articleParam(item) }} className={className}>
      {children}
    </Link>
  ) : (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
