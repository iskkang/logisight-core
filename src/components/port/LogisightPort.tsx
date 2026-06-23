// 포트(리스크) 페이지 — 사용자 제공 샘플(LogisightPort) 디자인을 risk 스냅샷 실데이터/실링크로 연결.
// 헤더/푸터는 홈과 동일한 HomeNav/HomeFooter 재사용(인사이트 활성). 인사이트 SubNav는 기존 8항목 그대로.
import { useId, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import { CargoImpactPanel } from "@/components/port/CargoImpactPanel";
import { policiesQueryOptions } from "@/lib/api/policies";
import {
  riskSnapshotQueryOptions,
  type ChokepointRiskRow,
  type PortRiskRow,
} from "@/lib/api/risk";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";
const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const CARD_H = "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#c8d2df] hover:shadow-[0_14px_30px_-20px_rgba(16,24,40,0.26)]";
const NA = "데이터 수집 중";

const STYLE = `
.lsgp-root{font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
@media (prefers-reduced-motion:reduce){.lsgp-root [data-anim]{display:none}}
`;

/* ---------- format helpers (DB 기준, 결측은 —) ---------- */
function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function fmtTeu(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000).toLocaleString("en-US")}k`;
  return `${Math.round(v).toLocaleString("en-US")}`;
}
function fmtDwell(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}일`;
}
function highestPortDelay(ports: PortRiskRow[]): PortRiskRow | null {
  return [...ports].sort((a, b) => (b.delayPercent ?? -1) - (a.delayPercent ?? -1))[0] ?? null;
}
function strongestChokepointMove(rows: ChokepointRiskRow[]): ChokepointRiskRow | null {
  return [...rows].sort((a, b) => Math.abs(b.wowPct ?? 0) - Math.abs(a.wowPct ?? 0))[0] ?? null;
}

