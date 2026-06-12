import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { freightIndicesQueryOptions } from "@/lib/api/freight-indices";
import { nyfiQueryOptions } from "@/lib/api/nyfi";
import {
  latestNewsQueryOptions,
  formatPublishedAt,
} from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";
import { articleParam } from "@/lib/api/article";
import {
  latestBriefingQueryOptions,
  formatBriefingDate,
} from "@/lib/api/briefing";
import {
  freightIndicesHistoryQueryOptions,
  indexStatsQueryOptions,
  kitaAirRatesQueryOptions,
  latestByRoute,
  computeMoM,
  orderedTickerStats,
} from "@/lib/api/rates";
import { DashboardTicker } from "@/components/dashboard/DashboardTicker";
import {
  computeOceanPressureSignal,
  computeGlobalMomentumSignal,
  computeAirModalShiftSignal,
  type FreightIndexPoint,
} from "@/server/signals";
import { RatesBrief } from "@/components/dashboard/RatesBrief";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import { publishedForecastsQueryOptions, hitRate } from "@/lib/api/forecasts";
import { useState } from "react";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(freightIndicesQueryOptions());
    context.queryClient.ensureQueryData(nyfiQueryOptions());
    context.queryClient.ensureQueryData(
      latestNewsQueryOptions({ lang: "ko", limit: 8 }),
    );
    context.queryClient.ensureQueryData(latestBriefingQueryOptions());
    context.queryClient.ensureQueryData(freightIndicesHistoryQueryOptions());
    context.queryClient.ensureQueryData(indexStatsQueryOptions());
    context.queryClient.ensureQueryData(kitaAirRatesQueryOptions());
    context.queryClient.ensureQueryData(alertCandidatesQueryOptions());
    context.queryClient.ensureQueryData(publishedForecastsQueryOptions());
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
      { property: "og:url", content: "https://logisight-core.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/" }],
  }),
  component: Index,
});

/* -------------------- Hero (다크 네이비 + 월드맵 도트 + 컨테이너선 블리드) -------------------- */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* dotted continents — world-map silhouette */}
      <div
        className="absolute inset-0 left-[30%]"
        style={{
          WebkitMaskImage: "url('/world-map.svg')",
          maskImage: "url('/world-map.svg')",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center right",
          maskPosition: "center right",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          backgroundImage:
            "radial-gradient(circle, rgba(56,189,248,0.38) 1.2px, transparent 1.8px)",
          backgroundSize: "13px 13px",
          opacity: 0.5,
        }}
      />
      {/* container-ship bleed (right) */}
      <div
        className="absolute inset-y-0 right-0 w-[72%] bg-cover opacity-50 lg:w-[54%] lg:opacity-90"
        style={{
          backgroundImage: "url(/dashboard-hero.png)",
          backgroundPosition: "right center",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 44%)",
          maskImage: "linear-gradient(90deg, transparent, #000 44%)",
        }}
      />
    </div>
  );
}

function HeroStatusChips() {
  const { data: idx } = useSuspenseQuery(freightIndicesQueryOptions());
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: forecasts } = useSuspenseQuery(publishedForecastsQueryOptions());

  const asOf =
    (idx ?? []).find((r) => r.index_code === "KCCI")?.week_date?.slice(0, 10) ??
    (idx ?? [])[0]?.week_date?.slice(0, 10) ??
    null;
  const alertCount = (alerts ?? []).length;
  const { rate } = hitRate(forecasts ?? []);

  const chips: { label: string; value: string; color: string }[] = [];
  if (asOf) chips.push({ label: "기준일", value: asOf, color: "var(--color-cyan)" });
  chips.push({
    label: "활성 리스크",
    value: `${alertCount}건`,
    color: "var(--color-status-alert)",
  });
  if (rate != null)
    chips.push({
      label: "전망 적중률",
      value: `${rate}%`,
      color: "var(--color-status-normal)",
    });

  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-white/[0.16] bg-white/[0.08] px-3.5 py-[7px] text-[13px] font-semibold text-white/85 backdrop-blur"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
          {c.label}
          <b className="font-bold text-white" style={{ fontFamily: "var(--font-mono)" }}>
            {c.value}
          </b>
        </span>
      ))}
    </div>
  );
}

