// 홈 리디자인 — 사용자 제공 샘플(LogisightHome) 디자인을 실데이터/실링크로 연결.
// 더미 배열 → 기존 query options. 카드 narrative/브리프 본문은 AI 생성물에서만(하드카피 금지).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  indexStatsQueryOptions,
  freightIndicesHistoryQueryOptions,
  kitaAirRatesQueryOptions,
} from "@/lib/api/rates";
import { riskSnapshotQueryOptions } from "@/lib/api/risk";
import { alertCandidatesQueryOptions } from "@/lib/api/alerts";
import { latestRatesBriefQueryOptions, isFresh } from "@/lib/api/rates-brief";
import { latestNewsQueryOptions, formatPublishedAt } from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/news";
import { latestBriefingQueryOptions, formatBriefingDate } from "@/lib/api/briefing";
import { articleParam } from "@/lib/api/article";
import {
  computeOceanPressureSignal,
  computeAirModalShiftSignal,
  type FreightIndexPoint,
} from "@/server/signals";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { toTickerItems, aggregatePortCongestion, pickAirMoM } from "@/lib/home-view-model";
import { HomeNav } from "./HomeNav";
import { HomeFooter } from "./HomeFooter";

const WRAP = "mx-auto w-full max-w-[1360px] px-[18px] min-[620px]:px-7";
const NA = "데이터 수집 중";

const STYLE = `
.lsg-root{font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-feature-settings:"tnum" 1;letter-spacing:0}
@keyframes lsg-slide{to{transform:translateX(-50%)}}
@keyframes lsg-pulse{0%{transform:scale(.6);opacity:.5}100%{transform:scale(2.4);opacity:0}}
.lsg-track{animation:lsg-slide 38s linear infinite}
.lsg-ticker:hover .lsg-track{animation-play-state:paused}
.lsg-pulse::after{content:"";position:absolute;inset:-4px;border-radius:9999px;background:#14b8a6;opacity:.35;animation:lsg-pulse 2s ease-out infinite}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
@media (prefers-reduced-motion:reduce){.lsg-track,.lsg-pulse::after{animation:none}}
`;

/* ============================ ICONS ============================ */
function IconTrend() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v5h-5" /></svg>);
}
function IconPort() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M5 21V10l7-4 7 4v11M9 21v-6h6v6" /></svg>);
}
function IconRisk() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>);
}
function IconPlane() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 4.8c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>);
}

function MiniTrend({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-[72px]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 188 + 1;
    const y = 66 - ((value - min) / range) * 54;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 190 72" preserveAspectRatio="none" aria-hidden>
      <path d="M1 66H189" stroke="#d7dee8" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="#14b8a6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-[72px] items-end gap-[7px] border-b border-[#d7dee8] px-1">
      {values.map((value, index) => (
        <span key={index} className="min-w-0 flex-1 rounded-t-[2px] bg-[#14b8a6]" style={{ height: `${Math.max(18, (value / max) * 100)}%`, opacity: .68 + (index / Math.max(values.length - 1, 1)) * .32 }} />
      ))}
    </div>
  );
}

/* ============================ HERO ART ============================ */
function HeroArt({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src="/logisight-hero-navigator.webp"
      alt=""
      width={1536}
      height={1024}
      decoding="async"
      fetchPriority="high"
    />
  );
}

/* ============================ SHARED ============================ */
type SecLabelTo = "/rates" | "/news" | "/industries";
function SecLabel({ title, link, to }: { title: string; link: string; to: SecLabelTo }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[21px] font-bold tracking-[-0.02em] text-[#1a2433]">{title}</h2>
      <Link to={to} className="text-[13px] text-[#828d9d] transition-colors hover:text-[#0d9488]">{link}</Link>
    </div>
  );
}

function fmtPct(p: number | null): { t: string; cls: string } {
  if (p == null) return { t: "—", cls: "text-[#828d9d]" };
  const cls = p > 0 ? "text-[#16a34a]" : p < 0 ? "text-[#e11d48]" : "text-[#828d9d]";
  const g = p > 0 ? "▲ +" : p < 0 ? "▼ " : "— ";
  return { t: `${g}${p.toFixed(2)}%`, cls };
}

