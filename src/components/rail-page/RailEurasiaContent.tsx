// 유라시아 ERAI 차트 포털 — 기존 LogisightEurasia 디자인(다크 히어로 + 라이트 sheet + judge/tiles)을 살리고
// TCR ETA(내부 자료)는 ERAI 공개 지수로 대체. 데이터: eurasia_charts(index1520 스냅샷) + maritime_news('철도').
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { eurasiaChartsQueryOptions } from "@/lib/api/eurasia-charts";
import type { ChartDataset } from "@/lib/api/eurasia-charts";
import { EurasiaStatisticsPanel } from "@/components/index1520/EurasiaStatisticsPanel";
import {
  EurasiaIndexChart,
  EurasiaTransitChart,
  EurasiaMarketMap,
  EurasiaGeoRanking,
} from "./EurasiaCharts";

const STYLE = `
.lsg-eu{--bg:#070b16;--bg3:#0e1626;--lineD:#78a0cd1c;--dmut:#93a1b7;--dfaint:#5d6b80;
  --paper:#e6eaf1;--card:#f4f7fb;--line:#d8dfe9;--line2:#e6ebf2;--ink:#1a2433;--body:#54606f;--mute:#828d9d;
  --teal:#2dd4bf;--up:#16a34a;--down:#dc2626;--warn:#d97706;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-eu *{box-sizing:border-box}
.lsg-eu .mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-eu .wrap{max-width:1200px;margin:0 auto;padding:0 44px}
@media(max-width:900px){.lsg-eu .wrap{padding:0 24px}}
@media(max-width:640px){.lsg-eu .wrap{padding:0 16px}}
.lsg-eu .hero{position:relative;overflow:hidden;background:var(--bg)}
.lsg-eu .hero .glow{position:absolute;left:50%;top:-120px;width:900px;height:460px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)}
.lsg-eu .hero svg.motif{position:absolute;right:-20px;top:0;height:100%;width:560px;opacity:.85;pointer-events:none}
@keyframes lsgEuTwk{0%,100%{opacity:.12}50%{opacity:.95}}
@keyframes lsgEuPul{0%,100%{opacity:.22}50%{opacity:.55}}
.lsg-eu .hero svg.motif .tw{animation:lsgEuTwk 2.6s ease-in-out infinite}
.lsg-eu .hero svg.motif .pul{animation:lsgEuPul 3.4s ease-in-out infinite}
.lsg-eu .hero .in{position:relative;z-index:1;padding-top:40px;padding-bottom:70px}
.lsg-eu .hero .eyebrow{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--teal)}
.lsg-eu .hero h1{margin-top:12px;font-size:clamp(30px,4vw,44px);font-weight:800;line-height:1.06;letter-spacing:-.035em;color:#e9eef7}
.lsg-eu .hero p{margin-top:13px;max-width:640px;font-size:15px;line-height:1.6;color:var(--dmut)}
.lsg-eu .hpills{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
.lsg-eu .hpills .p{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--lineD);background:var(--bg3);border-radius:999px;padding:7px 13px;font-size:12.5px;color:var(--dmut)}
.lsg-eu .hpills .p b{color:#e9eef7}.lsg-eu .hpills .dot{width:7px;height:7px;border-radius:50%}
.lsg-eu .sheet{position:relative;z-index:2;margin-top:-28px;background:var(--paper);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -34px rgba(0,0,0,.7);padding-bottom:30px}
.lsg-eu .bc{padding-top:26px;font-size:12.5px;color:var(--mute)}.lsg-eu .bc b{color:var(--body);font-weight:500}
.lsg-eu .judge{margin-top:14px;border:1px solid var(--line);background:linear-gradient(180deg,#fbfcfe,#f4f7fb);border-radius:16px;padding:18px 20px}
.lsg-eu .judge .verdict{font-size:15px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
.lsg-eu .judge .ai{margin-top:6px;font-size:12.5px;color:var(--body);max-width:820px;line-height:1.55}
.lsg-eu .tiles{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:880px){.lsg-eu .tiles{grid-template-columns:repeat(2,1fr)}}
.lsg-eu .tile{border:1px solid var(--line);background:#fff;border-radius:12px;padding:13px 14px}
.lsg-eu .tile .k{font-size:11.5px;color:var(--mute)}
.lsg-eu .tile .v{margin-top:6px;font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsg-eu .tile .v small{font-size:11px;font-weight:500;color:var(--mute)}
.lsg-eu .tile .d{margin-top:4px;font-size:11.5px}
.lsg-eu .news-card{margin-bottom:0;border:1px solid var(--line);background:#fff;border-radius:12px;overflow:hidden}
.lsg-eu .news-card li{list-style:none}
.lsg-eu .src{font-size:11px;color:var(--mute);margin-top:18px}
.lsg-eu .src a{color:var(--body);text-decoration:underline}
@media(prefers-reduced-motion:reduce){.lsg-eu *{animation:none!important}}
`;