function Index() {
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const tickerItems = orderedTickerStats(stats).map((stat) => ({
    code: stat.index_code,
    value: stat.latest_value!.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    changePct: stat.change_pct,
  }));

  return (
    <>
    <DashboardTicker items={tickerItems} />
    <section
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(100deg, #0a1f3c 0%, #0f2d5a 46%, #173f73 100%)",
      }}
    >
      <HeroBackdrop />
      <div className="relative z-10 mx-auto max-w-[1540px] px-4 pb-12 pt-14 lg:px-12">
        <p
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--color-cyan)" }}
        >
          Logistics Intelligence Platform
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">
          <span style={{ color: "#f1f5f5" }}>물류를 읽는</span>
          <br />
          <span style={{ color: "#2DD4BF" }}>
            {"    "}새로운 시선
          </span>
        </h1>
        <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-white/82">
          운임·교역·정책·유라시아 회랑을 매주 한 편의 분석으로.
          <br />
          흩어진 데이터를 한 화면에서 읽고 분석하세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/forecasts"
            search={{ dir: [], series: [] }}
            className="inline-flex h-10 items-center rounded-md bg-white px-[18px] text-[13.5px] font-bold text-[var(--color-navy-900)] transition-opacity hover:opacity-90"
          >
            이번 주 분석 보기
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex h-10 items-center rounded-md border border-white/[0.32] bg-white/10 px-[18px] text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            운임 대시보드
          </Link>
        </div>
        <HeroStatusChips />
      </div>
    </section>

    {/* 출처 밴드 */}
    <div style={{ background: "var(--color-navy-900)" }}>
      <div className="mx-auto max-w-[1540px] px-4 py-[11px] text-xs text-white/[0.62] lg:px-12">
        출처: 공공데이터(PORT-MIS · 관세청 · 해양수산부) 기반 · 매주 업데이트
      </div>
    </div>

    <DashboardSection />
    <IndustryInsightsSection />
    </>
  );
}