/* ============================ TICKER ============================ */
function Ticker() {
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const items = toTickerItems(stats);
  if (items.length === 0) return null;
  const row = [...items, ...items];
  return (
    <div className="lsg-ticker overflow-hidden border-b border-[#78a0cd1c]" style={{ background: "linear-gradient(180deg,#0a0f1d,#070b16)" }}>
      <div className="lsg-track flex w-max">
        {row.map((it, i) => (
          <div key={i} className="flex items-center gap-[9px] whitespace-nowrap border-r border-[#78a0cd1c] px-[22px] py-2.5 text-[12.5px]">
            <b className="font-semibold tracking-[0.04em] text-[#93a1b7]">{it.sym}</b>
            <span className="lsg-mono font-medium text-[#e9eef7]">{it.value}</span>
            <span className={`lsg-mono text-[11.5px] ${it.dir === "up" ? "text-[#22c55e]" : it.dir === "down" ? "text-[#f43f5e]" : "text-[#94a3b8]"}`}>{it.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ HERO ============================ */
function Hero() {
  return (
    <section className="relative min-h-[605px] overflow-hidden bg-[#070b16]">
      <div className="pointer-events-none absolute inset-0">
        <HeroArt className="absolute right-[2vw] top-[42%] hidden w-[1120px] max-w-none -translate-y-1/2 opacity-100 min-[760px]:block" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(92% 92% at 78% 38%, rgba(45,212,191,.1), transparent 62%), linear-gradient(90deg, #070b16 27%, rgba(7,11,22,.86) 42%, rgba(7,11,22,.3) 60%, transparent 80%)" }} />
      </div>
      <div className={`${WRAP} relative z-[1]`}>
        <div className="max-w-[650px] pt-14 pb-16 min-[620px]:pt-[28px] min-[620px]:pb-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">LOGISIGHT · 물류를 읽는 새로운 시선</span>
          <h1 className="mt-[18px] text-[clamp(42px,5vw,64px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#e9eef7]">내일을 읽는<br /><span className="text-[#2dd4bf]">물류 인텔리전스</span></h1>
          <p className="mt-[22px] max-w-[560px] text-[17px] leading-[1.65] text-[#a7b4c7]">과거의 흐름과 현재의 신호를 분석해<br className="hidden min-[620px]:block" /> 다음 변화를 전망합니다.</p>
          <div className="mt-[34px] flex flex-wrap items-center gap-3">
            <Link to="/briefing" className="rounded-[9px] border border-[#2dd4bf] bg-[#2dd4bf] px-[22px] py-[13px] text-[14.5px] font-bold text-[#04231f] transition-transform hover:-translate-y-px hover:bg-[#5eead4]">이번 주 시장 브리핑</Link>
            <Link to="/rates" className="rounded-[9px] border border-[#2dd4bf] bg-transparent px-[22px] py-[13px] text-[14.5px] font-semibold text-[#e9eef7] transition-transform hover:-translate-y-px hover:bg-white/5">운임 대시보드</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ LIVE PANEL ============================ */
function MarketCard({ label, icon, value, delta, unit, foot, dot }: {
  label: string; icon: React.ReactNode; value: React.ReactNode;
  delta: { t: string; cls: string }; unit: string; foot: React.ReactNode; dot: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[14px] border border-[#d4dce7] bg-[#f1f4f8] pt-5 px-[18px] pb-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[#c5cfdc] hover:shadow-[0_16px_34px_-20px_rgba(16,24,40,0.28)]">
      <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#0d9488] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#0d9488]">{label}</span>
        <span className="text-[#828d9d]">{icon}</span>
      </div>
      <div className="lsg-mono text-[30px] font-bold leading-none tracking-[-0.02em] text-[#1a2433]">{value}</div>
      <div className="mt-[7px] flex items-baseline gap-2.5">
        <span className={`lsg-mono text-[13px] ${delta.cls}`}>{delta.t}</span>
        <span className="text-[12px] text-[#828d9d]">{unit}</span>
      </div>
      <div className="mt-3.5 flex items-center gap-2 border-t border-[#d4dce7] pt-[11px] text-[12px] leading-snug text-[#54606f]">
        <span className={`mt-[5px] h-[7px] w-[7px] flex-none self-start rounded-full ${dot}`} />
        <span className="min-w-0">{foot}</span>
      </div>
    </article>
  );
}

function LivePanel() {
  const { data: stats } = useSuspenseQuery(indexStatsQueryOptions());
  const { data: history } = useSuspenseQuery(freightIndicesHistoryQueryOptions());
  const { data: airRates } = useSuspenseQuery(kitaAirRatesQueryOptions());
  const { data: alerts } = useSuspenseQuery(alertCandidatesQueryOptions());
  const { data: risk } = useSuspenseQuery(riskSnapshotQueryOptions());

  const kcci = stats.find((s) => s.index_code === "KCCI") ?? null;
  const kcciSeries: FreightIndexPoint[] = history
    .filter((r) => r.index_code === "KCCI")
    .map((r) => ({ week_date: r.week_date, value: r.value, change_pct: r.change_pct }));
  const ocean = computeOceanPressureSignal(kcciSeries);

  const air = pickAirMoM(airRates);
  const airSignal = computeAirModalShiftSignal(air.mom, air.routeLabel, kcci?.pct_52w ?? null, air.yearMon);

  const port = aggregatePortCongestion(risk);
  const scfi = stats.find((s) => s.index_code === "SCFI") ?? null;
  const kcciTrend = kcciSeries.filter((point) => point.value != null).slice(-16).map((point) => point.value as number);
  const airByMonth = new Map<string, number[]>();
  for (const row of airRates) {
    if (row.kg100 == null) continue;
    const values = airByMonth.get(row.year_mon) ?? [];
    values.push(row.kg100);
    airByMonth.set(row.year_mon, values);
  }
  const airTrend = [...airByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-9)
    .map(([, values]) => values.reduce((sum, value) => sum + value, 0) / values.length);

  return (
    <section>
      <div className={`${WRAP} rounded-[22px] border border-white/80 bg-[#f7f9fc] py-[26px] shadow-[0_28px_70px_-42px_rgba(2,8,23,.7)]`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-[18px]">
          <div className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[#1a2433]">
            <span className="inline-flex items-center gap-[7px] text-[11px] tracking-[0.14em] text-[#0d9488]">
              <span className="lsg-pulse relative h-[7px] w-[7px] rounded-full bg-[#14b8a6]" />LIVE INTELLIGENCE
            </span>
            <span>· 시장 핵심 요약</span>
          </div>
          <div className="text-[12px] normal-case tracking-normal text-[#828d9d]">업데이트 <b className="font-medium text-[#54606f]">주간 단위</b> · 출처 KOBC(KCCI) · Portcast(항만 혼잡) · KITA(항공)</div>
        </div>
        <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-4">
          <MarketCard
            label="운임 · FREIGHT" icon={<IconTrend />} dot="bg-[#0d9488]"
            value={kcci?.latest_value != null ? kcci.latest_value.toLocaleString("en-US") : NA}
            delta={fmtPct(kcci?.change_pct ?? null)}
            unit="KCCI"
            foot={ocean ? ocean.basis : NA}
          />
          <MarketCard
            label="항만 · PORT" icon={<IconPort />} dot="bg-[#d97706]"
            value={port.value != null ? <>{port.value}<small className="text-[15px] text-[#828d9d]"> /100</small></> : NA}
            delta={{ t: "혼잡도 지수", cls: "text-[#828d9d]" }}
            unit="주요 항만 평균"
            foot={port.topPorts.length ? `상위 혼잡: ${port.topPorts.join(" · ")}` : NA}
          />
          <MarketCard
            label="리스크 · RISK" icon={<IconRisk />} dot="bg-[#ef4444]"
            value={<>{alerts.length}<small className="text-[15px] text-[#828d9d]"> 건</small></>}
            delta={{ t: alerts.length ? "활성" : "안정", cls: alerts.length ? "text-[#e11d48]" : "text-[#16a34a]" }}
            unit="주요 해협 모니터링"
            foot={alerts[0]?.title ?? NA}
          />
          <MarketCard
            label="항공 · AIR" icon={<IconPlane />} dot="bg-[#16a34a]"
            value={air.mom != null ? <>{air.mom >= 0 ? "+" : ""}{air.mom.toFixed(1)}<small className="text-[15px] text-[#828d9d]">% MoM</small></> : NA}
            delta={fmtPct(air.mom)}
            unit={`${air.routeLabel} · KITA 항공운임`}
            foot={airSignal ? airSignal.basis : NA}
          />
        </div>
        <div className="mt-8 border-t border-[#dce3ec] pt-6">
          <h2 className="mb-4 text-[22px] font-bold tracking-[-0.025em] text-[#152033]">이번 주 핵심 변화</h2>
          <div className="grid grid-cols-1 gap-3.5 min-[760px]:grid-cols-3">
            <article className="grid min-h-[138px] grid-cols-[1fr_190px] gap-4 rounded-[13px] border border-[#d4dce7] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.04)] max-[1100px]:grid-cols-1">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[9px] bg-[#111c2e] text-white"><IconTrend /></span>
                  <h3 className="text-[15px] font-bold text-[#172235]">해상 운임 52주 최고치 근접</h3>
                </div>
                <ul className="mt-3 space-y-1.5 text-[12px] leading-[1.45] text-[#566274]">
                  <li>• KCCI {kcci?.latest_value?.toLocaleString("en-US") ?? NA}{kcci?.change_pct != null ? `, 전주 대비 ${kcci.change_pct.toFixed(2)}%` : ""}</li>
                  <li>• SCFI {scfi?.change_pct != null ? `${scfi.change_pct >= 0 ? "+" : ""}${scfi.change_pct.toFixed(2)}%` : NA}, 주요 항로 흐름 관찰</li>
                </ul>
              </div>
              <MiniTrend values={kcciTrend} />
            </article>
            <article className="grid min-h-[138px] grid-cols-[1fr_170px] gap-4 rounded-[13px] border border-[#d4dce7] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.04)] max-[1100px]:grid-cols-1">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[9px] bg-[#111c2e] text-white"><IconPlane /></span>
                  <h3 className="text-[15px] font-bold text-[#172235]">항공 수요 대비 공급 변화</h3>
                </div>
                <ul className="mt-3 space-y-1.5 text-[12px] leading-[1.45] text-[#566274]">
                  <li>• 글로벌 항공 운임 월간 변화 {air.mom != null ? `${air.mom >= 0 ? "+" : ""}${air.mom.toFixed(1)}%` : NA}</li>
                  <li>• 주요 노선 운임 흐름 지속 모니터링</li>
                </ul>
              </div>
              <MiniBars values={airTrend} />
            </article>
            <article className="grid min-h-[138px] grid-cols-[1fr_180px] gap-4 rounded-[13px] border border-[#d4dce7] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.04)] max-[1100px]:grid-cols-1">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[9px] bg-[#111c2e] text-white">◎</span>
                  <h3 className="text-[15px] font-bold text-[#172235]">주요 항로 리스크 모니터링</h3>
                </div>
                <ul className="mt-3 space-y-1.5 text-[12px] leading-[1.45] text-[#566274]">
                  <li>• 활성 주의 신호 {alerts.length}건</li>
                  <li>• 지정학·기상·항만 변수 추적</li>
                </ul>
              </div>
              <div className="relative min-h-[82px] bg-[url('/world-map.svg')] bg-contain bg-center bg-no-repeat opacity-80">
                <span className="absolute left-[36%] top-[50%] h-3 w-3 rounded-full border-[3px] border-white bg-[#2dd4bf] shadow-[0_0_0_2px_rgba(45,212,191,.35)]" />
                <span className="absolute right-[23%] top-[58%] h-3 w-3 rounded-full border-[3px] border-white bg-[#2dd4bf] shadow-[0_0_0_2px_rgba(45,212,191,.35)]" />
              </div>
            </article>
          </div>
          <div className="mt-4 text-center"><Link to="/dashboard" className="text-[12px] font-bold text-[#0d9488]">전체 인사이트 보기 →</Link></div>
        </div>
      </div>
    </section>
  );
}

/* ============================ BRIEF (AI) ============================ */
function Brief() {
  const { data: brief } = useSuspenseQuery(latestRatesBriefQueryOptions());
  const fresh = isFresh(brief);
  const prose = fresh ? brief!.prose_json : null;
  const asOf = fresh ? brief!.as_of.slice(0, 10) : null;
  const bullets = prose ? [prose.ocean, prose.global, prose.air].filter(Boolean) : [];
  return (
    <article className="relative overflow-hidden rounded-[16px] border border-[#d4dce7] bg-[#f1f4f8] p-[26px] shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      <div className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#14b8a6,transparent 70%)" }} />
      <div className="mb-3.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.04em] text-[#0d9488]"><span className="h-[6px] w-[6px] rounded-full bg-[#14b8a6]" />WEEKLY BRIEF</span>
        {asOf && <span className="lsg-mono text-[12px] text-[#828d9d]">기준 {asOf}</span>}
      </div>
      {!prose ? (
        <p className="rounded-[8px] border border-dashed border-[#c5cfdc] bg-white/50 px-4 py-10 text-center text-[14px] text-[#828d9d]">{NA}</p>
      ) : (
        <>
          <h3 className="mb-3 text-[22px] font-bold leading-[1.35] tracking-[-0.025em] text-[#1a2433]">{prose.headline}</h3>
          <ul className="my-1 flex flex-col gap-[11px]">
            {bullets.map((b, i) => (
              <li key={i} className="relative pl-[18px] text-[14.5px] leading-[1.6] text-[#54606f]">
                <span className="absolute left-0 top-[9px] h-[6px] w-[6px] rounded-full bg-[#14b8a6]" />{b}
              </li>
            ))}
          </ul>
          {prose.outlook && (
            <div className="mt-[18px] rounded-[8px] border border-l-[3px] border-[#ccfbf1] border-l-[#0d9488] bg-[#e9f8f4] px-[15px] py-[13px] text-[13.5px] text-[#0f5f57]"><b className="font-bold text-[#0d9488]">전망 ·</b> {prose.outlook}</div>
          )}
        </>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-[#d4dce7] pt-3.5 text-[12px] text-[#828d9d]"><span>출처 · KCCI · SCFI · WCI · KITA 항공</span><Link to="/rates" className="font-semibold text-[#0d9488]">상세 분석 →</Link></div>
    </article>
  );
}

/* ============================ NEWS ============================ */
const NEWS_TABS = ["전체", "해상", "항공", "철도", "물류", "무역"] as const;
type NewsTab = (typeof NEWS_TABS)[number];

function FeaturedCard({ item }: { item: NewsItem }) {
  return (
    <Link to="/article/$slug" params={{ slug: articleParam(item) }} className="mb-3.5 grid grid-cols-1 overflow-hidden rounded-[14px] border border-[#d4dce7] bg-[#f1f4f8] shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#c5cfdc] hover:shadow-[0_16px_34px_-22px_rgba(16,24,40,0.3)] min-[620px]:grid-cols-[200px_1fr]">
      <div
        className="relative grid h-[120px] place-items-center min-[620px]:h-auto"
        style={item.image_url
          ? { backgroundImage: `url(${item.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: "linear-gradient(135deg,#0e2a3f,#13405c)" }}
      >
        {!item.image_url && <span className="text-[40px] text-[#5eead4]/60">✈</span>}
      </div>
      <div className="flex flex-col justify-center p-5">
        <div className="mb-2.5 inline-flex gap-1.5">
          {item.category && <span className="rounded-[5px] border border-[#ccfbf1] bg-[#e9f8f4] px-2 py-[3px] text-[10.5px] font-bold tracking-[0.05em] text-[#0d9488]">{item.category}</span>}
          <span className="rounded-[5px] bg-[#14b8a6] px-2 py-[3px] text-[10.5px] font-bold tracking-[0.05em] text-[#04231f]">FEATURED</span>
        </div>
        <h4 className="mb-[7px] text-[18px] font-bold leading-[1.35] tracking-[-0.02em] text-[#1a2433]">{item.title}</h4>
        {item.summary && <p className="mb-[11px] line-clamp-2 text-[13.5px] text-[#54606f]">{item.summary}</p>}
        <span className="lsg-mono text-[12px] text-[#828d9d]">{item.source} · {formatPublishedAt(item.published_at)}</span>
      </div>
    </Link>
  );
}

function SmallCard({ item }: { item: NewsItem }) {
  return (
    <Link to="/article/$slug" params={{ slug: articleParam(item) }} className="rounded-[12px] border border-[#d4dce7] bg-[#f1f4f8] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#c5cfdc] hover:shadow-[0_14px_28px_-20px_rgba(16,24,40,0.28)]">
      {item.category && <span className="rounded-[5px] border border-[#ccfbf1] bg-[#e9f8f4] px-[7px] py-0.5 text-[10.5px] font-bold tracking-[0.05em] text-[#0d9488]">{item.category}</span>}
      <h5 className="my-[11px] line-clamp-2 min-h-[40px] text-[14.5px] font-semibold leading-[1.4] tracking-[-0.015em] text-[#1a2433]">{item.title}</h5>
      <span className="lsg-mono text-[11.5px] text-[#828d9d]">{item.source} · {formatPublishedAt(item.published_at)}</span>
    </Link>
  );
}

function NewsSection() {
  const [tab, setTab] = useState<NewsTab>("전체");
  const { data } = useSuspenseQuery(latestNewsQueryOptions({ lang: "ko", limit: 12 }));
  const all = data ?? [];
  const filtered = tab === "전체" ? all : all.filter((n) => (n.category ?? "") === tab);
  const featured = filtered[0];
  const rest = filtered.slice(1, 7);
  return (
    <div className="mt-10">
      <SecLabel title="오늘의 뉴스" link="전체 보기 →" to="/news" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {NEWS_TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={t === tab
            ? "cursor-pointer rounded-full border border-[#14b8a6] bg-[#14b8a6] px-[13px] py-1.5 text-[12.5px] font-semibold text-[#04231f]"
            : "cursor-pointer rounded-full border border-[#d4dce7] bg-[#f1f4f8] px-[13px] py-1.5 text-[12.5px] text-[#54606f] transition-colors hover:border-[#0d9488] hover:text-[#0d9488]"}>{t}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[#c5cfdc] bg-[#f1f4f8] p-8 text-center text-[14px] text-[#828d9d]">수집 예정 (매주 업데이트)</p>
      ) : (
        <>
          {featured && <FeaturedCard item={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
              {rest.map((n) => <SmallCard key={n.id} item={n} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================ SIDEBAR ============================ */
function Sidebar() {
  const { data } = useSuspenseQuery(latestBriefingQueryOptions());
  const briefing = data?.briefing ?? null;
  const points = data?.points ?? [];
  return (
    <aside className="flex flex-col gap-[18px] min-[980px]:sticky min-[980px]:top-[82px]">
      <div className="rounded-[14px] border border-[#d4dce7] bg-[#f1f4f8] p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-[#0d9488]">주간 인사이트</div>
        <h3 className="mb-1 text-[18px] font-bold tracking-[-0.02em] text-[#1a2433]">{briefing?.title ?? "주간 시장 브리핑"}</h3>
        {briefing?.week_of && <div className="mb-4 lsg-mono text-[11.5px] text-[#828d9d]">{formatBriefingDate(briefing.week_of)} · 시황 · 기업 · 글로벌</div>}
        {!briefing ? (
          <p className="rounded-md border border-dashed border-[#c5cfdc] bg-white/50 px-3 py-6 text-center text-[13px] text-[#828d9d]">{NA}</p>
        ) : (
          <>
            {(["shipping", "corp", "brief"] as const).map((cat, i) => {
              const item = points.find((p) => p.agent_type === cat) ?? points.find((p) => p.category === cat);
              const label = cat === "shipping" ? "시황 · By Shipping" : cat === "corp" ? "기업 · By Corp" : "글로벌 · By Brief";
              return (
                <Link key={cat} to="/briefing" className={`group block border-t border-[#d4dce7] py-[13px] ${i === 0 ? "border-t-0 pt-0" : ""}`}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#828d9d]">{label}</span>
                  <div className="mt-[5px] text-[14px] font-semibold leading-[1.45] tracking-[-0.015em] text-[#1a2433] transition-colors group-hover:text-[#0d9488]">{item?.headline ?? "수집 예정"}</div>
                </Link>
              );
            })}
            <div className="mt-4 flex items-center justify-between border-t border-[#d4dce7] pt-3.5 text-[11.5px] text-[#828d9d]">
              <span className="lsg-mono">{formatBriefingDate(briefing.published_at)} 발행 · 매주 월요일</span>
              <Link to="/briefing" className="font-semibold text-[#0d9488]">전체 분석 →</Link>
            </div>
          </>
        )}
      </div>

      <div id="newsletter" className="rounded-[14px] border border-[#2dd4bf47] p-5 shadow-[0_18px_40px_-24px_rgba(13,80,73,0.6)]" style={{ background: "linear-gradient(150deg,#0e1626,#0c2a2a)" }}>
        <h3 className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.02em] text-white">📨 주간 뉴스레터</h3>
        <p className="mb-3.5 mt-2 text-[13px] text-[#9fb2c4]">매주 월요일, 한 편의 분석으로 정리해 보내드립니다.</p>
        <NewsletterForm compact />
        <small className="mt-2.5 block text-[11px] text-[#5d6b80]">주 1회 발송 · 언제든 구독 해지 가능</small>
      </div>

      <a href="mailto:sales@mtlship.com" className="block overflow-hidden rounded-[14px] border border-[#d4dce7] bg-[#f1f4f8] transition-shadow hover:shadow-[0_14px_28px_-20px_rgba(16,24,40,0.28)]">
        <div className="flex items-center justify-between border-b border-[#d4dce7] px-3.5 py-2 text-[10px] uppercase tracking-[0.1em] text-[#828d9d]"><span>Sponsored · 광고</span><span>MTL Shipping Agency</span></div>
        <img
          src="/ad-mtl-truck-lcl.png"
          alt="MTL Truck LCL 서비스 — 빠른 출발, 신뢰성 있는 배송, 소형 화물에 적합"
          className="block h-auto w-full"
          loading="lazy"
        />
      </a>
    </aside>
  );
}

/* ============================ BODY + INSIGHT ============================ */
function Body() {
  return (
    <section className="pt-11 pb-[60px]">
      <div className={WRAP}>
        <div className="grid grid-cols-1 items-start gap-[26px] min-[980px]:grid-cols-[1fr_360px]">
          <div>
            <SecLabel title="운임 인텔리전스" link="운임 대시보드 전체 보기 →" to="/rates" />
            <Brief />
            <NewsSection />
          </div>
          <Sidebar />
        </div>
      </div>
    </section>
  );
}

const INSIGHTS: { em: string; k: string; h: string; p: string; to: "/trade" | "/industries" | "/port-risk" }[] = [
  { em: "↗", k: "무역 인사이트", h: "HS 챕터별 수출입 동향", p: "관세청 통계 기준 월간 갱신", to: "/trade" },
  { em: "🏭", k: "산업 인사이트", h: "주요 산업별 물동량 · 운임 동향", p: "업종별 데이터 기반 분석", to: "/industries" },
  { em: "⚠️", k: "리스크 인사이트", h: "주요 항만 disruption 이벤트 추적", p: "실시간 신호등 모니터링", to: "/port-risk" },
];

function Insight() {
  return (
    <section className="border-t border-[#d4dce7] pt-12 pb-16">
      <div className={WRAP}>
        <SecLabel title="산업별 인사이트" link="전체 보기 →" to="/industries" />
        <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
          {INSIGHTS.map((c) => (
            <Link key={c.k} to={c.to} className="flex gap-3.5 rounded-[13px] border border-[#d4dce7] bg-[#f1f4f8] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#0d9488] hover:shadow-[0_14px_30px_-20px_rgba(13,148,136,0.3)]">
              <span className="flex-none text-[22px]">{c.em}</span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0d9488]">{c.k}</div>
                <h4 className="mb-1 mt-1.5 text-[15px] font-semibold tracking-[-0.015em] text-[#1a2433]">{c.h}</h4>
                <p className="text-[12.5px] leading-[1.5] text-[#54606f]">{c.p}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ PAGE ============================ */
export function LogisightHome() {
  return (
    <div className="lsg-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <Ticker />
      <HomeNav />
      <Hero />
      <div className="relative z-[2] -mt-[222px]" style={{ background: "linear-gradient(to bottom, transparent 222px, #e6eaf1 222px)" }}>
        <LivePanel />
        <div className="bg-[#e6eaf1]">
          <Body />
          <Insight />
        </div>
      </div>
      <HomeFooter />
    </div>
  );
}
