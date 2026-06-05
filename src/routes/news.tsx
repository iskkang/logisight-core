import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { ReactNode } from "react";

import {
  latestNewsQueryOptions,
  formatPublishedAt,
  todayKST,
} from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";
import { articleParam } from "@/lib/api/article";

const newsSearchSchema = z.object({
  cat: z.string().min(1).max(40).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const CATEGORIES: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "해상", label: "해상" },
  { value: "항공", label: "항공" },
  { value: "철도", label: "철도" },
  { value: "물류", label: "물류" },
  { value: "무역", label: "무역" },
];

export const Route = createFileRoute("/news")({
  validateSearch: newsSearchSchema,
  loaderDeps: ({ search }) => ({ cat: search.cat, date: search.date }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      latestNewsQueryOptions({ lang: "ko", limit: 40, category: deps.cat, date: deps.date }),
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
        content: "해상·항공·철도·물류·무역 분야의 글로벌 시장 뉴스를 한국어로 큐레이션.",
      },
      { property: "og:url", content: "https://logisight-core.lovable.app/news" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/news" }],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { cat, date } = Route.useSearch();
  const { data } = useSuspenseQuery(
    latestNewsQueryOptions({ lang: "ko", limit: 40, category: cat, date }),
  );
  const items: NewsItem[] = data ?? [];
  const [lead, ...rest] = items;
  const secondary = rest.slice(0, 2);
  const opinionStrip = rest.slice(2, 5);
  const gridSection = rest.slice(5, 14);
  const moreSection = rest.slice(14, 22);
  const mostPopular = items.slice(0, 6);

  return (
    <div className="bg-[var(--color-card)]">
      {/* Masthead */}
      <header className="border-b-[3px] border-double border-[var(--color-navy-900)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-[1280px] px-4 pb-3 pt-8 text-center lg:px-6">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: "var(--color-navy-600)" }}
          >
            Logisight · Market Desk
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            해상·항공·철도·물류·무역. 글로벌 공급망관련 뉴스
          </p>
          <p suppressHydrationWarning className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
              timeZone: "Asia/Seoul",
            })}
          </p>
        </div>

        {/* Section nav */}
        <nav className="border-t border-[var(--color-line)] bg-[var(--color-card)]">
          <ul className="mx-auto flex max-w-[1280px] items-center justify-center gap-1 overflow-x-auto px-4 py-2 text-[13px] lg:px-6">
            {CATEGORIES.map((c) => {
              const active = (cat ?? undefined) === c.value;
              return (
                <li key={c.label}>
                  <Link
                    to="/news"
                    search={c.value ? { cat: c.value } : {}}
                    className={`inline-block whitespace-nowrap rounded-sm px-3 py-1.5 font-semibold uppercase tracking-wider transition ${
                      active
                        ? "bg-[var(--color-navy-900)] text-white"
                        : "text-[var(--color-ink-muted)] hover:text-[var(--color-navy-900)]"
                    }`}
                  >
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Date navigator */}
        <div className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2 lg:px-6">
            <DateNavigator date={date} cat={cat} count={items.length} />
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="mx-auto max-w-[1280px] px-4 py-20 text-center text-sm text-[var(--color-ink-muted)] lg:px-6">
          해당 카테고리의 기사가 수집되는 대로 게재합니다.
        </div>
      ) : (
        <div className="mx-auto max-w-[1280px] px-4 py-10 lg:px-6 lg:py-14">
          {/* Section label */}
          <SectionRule
            label={date ? `${date.replace(/-/g, ".")} 뉴스` : "오늘의 헤드라인"}
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
                  Most Popular · 많이 본 기사
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
        </div>
      )}
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

function DateNavigator({
  date,
  cat,
  count,
}: {
  date: string | undefined;
  cat: string | undefined;
  count: number;
}) {
  const today = todayKST();
  const displayDate = date ?? today;

  function prevDay(d: string): string {
    const dt = new Date(`${d}T12:00:00+09:00`);
    dt.setDate(dt.getDate() - 1);
    return dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  }

  function nextDay(d: string): string {
    const dt = new Date(`${d}T12:00:00+09:00`);
    dt.setDate(dt.getDate() + 1);
    return dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  }

  const isToday = displayDate >= today;
  const baseSearch = cat ? { cat } : {};

  return (
    <div className="flex items-center gap-3 text-[13px]">
      {/* Prev arrow */}
      <Link
        to="/news"
        search={{ ...baseSearch, date: prevDay(displayDate) }}
        className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-navy-900)] hover:text-[var(--color-navy-900)]"
        aria-label="이전 날짜"
      >
        ←
      </Link>

      {/* Date label */}
      <span className="font-semibold text-[var(--color-navy-900)]">
        {date
          ? new Date(`${displayDate}T12:00:00+09:00`).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "Asia/Seoul",
            })
          : "전체 기간"}
        {date && (
          <span className="ml-1.5 text-[11px] font-normal text-[var(--color-ink-muted)]">
            ({count}건)
          </span>
        )}
      </span>

      {/* Next arrow — disabled when at today */}
      {isToday ? (
        <span
          className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded border border-[var(--color-line)] text-[var(--color-line)]"
          aria-disabled="true"
          aria-label="다음 날짜"
        >
          →
        </span>
      ) : (
        <Link
          to="/news"
          search={{ ...baseSearch, date: nextDay(displayDate) }}
          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-navy-900)] hover:text-[var(--color-navy-900)]"
          aria-label="다음 날짜"
        >
          →
        </Link>
      )}

      {/* 전체 기간 toggle */}
      <Link
        to="/news"
        search={baseSearch}
        className={`ml-2 rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
          !date
            ? "bg-[var(--color-navy-900)] text-white"
            : "border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-navy-900)] hover:text-[var(--color-navy-900)]"
        }`}
      >
        전체 기간
      </Link>
    </div>
  );
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
  // Every article opens the internal /article page (id fallback for slug-less
  // rows); the article page shows the summary + a 출처 link to the source.
  return (
    <Link to="/article/$slug" params={{ slug: articleParam(item) }} className={className}>
      {children}
    </Link>
  );
}