/* ---------- spark (실 시계열만; 데이터 부족 시 렌더 안 함) ---------- */
function Spark({ vals, color, className }: { vals: (number | null)[]; color: string; className?: string }) {
  const rawId = useId();
  const id = "sp" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return null;
  const w = 100, h = 32;
  const min = Math.min(...nums), max = Math.max(...nums), rng = max - min || 1;
  const pts = nums.map((v, i) => `${((i / (nums.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============================ HERO ============================ */
function HeroRadar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 520 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="lsgp-rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.16" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" /></radialGradient>
        <linearGradient id="lsgp-sw" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient>
      </defs>
      <circle cx="300" cy="210" r="200" fill="url(#lsgp-rg)" />
      <g stroke="rgba(120,170,205,.18)" fill="none">
        <circle cx="300" cy="210" r="60" /><circle cx="300" cy="210" r="110" /><circle cx="300" cy="210" r="160" /><circle cx="300" cy="210" r="200" />
        <line x1="100" y1="210" x2="500" y2="210" /><line x1="300" y1="10" x2="300" y2="410" />
      </g>
      <path data-anim d="M300 210 L300 50 A160 160 0 0 1 440 290 Z" fill="url(#lsgp-sw)" opacity="0.5">
        <animateTransform attributeName="transform" type="rotate" from="0 300 210" to="360 300 210" dur="9s" repeatCount="indefinite" />
      </path>
      <g fill="#2dd4bf"><circle cx="360" cy="150" r="3" /><circle cx="250" cy="280" r="3" /><circle cx="390" cy="250" r="2.4" /><circle cx="220" cy="170" r="2.4" /></g>
      <circle data-anim cx="360" cy="150" r="3" fill="none" stroke="#2dd4bf">
        <animate attributeName="r" from="3" to="14" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.6" to="0" dur="2.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Hero({ onToggleImpact, impactOpen }: { onToggleImpact: () => void; impactOpen: boolean }) {
  return (
    <section className="relative overflow-hidden bg-[#070b16]">
      <div className="pointer-events-none absolute inset-0">
        <HeroRadar className="absolute right-[2%] top-1/2 w-[540px] max-w-[54%] -translate-y-1/2 opacity-85" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 82% 35%, rgba(45,212,191,.12), transparent 55%), linear-gradient(90deg, #070b16 36%, rgba(7,11,22,.45) 66%, transparent 100%)" }} />
      </div>
      <div className={`${WRAP} relative z-[1] flex flex-wrap items-end justify-between gap-6 pt-[62px] pb-[70px]`}>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">Port Risk Intelligence</span>
          <h1 className="mt-3.5 text-[clamp(34px,4.6vw,52px)] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#e9eef7]">포트 <span className="text-[#2dd4bf]">리스크</span></h1>
          <p className="mt-4 max-w-[560px] text-[15.5px] leading-[1.6] text-[#93a1b7]">항만 혼잡·해상 병목·주요 해협·호르무즈 동향을 한 화면에서 모니터링합니다.</p>
        </div>
        <button type="button" onClick={onToggleImpact} className="whitespace-nowrap rounded-[9px] border border-[#78a0cd33] bg-white/5 px-5 py-3 text-[14px] font-semibold text-[#e9eef7] transition-transform hover:-translate-y-px hover:border-[#2dd4bf73] hover:bg-white/10">
          {impactOpen ? "분석 닫기" : "내 화물 영향 분석 →"}
        </button>
      </div>
    </section>
  );
}

/* ============================ LIGHT BODY ============================ */
function Sect({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="pt-[30px]">
      <h2 className="mb-1 text-[18px] font-bold tracking-[-0.02em] text-[#1a2433]">{title}</h2>
      {desc && <p className="mb-4 text-[12.5px] text-[#828d9d]">{desc}</p>}
      {children}
    </section>
  );
}

function Pill({ c, children }: { c: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#d8dfe9] bg-[#f4f7fb] px-[14px] py-2 text-[12.5px] text-[#54606f]">
      <span className={`h-[7px] w-[7px] flex-none rounded-full ${c}`} />{children}
    </span>
  );
}

function Stat({ label, v, tone }: { label: string; v: string; tone?: "up" | "down" }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.05em] text-[#828d9d]">{label}</div>
      <div className={`mt-[3px] lsg-mono text-[13px] font-semibold ${tone === "up" ? "text-[#16a34a]" : tone === "down" ? "text-[#dc2626]" : "text-[#1a2433]"}`}>{v}</div>
    </div>
  );
}

function Bar({ label, v, pct }: { label: string; v: string; pct: number }) {
  return (
    <div className="my-[7px]">
      <div className="mb-1 flex justify-between text-[11px] text-[#54606f]"><span>{label}</span><span className="lsg-mono">{v} TEU</span></div>
      <div className="h-[6px] overflow-hidden rounded-[4px] bg-[#dde4ee]"><div className="h-full rounded-[4px]" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#0d9488,#2dd4bf)" }} /></div>
    </div>
  );
}

function DelayChip({ p }: { p: number | null }) {
  if (p == null || !Number.isFinite(p)) return <span className="lsg-mono text-[11.5px] text-[#828d9d]">—</span>;
  const c = p >= 75 ? "text-[#b42318] bg-[#fef0ef] border-[#fdd3cf]" : p >= 60 ? "text-[#b54708] bg-[#fff7ed] border-[#fed7aa]" : "text-[#067647] bg-[#ecfdf3] border-[#c7ead6]";
  return <span className={`inline-block rounded-[6px] border px-[9px] py-[3px] lsg-mono text-[11.5px] font-semibold ${c}`}>{(p > 0 ? "+" : "") + p.toFixed(1) + "%"}</span>;
}

export function LogisightPort() {
  const { data: risk } = useSuspenseQuery(riskSnapshotQueryOptions());
  const { data: policies } = useSuspenseQuery(policiesQueryOptions());
  const [impactOpen, setImpactOpen] = useState(false);

  const topPort = highestPortDelay(risk.ports);
  const topChoke = strongestChokepointMove(risk.chokepoints);
  const hormuz = risk.hormuz;
  const delayedPorts = risk.ports.filter((p) => (p.delayPercent ?? 0) >= 70).length;
  const upcoming30 = policies.filter((p) => {
    if (!p.effective_date) return false;
    const d = Math.round((new Date(p.effective_date).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 30;
  }).length;

  return (
    <div className="lsgp-root min-h-screen bg-[#070b16] text-[#1a2433]">
      <style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />
      <Hero onToggleImpact={() => setImpactOpen((v) => !v)} impactOpen={impactOpen} />

      <div className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1] pb-2" style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}>
        <div className={WRAP}>
          <div className="pt-[26px] lsg-mono text-[12.5px] text-[#828d9d]">
            홈 <b className="font-medium text-[#54606f]">›</b> 인사이트 <b className="font-medium text-[#54606f]">›</b> 포트
          </div>

          {/* pills */}
          <div className="mb-1.5 mt-4 flex flex-wrap gap-2.5">
            <Pill c="bg-[#ef4444]">항만 지연 70%+ <b className="lsg-mono font-semibold text-[#dc2626]">{delayedPorts === 0 ? "없음" : `${delayedPorts}곳`}</b></Pill>
            <Pill c="bg-[#ef4444]">주요 해협 변동 <b className="lsg-mono font-semibold text-[#dc2626]">{topChoke ? `${topChoke.name} ${fmtPct(topChoke.wowPct)}` : NA}</b></Pill>
            <Pill c="bg-[#16a34a]">호르무즈 통항 <b className="lsg-mono font-semibold text-[#1a2433]">{hormuz.crossingCount}척</b></Pill>
            <Pill c="bg-[#16a34a]">DB 이벤트 <b className="lsg-mono font-semibold text-[#1a2433]">{policies.length}건 · 예정 {upcoming30}건</b></Pill>
          </div>

          {impactOpen && <CargoImpactPanel />}

          {/* KPIs */}
          <Sect title="실시간 리스크 개요" desc="직접 수집한 항만 혼잡·주요 해협 TEU·호르무즈 통항 매크로 지표를 한 화면에 표시합니다.">
            <div className="grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-4">
              <KpiCard
                lab="최고 항만 지연율"
                val={topPort ? fmtPct(topPort.delayPercent) : NA}
                tone="red"
                sub={topPort ? `${topPort.name} · 혼잡도 ${fmtNum(topPort.congestion, 1)} · dwell ${fmtDwell(topPort.importDwell)}` : NA}
              />
              <KpiCard
                lab="주요 해협 최대 변동"
                val={topChoke ? fmtPct(topChoke.wowPct) : NA}
                tone="red"
                sub={topChoke ? `${topChoke.name} · ${fmtTeu(topChoke.latestTotalTeu)} TEU · 기준 ${topChoke.asOf ?? "—"}` : NA}
                spark={topChoke?.spark}
                sparkColor="#dc2626"
              />
              <KpiCard
                lab="Persian Gulf 선박"
                val={fmtNum(hormuz.gulfShipCount)}
                tone="teal"
                sub={`${hormuz.asOf ?? "—"} · 7일 변화 ${fmtPct(hormuz.gulfShipWowPct)}`}
                spark={hormuz.gulfShipSpark}
                sparkColor="#0d9488"
              />
              <KpiCard
                lab="호르무즈 일별 통항"
                val={`${hormuz.crossingCount}척`}
                sub={`${hormuz.crossingDate} · 유조선 ${hormuz.tankerCount} · 벌크 ${hormuz.bulkCount}`}
              />
            </div>
          </Sect>

          {/* Chokepoints */}
          <Sect title="주요 해협 TEU 흐름" desc="Suez · Panama · Cape · Malacca · Hormuz의 방향별 통과 TEU와 최근 통항 추이.">
            {risk.chokepoints.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm text-[#828d9d] ${CARD}`}>{NA}</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3 min-[1080px]:grid-cols-5">
                {risk.chokepoints.map((k) => {
                  const sum = Math.max(1, k.directions.reduce((s, d) => s + (d.value ?? 0), 0));
                  const up = (k.wowPct ?? 0) > 0;
                  return (
                    <article key={k.name} className={`p-4 ${CARD} ${CARD_H}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div><div className="text-[15px] font-bold text-[#1a2433]">{k.name}</div><div className="mt-0.5 lsg-mono text-[10.5px] text-[#828d9d]">기준 {k.asOf ?? "—"}</div></div>
                        <Spark vals={k.spark} color={up ? "#16a34a" : "#dc2626"} className="h-7 w-20" />
                      </div>
                      <div className="my-3.5 flex justify-between gap-2">
                        <Stat label="최신" v={`${fmtTeu(k.latestTotalTeu)}`} />
                        <Stat label="WoW" v={fmtPct(k.wowPct)} tone={up ? "up" : "down"} />
                        <Stat label="8주 평균" v={`${fmtTeu(k.avg8w)}`} />
                      </div>
                      {k.directions.map((d) => (
                        <Bar key={d.code} label={`${d.name} (${d.code})`} v={fmtTeu(d.value)} pct={Math.round(((d.value ?? 0) / sum) * 100)} />
                      ))}
                      <div className="mt-3 border-t border-[#d8dfe9] pt-[10px] text-[11px] leading-[1.4] text-[#828d9d]">
                        최신 선박 {k.latestCrossings}척{k.topCrossingName ? ` · 최대 ${k.topCrossingName} ${fmtTeu(k.topCrossingTeu)} TEU` : ""}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Sect>

          {/* Hormuz row */}
          <section className="pt-[30px]">
            <div className="grid grid-cols-1 items-start gap-[18px] min-[1080px]:grid-cols-2">
              <div className={`p-[22px] ${CARD}`}>
                <div><div className="text-[16px] font-bold text-[#1a2433]">호르무즈 상황판</div><div className="mt-[3px] text-[12px] text-[#828d9d]">Persian Gulf 선박 수와 Strait of Hormuz 일별 통항 상세</div></div>
                <div className="my-[18px] grid grid-cols-1 gap-x-[18px] gap-y-3.5 min-[640px]:grid-cols-2">
                  <div><div className="text-[11px] text-[#828d9d]">Gulf 선박 수</div><div className="mt-[3px] lsg-mono text-[19px] font-bold text-[#0d9488]">{fmtNum(hormuz.gulfShipCount)}</div><div className="mt-0.5 lsg-mono text-[11px] text-[#828d9d]">7일 변화 {fmtPct(hormuz.gulfShipWowPct)}</div></div>
                  <div><div className="text-[11px] text-[#828d9d]">통항 기준일</div><div className="mt-[3px] lsg-mono text-[19px] font-bold text-[#1a2433]">{hormuz.crossingDate}</div><div className="mt-0.5 lsg-mono text-[11px] text-[#828d9d]">{hormuz.crossingCount}척 · DWT {fmtNum(hormuz.totalDwt)}</div></div>
                  <div><div className="text-[11px] text-[#828d9d]">방향 (in / out)</div><div className="mt-[3px] lsg-mono text-[19px] font-bold text-[#1a2433]">{hormuz.eastbound} / {hormuz.westbound}척</div></div>
                  <div><div className="text-[11px] text-[#828d9d]">유조선 / 벌크</div><div className="mt-[3px] lsg-mono text-[19px] font-bold text-[#1a2433]">{hormuz.tankerCount} / {hormuz.bulkCount}척</div></div>
                </div>
                {hormuz.macro.length > 0 && (
                  <div className="grid grid-cols-1 gap-2.5 min-[640px]:grid-cols-2">
                    {hormuz.macro.map((m) => {
                      const neg = m.change?.startsWith("-") ?? false;
                      return (
                        <div key={m.label} className="relative overflow-hidden rounded-[10px] border border-[#d8dfe9] bg-white p-3">
                          <Spark vals={m.spark} color={neg ? "#dc2626" : "#16a34a"} className="absolute right-2 top-2.5 h-6 w-14 opacity-85" />
                          <div className="text-[11px] font-bold text-[#54606f]">{m.label}</div>
                          <div className="mt-1 lsg-mono text-[16px] font-bold text-[#1a2433]">{fmtNum(m.value, 2)}</div>
                          {m.change && <div className={`mt-0.5 lsg-mono text-[11px] ${neg ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{m.change}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={`p-[22px] ${CARD}`}>
                <div className="mb-1.5 text-[16px] font-bold text-[#1a2433]">호르무즈 최근 뉴스</div>
                {hormuz.news.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-[#828d9d]">{NA}</p>
                ) : (
                  hormuz.news.slice(0, 3).map((n, i) => (
                    <a key={`${n.url}-${i}`} href={n.url ?? "#"} target={n.url ? "_blank" : undefined} rel="noopener noreferrer" className={`group block py-3.5 ${i === 0 ? "pt-1" : "border-t border-[#d8dfe9]"}`}>
                      <h4 className="text-[14.5px] font-semibold leading-[1.4] text-[#1a2433] transition-colors group-hover:text-[#0d9488]">{n.title}</h4>
                      {n.summary && <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[#54606f]">{n.summary}</p>}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[#828d9d]">
                        {n.source && <span className="rounded-[5px] border border-[#ccfbf1] bg-[#e9f8f4] px-[7px] py-0.5 text-[10px] font-bold tracking-[0.04em] text-[#0d9488]">원문 {n.source}</span>}
                        {n.publishedAt && <span className="lsg-mono">{n.publishedAt}</span>}
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Port table */}
          <Sect title="전세계 항만 Top 20" desc="지연율 75% 이상은 alert, 60% 이상은 caution으로 표시. dwell time과 TEU MoM을 같은 항만에서 비교합니다.">
            {risk.ports.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm text-[#828d9d] ${CARD}`}>{NA}</div>
            ) : (
              <div className={`overflow-x-auto ${CARD}`}>
                <table className="w-full min-w-[840px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#eaeef4]">
                      {["Rank", "항만", "지연율"].map((h) => (<th key={h} className="border-b border-[#d8dfe9] px-3.5 py-[13px] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#828d9d]">{h}</th>))}
                      {["혼잡도", "Import dwell", "Export dwell", "TS dwell", "선석 선박", "TEU MoM"].map((h) => (<th key={h} className="border-b border-[#d8dfe9] px-3.5 py-[13px] text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#828d9d]">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {risk.ports.map((p, i) => (
                      <tr key={`${p.rank}-${p.name}-${i}`} className="border-b border-[#e3e9f1] transition-colors last:border-b-0 hover:bg-[#eef2f7]">
                        <td className="px-3.5 py-[11px] lsg-mono text-[#828d9d]">{p.rank ?? "—"}</td>
                        <td className="px-3.5 py-[11px]"><div className="font-semibold text-[#1a2433]">{p.name}</div><div className="lsg-mono text-[10.5px] text-[#828d9d]">{[p.country, p.locode].filter(Boolean).join(" · ") || "—"}</div></td>
                        <td className="px-3.5 py-[11px]"><DelayChip p={p.delayPercent} /></td>
                        <td className="px-3.5 py-[11px] text-right lsg-mono text-[#1a2433]">{fmtNum(p.congestion, 1)}</td>
                        <td className="px-3.5 py-[11px] text-right lsg-mono text-[#1a2433]">{fmtDwell(p.importDwell)}</td>
                        <td className="px-3.5 py-[11px] text-right lsg-mono text-[#1a2433]">{fmtDwell(p.exportDwell)}</td>
                        <td className="px-3.5 py-[11px] text-right lsg-mono text-[#1a2433]">{fmtDwell(p.transshipDwell)}</td>
                        <td className="px-3.5 py-[11px] text-right lsg-mono text-[#1a2433]">{fmtNum(p.vesselsBerthed)}</td>
                        <td className="px-3.5 py-[11px] text-right lsg-mono text-[11.5px] text-[#828d9d]">수입 <span className={(p.importTeuMom ?? 0) < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}>{fmtPct(p.importTeuMom)}</span> · 수출 <span className={(p.exportTeuMom ?? 0) < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}>{fmtPct(p.exportTeuMom)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Sect>

          {/* Macros */}
          <Sect title="글로벌 TEU·운임 매크로" desc="Global exports, Shanghai freight index, Global TEU liftings를 최신 기준일과 변화율로 표시합니다.">
            {risk.macroTrends.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm text-[#828d9d] ${CARD}`}>{NA}</div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-3">
                {risk.macroTrends.map((m) => {
                  const up = (m.changePct ?? 0) >= 0;
                  return (
                    <div key={m.label} className={`relative overflow-hidden p-5 ${CARD} ${CARD_H}`}>
                      <Spark vals={m.spark} color={up ? "#16a34a" : "#dc2626"} className="absolute right-[18px] top-[46px] h-[34px] w-[96px] opacity-80" />
                      <div className="flex items-start justify-between">
                        <div><div className="text-[14px] font-bold text-[#1a2433]">{m.label}</div><div className="mt-0.5 text-[11px] text-[#828d9d]">{m.source}</div></div>
                        <div className={`lsg-mono text-[13px] font-semibold ${up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(m.changePct)}</div>
                      </div>
                      <div className="mb-1.5 mt-3.5 lsg-mono text-[24px] font-bold text-[#1a2433]">{fmtNum(m.latest, 1)}</div>
                      <div className="lsg-mono text-[11px] text-[#828d9d]">기준 {m.asOf ?? "—"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Sect>
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}

function KpiCard({ lab, val, sub, tone, spark, sparkColor }: {
  lab: string; val: string; sub: string; tone?: "red" | "teal"; spark?: (number | null)[]; sparkColor?: string;
}) {
  return (
    <div className={`relative overflow-hidden p-[18px] ${CARD} ${CARD_H}`}>
      {spark && spark.length > 0 && <Spark vals={spark} color={sparkColor ?? "#0d9488"} className="absolute right-3.5 top-4 h-[30px] w-[84px] opacity-90" />}
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#828d9d]">{lab}</div>
      <div className={`mt-[9px] lsg-mono text-[27px] font-bold leading-[1.1] ${tone === "red" ? "text-[#dc2626]" : tone === "teal" ? "text-[#0d9488]" : "text-[#1a2433]"}`}>{val}</div>
      <div className="mt-2 text-[12px] text-[#828d9d]">{sub}</div>
    </div>
  );
}