function DashboardSection() {
  return (
    <section
      className="border-t border-[var(--color-line)]"
      style={{ background: "var(--color-surface-alt, #f7f9fc)" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column flows independently: rates brief → news */}
          <div className="space-y-8 lg:col-span-2">
            <HomeRatesBrief />
            <NewsBlock />
          </div>
          {/* Right column: weekly briefing → newsletter → 광고 */}
          <aside className="space-y-6">
            <WeeklyBriefingBlock />
            <NewsletterSidebar />
            <AdCard />
          </aside>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Rates Intelligence Brief (from /rates) -------------------- */
function HomeRatesBrief() {
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());

  const byCode = new Map<string, FreightIndexPoint[]>();
  for (const r of history) {
    const arr = byCode.get(r.index_code) ?? [];
    arr.push({ week_date: r.week_date, value: r.value, change_pct: r.change_pct });
    byCode.set(r.index_code, arr);
  }
  const kcciSeries = byCode.get("KCCI") ?? [];
  const scfiSeries = byCode.get("SCFI") ?? [];
  const wciSeries = byCode.get("WCI") ?? [];
  const kcciStat = stats.find((s) => s.index_code === "KCCI") ?? null;

  const oceanSignal = computeOceanPressureSignal(kcciSeries);
  const globalSignal = computeGlobalMomentumSignal(scfiSeries, wciSeries);

  const latestAir = latestByRoute(airRates);
  const airModalData =
    latestAir
      .map((r) => {
        const series = airRates
          .filter((a) => a.origin === r.origin && a.dest === r.dest)
          .map((a) => ({ year_mon: a.year_mon, value: a.kg300 }));
        const mom = r.chg300 ?? computeMoM(series);
        return { r, mom };
      })
      .filter((c) => c.mom !== null)
      .sort((a, b) => Math.abs(b.mom!) - Math.abs(a.mom!))
      .at(0) ?? null;

  const airModalSignal = computeAirModalShiftSignal(
    airModalData?.mom ?? null,
    airModalData ? `인천→${airModalData.r.dest}` : "인천발",
    kcciStat?.pct_52w ?? null,
    airModalData?.r.year_mon ?? null,
  );

  return (
    <div>
      <RatesBrief
        signals={[oceanSignal, globalSignal, airModalSignal]}
        asOf={kcciStat?.latest_date?.slice(0, 10) ?? null}
      />
      <Link
        to="/rates"
        className="mt-3 inline-block text-xs font-semibold text-[var(--color-navy-600)]"
      >
        운임 대시보드 전체 보기 →
      </Link>
    </div>
  );
}

/* -------------------- Weekly Briefing (vertical) -------------------- */
function WeeklyBriefingBlock() {
  const { data } = useSuspenseQuery(latestBriefingQueryOptions());
  const briefing = data?.briefing ?? null;
  const points = data?.points ?? [];

  const categoryMap: Record<string, { label: string; tone: string }> = {
    shipping: { label: "시황", tone: "var(--color-cyan)" },
    corp: { label: "기업", tone: "var(--color-cyan)" },
    brief: { label: "글로벌", tone: "var(--color-cyan)" },
  };

  return (
    <article className="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
          >
            주간 인사이트
          </span>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-ink)] lg:text-2xl">
            {briefing?.title ?? "주간 시장 브리핑"}
          </h2>
          {briefing?.week_of && (
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {formatBriefingDate(briefing.week_of)} · 시황 · 기업 · 글로벌
            </p>
          )}
        </div>
      </div>
      {!briefing ? (
        <div className="mt-5 rounded-md border border-dashed border-[var(--color-line)] p-8 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            이번 주 브리핑을 준비 중입니다.
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]/80">
            매주 월요일 발행 · 수집 예정
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-5 grid gap-3">
            {(["shipping", "corp", "brief"] as const).map((cat) => {
              const item =
                points.find((p) => p.agent_type === cat) ??
                points.find((p) => p.category === cat);
              const meta = categoryMap[cat];
              return (
                <li key={cat}>
                  <div className="h-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-alt,#f7f9fc)] p-4">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
                      <span style={{ color: meta.tone }}>{meta.label}</span>
                      <span className="text-[var(--color-ink-muted)]/70">
                        BY {cat.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug text-[var(--color-ink)]">
                      {item?.headline ?? "수집 예정"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
            <span>
              {formatBriefingDate(briefing.published_at)} 발행 · 매주 월요일
            </span>
            <Link to="/briefing" className="font-semibold text-[var(--color-navy-600)]">
              전체 분석 읽기 →
            </Link>
          </div>
        </>
      )}
    </article>
  );
}

/* -------------------- News Block (featured + grid + tabs) -------------------- */
const NEWS_TABS = ["전체", "해상", "항공", "철도·CIS", "물류", "무역"] as const;
type NewsTab = (typeof NEWS_TABS)[number];

function NewsBlock() {
  const [tab, setTab] = useState<NewsTab>("전체");
  const { data } = useSuspenseQuery(latestNewsQueryOptions({ lang: "ko", limit: 12 }));
  const all = data ?? [];
  const filtered =
    tab === "전체" ? all : all.filter((n) => (n.category ?? "") === tab);
  const featured = filtered[0];
  const rest = filtered.slice(1, 7);

  return (
    <article>
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-bold text-[var(--color-ink)] lg:text-2xl">
          오늘의 물류 뉴스
        </h2>
        <Link to="/news" className="text-xs font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          전체 보기 →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-b border-[var(--color-line)]">
        {NEWS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t
                ? "border-[var(--color-navy-600)] text-[var(--color-navy-600)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-card)] p-8 text-center text-sm text-[var(--color-ink-muted)]">
          수집 예정 (매주 업데이트)
        </p>
      ) : (
        <>
          {featured && <FeaturedNewsCard item={featured} />}
          {rest.length > 0 && (
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {rest.map((n) => (
                <SmallNewsCard key={n.id} item={n} />
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

function FeaturedNewsCard({ item }: { item: NewsItem }) {
  return (
    <Link
      to="/article/$slug"
      params={{ slug: articleParam(item) }}
      className="mt-5 grid gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4 transition-shadow hover:shadow-md sm:grid-cols-[200px_1fr]"
    >
      <div
        className="aspect-[4/3] w-full overflow-hidden rounded-md bg-[var(--color-surface-alt,#eef2f7)] sm:aspect-auto sm:h-full"
        style={{
          backgroundImage: item.image_url ? `url(${item.image_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
          {item.category && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-semibold"
              style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
            >
              {item.category}
            </span>
          )}
          <span
            className="rounded-sm px-1.5 py-0.5 font-semibold"
            style={{ background: "var(--color-cyan)", color: "var(--color-navy-900)" }}
          >
            FEATURED
          </span>
        </div>
        <h3 className="mt-2 text-lg font-bold leading-snug text-[var(--color-ink)]">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
            {item.summary}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          {item.source} · {formatPublishedAt(item.published_at)}
        </p>
      </div>
    </Link>
  );
}

function SmallNewsCard({ item }: { item: NewsItem }) {
  return (
    <li>
      <Link
        to="/article/$slug"
        params={{ slug: articleParam(item) }}
        className="group block h-full rounded-md border border-[var(--color-line)] bg-[var(--color-card)] p-4 transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
          {item.category && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-semibold"
              style={{ background: "var(--color-navy-900)", color: "var(--color-cyan)" }}
            >
              {item.category}
            </span>
          )}
        </div>
        <h4 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-ink)] group-hover:text-[var(--color-navy-600)]">
          {item.title}
        </h4>
        <p className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
          {item.source} · {formatPublishedAt(item.published_at)}
        </p>
      </Link>
    </li>
  );
}

/* -------------------- Newsletter sidebar -------------------- */
function NewsletterSidebar() {
  return (
    <section
      className="rounded-lg border border-white/10 p-4 text-white shadow-sm"
      style={{ background: "var(--color-navy-900)" }}
    >
      <h3 className="text-sm font-bold text-white">📨 주간 뉴스레터</h3>
      <p className="mt-1 text-[11px] text-white/70">
        매주 월요일, 한 편의 분석으로 정리해 보내드립니다.
      </p>
      <div className="mt-3">
        <NewsletterForm compact />
      </div>
    </section>
  );
}

/* -------------------- 광고 카드 (MTL Truck LCL) -------------------- */
function AdCard() {
  return (
    <a
      href="mailto:sales@mtlship.com"
      className="block overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3.5 py-2">
        <span className="text-[10.5px] font-bold tracking-[0.1em] text-[var(--color-ink-muted)]">
          SPONSORED · 광고
        </span>
        <span
          className="text-[10.5px] text-[var(--color-ink-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          MTL Shipping Agency
        </span>
      </div>
      <img
        src="/ad-mtl-truck-lcl.png"
        alt="MTL Truck LCL 서비스 — 빠른 출발, 신뢰성 있는 배송, 소형 화물에 적합"
        className="block h-auto w-full"
        loading="lazy"
      />
    </a>
  );
}

/* -------------------- Industry Insights -------------------- */
function IndustryInsightsSection() {
  const cards: {
    icon: string;
    title: string;
    desc: string;
    to: "/eurasia" | "/industries" | "/trade" | "/policy";
  }[] = [
    {
      icon: "🚉",
      title: "철도 인사이트",
      desc: "TCR·TSR 노선의 평균 운송일수와 지연 패턴",
      to: "/eurasia",
    },
    {
      icon: "↗",
      title: "교역 인사이트",
      desc: "HS 챕터별 수출입 동향 (관세청 기준)",
      to: "/trade",
    },
    {
      icon: "⚠️",
      title: "리스크 인사이트",
      desc: "주요 항만 disruption 이벤트 추적",
      to: "/policy",
    },
  ];
  return (
    <section
      className="border-t border-[var(--color-line)]"
      style={{ background: "var(--color-surface-alt, #f7f9fc)" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-12">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--color-ink)] lg:text-2xl">
            산업별 물류 인사이트
          </h2>
          <Link
            to="/industries"
            className="text-xs font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            전체 보기 →
          </Link>
        </div>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <li key={c.title}>
              <Link
                to={c.to}
                className="block h-full rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 transition-shadow hover:shadow-md"
              >
                <div className="text-xl">{c.icon}</div>
                <h3 className="mt-3 text-[15px] font-bold text-[var(--color-ink)]">{c.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                  {c.desc}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
