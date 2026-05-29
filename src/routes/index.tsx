import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  freightIndicesQueryOptions,
  formatIndexValue,
} from "@/lib/api/freight-indices";
import {
  latestNewsQueryOptions,
  formatPublishedAt,
} from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(freightIndicesQueryOptions());
    context.queryClient.ensureQueryData(
      latestNewsQueryOptions({ lang: "ko", limit: 6 }),
    );
  },
  head: () => ({
    meta: [
      { title: "Logisight — 물류를 읽는 새로운 시선" },
      {
        name: "description",
        content:
          "운임 지수와 시장 뉴스, 정책 변화. 흩어진 정보를 매주 한 편의 분석으로 정리합니다.",
      },
      { property: "og:title", content: "Logisight — 물류를 읽는 새로운 시선" },
      {
        property: "og:description",
        content: "운임 지수와 시장 뉴스, 정책 변화. 매주 한 편의 분석으로 정리합니다.",
      },
    ],
  }),
  component: Index,
});

function HeroCard({ code, sub }: { code: string; sub: string }) {
  const { data } = useSuspenseQuery(freightIndicesQueryOptions());
  const row = data?.find((r) => r.index_code === code);
  const value = formatIndexValue(row?.value ?? null);
  const change = row?.change_pct;
  const changeLabel =
    change == null
      ? "수집 예정"
      : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% WoW`;
  const changeColor =
    change == null
      ? "text-white/50"
      : change >= 0
        ? "text-emerald-300"
        : "text-rose-300";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{code}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
      <div className={`text-[11px] tabular-nums ${changeColor}`}>
        {sub} · {changeLabel}
      </div>
    </div>
  );
}

function Index() {
  return (
    <>
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-navy-800) 100%)",
      }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-5 lg:gap-12 lg:px-6 lg:py-20">
        <div className="lg:col-span-3">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-cyan)" }}
          >
            Logistics Intelligence Platform
          </p>
          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight text-white lg:text-5xl">
            물류를 읽는
            <br />
            <span style={{ color: "var(--color-cyan)" }}>새로운 시선</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/75 lg:text-base">
            운임 지수와 시장 뉴스, 정책 변화. 흩어진 정보를 매주 한 편의 분석으로 정리합니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/news"
              className="inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold"
              style={{
                background: "var(--color-cyan)",
                color: "var(--color-navy-900)",
              }}
            >
              이번 주 분석 보기
            </a>
            <a
              href="/rates"
              className="inline-flex h-10 items-center rounded-md border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/5"
            >
              운임 대시보드
            </a>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <HeroCard code="SCFI" sub="상하이→유럽 종합" />
            <HeroCard code="WCI" sub="드류리 종합" />
            <HeroCard code="KCCI" sub="한국형 종합" />
            <HeroCard code="CCFI" sub="중국 수출 종합" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-3 text-[11px] text-white/55 lg:px-6">
          출처: 공공데이터(PORT-MIS · 관세청 · 해양수산부) 기반 · 매주 업데이트
        </div>
      </div>
    </section>
    <HomeNewsSection />
    </>
  );
}

function HomeNewsSection() {
  const { data } = useSuspenseQuery(
    latestNewsQueryOptions({ lang: "ko", limit: 6 }),
  );
  const items = data ?? [];
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6 lg:py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-cyan-dark, var(--color-cyan))" }}
          >
            Market News
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-ink)] lg:text-3xl">
            시장 뉴스
          </h2>
        </div>
        <Link
          to="/news"
          className="text-sm font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          전체 보기 →
        </Link>
      </div>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && (
          <li className="text-sm text-[var(--color-ink-muted)]">
            수집 예정 (매주 업데이트)
          </li>
        )}
        {items.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </ul>
    </section>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <li>
      <article className="group h-full rounded-lg border border-[var(--color-line)] bg-white p-5 transition-shadow hover:shadow-md">
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
        <h3 className="mt-3 text-base font-bold leading-snug text-[var(--color-ink)] group-hover:text-[var(--color-navy-600)]">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            {item.title}
          </a>
        </h3>
        {item.summary && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {item.summary}
          </p>
        )}
      </article>
    </li>
  );
}