const fmtVal = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString());
const fmtPct = (v: number | null) => (v == null || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
function pct(c: number | null | undefined, b: number | null | undefined) {
  return c == null || b == null || !b ? null : ((c - b) / b) * 100;
}

export function RailEurasiaContent() {
  const { data: charts } = useSuspenseQuery(eurasiaChartsQueryOptions());

  const sum = useMemo(() => {
    const idx = charts.indexQuotes?.indexes;
    const times = charts.indexQuotes?.times;
    const find = (arr: ChartDataset[] | undefined, label: string) => arr?.find((d) => d.label === label);
    const last = (d?: ChartDataset) => d?.data?.at(-1) ?? null;
    const mom = (d?: ChartDataset) => { const a = d?.data ?? []; return pct(a.at(-1), a.at(-2)); };
    const comp = find(idx?.datasets.month, "ERAI Composite");
    const east = find(idx?.datasets.month, "ERAI East");
    const west = find(idx?.datasets.month, "ERAI West");
    const transit = times?.datasets.month?.find((d) => /China-Europe-China/.test(d.label)) ?? times?.datasets.month?.[0];
    return {
      month: idx?.labelsInfo.month?.at(-1)?.full ?? null,
      comp: last(comp), compMom: mom(comp),
      east: last(east), eastMom: mom(east),
      west: last(west), westMom: mom(west),
      transit: last(transit),
    };
  }, [charts]);

  const dColor = (v: number | null) => (v == null ? "var(--mute)" : v >= 0 ? "var(--up)" : "var(--down)");
  const [tab, setTab] = useState<"index" | "statistics">("index");

  return (
    <div className="lsg-eu">
      <style>{STYLE}</style>

      <section className="hero">
        <div className="glow" />
        <svg className="motif" viewBox="0 0 560 320" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g className="pul" stroke="#2dd4bf" strokeWidth="1.4" fill="none">
            <path d="M40 220 C 160 170, 300 250, 420 150 S 540 90, 545 80" />
          </g>
          <g fill="#2dd4bf">
            <rect className="tw" style={{ animationDelay: "0s" }} x="120" y="195" width="13" height="13" rx="2" transform="rotate(45 126 201)" />
            <rect className="tw" style={{ animationDelay: ".9s" }} x="300" y="208" width="13" height="13" rx="2" transform="rotate(45 306 214)" />
            <rect className="tw" style={{ animationDelay: "1.7s" }} x="420" y="143" width="13" height="13" rx="2" transform="rotate(45 426 149)" />
          </g>
          <g fill="#5eead4">
            <circle className="tw" style={{ animationDelay: ".4s" }} cx="40" cy="220" r="4" />
            <circle className="tw" style={{ animationDelay: "1.3s" }} cx="545" cy="80" r="4" />
          </g>
        </svg>
        <div className="wrap in">
          <span className="eyebrow">Eurasia Rail Index</span>
          <h1>유라시아 코리도어</h1>
          <p>
            ERAI(Eurasian Rail Alliance Index) 기반 유라시아 철도 운임·운송기간·물동량 동향. 지수·마켓맵·지역
            물동량을 한눈에.
          </p>
          <div className="hpills">
            <span className="p"><span className="dot" style={{ background: "#2dd4bf" }} />ERAI 종합 <b className="mono">${fmtVal(sum.comp)}</b>/FEU</span>
            <span className="p"><span className="dot" style={{ background: "#16a34a" }} />운송기간 <b className="mono">{sum.transit != null ? `${sum.transit.toFixed(2)}일` : "—"}</b></span>
            <span className="p"><span className="dot" style={{ background: "#94a3b8" }} />기준 <b>{sum.month ?? "—"}</b></span>
          </div>
        </div>
      </section>

      <div className="sheet">
        <div className="wrap">
          <div className="bc">홈 <b>›</b> 인사이트 <b>›</b> 철도 <b>›</b> 유라시아</div>

          {/* Index | Statistics 탭 */}
          <div className="mt-3.5 inline-flex rounded-[10px] border border-[#d8dfe9] bg-[#eef1f6] p-1">
            {([["index", "Index"], ["statistics", "Statistics"]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-[7px] px-4 py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? "bg-white text-[#0d9488] shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-[#54606f]"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "statistics" ? (
            <EurasiaStatisticsPanel />
          ) : (
          <>
          {/* 종합 판단 */}
          <div className="judge">
            <div className="verdict">{charts.aiInsight?.headline ?? `ERAI 종합 $${fmtVal(sum.comp)}/FEU · MoM ${fmtPct(sum.compMom)}`}</div>
            <div className="ai">
              {charts.aiInsight?.analysis ??
                "유라시아 철도 운임 컴포지트(ERAI)와 동·서행 지수, 평균 운송기간을 ERAI 공개 데이터로 제공합니다. 값은 월별 스냅샷이며, 상세 추이는 아래 차트에서 확인하세요."}
            </div>
            {charts.aiInsight && (
              <div className="mt-1.5 text-[11px] text-[#828d9d]">
                AI 요약 · 격주 시장 리포트 기반{charts.aiInsight.generatedAt ? ` · ${charts.aiInsight.generatedAt.slice(0, 10)}` : ""}
              </div>
            )}
            <div className="tiles">
              {[
                { k: "ERAI 종합", v: sum.comp, m: sum.compMom },
                { k: "ERAI East", v: sum.east, m: sum.eastMom },
                { k: "ERAI West", v: sum.west, m: sum.westMom },
              ].map((t) => (
                <div className="tile" key={t.k}>
                  <div className="k">{t.k}</div>
                  <div className="v mono">${fmtVal(t.v)}<small> /FEU</small></div>
                  <div className="d" style={{ color: dColor(t.m) }}>MoM {fmtPct(t.m)}</div>
                </div>
              ))}
              <div className="tile">
                <div className="k">평균 운송기간</div>
                <div className="v mono" style={{ color: "var(--teal)" }}>{sum.transit != null ? sum.transit.toFixed(2) : "—"}<small> 일</small></div>
                <div className="d" style={{ color: "var(--mute)" }}>China-Europe-China</div>
              </div>
            </div>
          </div>

          {/* 차트 블록 */}
          <EurasiaIndexChart quotes={charts.indexQuotes} />
          <EurasiaTransitChart quotes={charts.indexQuotes} />
          <EurasiaMarketMap quotes={charts.indexQuotes} />
          <EurasiaGeoRanking geo={charts.geo} />

          <div className="src">데이터 출처: ERAI (Eurasian Rail Alliance Index) · 철도 뉴스는 <a href="/news?cat=철도">뉴스 › 철도</a></div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
