// LogisightReports.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 마켓 리포트 랜딩 — 드롭인 컴포넌트 (무역/산업/뉴스와 동일 패턴)
// · reports 테이블 shape 그대로 prop으로 받음
// · web_url 이 null/빈값이면 "웹으로 보기" 버튼 자동 숨김 (PDF만 노출)
// · period_label(ISO "25주차 · 06.15–06.21" / "2026년 5월호")을 그대로 표시
// · cover_url 있으면 표지 이미지, 없으면 타입색 표지 렌더
// · 자체 포함 스타일(.lsgrp-root). 공통 헤더/푸터는 HomeNav·HomeFooter 를 내부에서 렌더.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";

export type Report = {
  id: string;
  type: "weekly" | "monthly";
  period_start: string;        // 'YYYY-MM-DD'
  period_end: string;          // 'YYYY-MM-DD'
  period_label: string;        // ISO: '25주차 · 06.15–06.21' | '2026년 5월호'  (그대로 표시)
  title: string;
  summary?: string | null;
  pdf_url: string;
  web_url?: string | null;     // null이면 "웹으로 보기" 숨김
  cover_url?: string | null;
  published_at?: string | null;
};

type Seg = "전체" | "주간" | "월간";
type Props = {
  latestWeekly?: Report | null;
  latestMonthly?: Report | null;
  archive?: Report[];
  loading?: boolean;
  segment?: Seg;
  onSegmentChange?: (s: Seg) => void;
};

const SEGS: Seg[] = ["전체", "주간", "월간"];

// ── 폴백(샘플; web_url=null → 버튼 숨김) ─────────────────────────────────────
const FB_WEEKLY: Report = {
  id: "weekly-2026-06-15", type: "weekly", period_start: "2026-06-15", period_end: "2026-06-21",
  period_label: "25주차 · 06.15–06.21", title: "컨운임 18개월 최고·호르무즈 변수…노선별 엇갈림",
  summary: "SCFI·WCI·FBX 강세, 호르무즈 통항 차질, BTK 철도 재개 등 이번 주 해상·항공·철도 핵심을 한 편에.",
  pdf_url: "#", web_url: null, published_at: "2026-06-23",
};
const FB_MONTHLY: Report = {
  id: "monthly-2026-05-01", type: "monthly", period_start: "2026-05-01", period_end: "2026-05-31",
  period_label: "2026년 5월호", title: "5월 운임 반등과 교역 구조 — 현상·원인·배경·전망",
  summary: "관세청 확정 기준 5월 교역·운임 흐름을 4단계(현상→원인→배경→전망) 구조로 심층 분석한 월간 종합본.",
  pdf_url: "#", web_url: null, published_at: "2026-06-05",
};
const FB_ARCHIVE: Report[] = [
  FB_WEEKLY,
  { id: "weekly-2026-06-08", type: "weekly", period_start: "2026-06-08", period_end: "2026-06-14", period_label: "24주차 · 06.08–06.14", title: "홍해 통항 재개·미주 운임 상방", pdf_url: "#", web_url: null, published_at: "2026-06-16" },
  FB_MONTHLY,
  { id: "weekly-2026-06-01", type: "weekly", period_start: "2026-06-01", period_end: "2026-06-07", period_label: "23주차 · 06.01–06.07", title: "파나마 통항 정상화·벌크 강세", pdf_url: "#", web_url: null, published_at: "2026-06-09" },
  { id: "weekly-2026-05-25", type: "weekly", period_start: "2026-05-25", period_end: "2026-05-31", period_label: "22주차 · 05.25–05.31", title: "유라시아 코리도어 물동량 증가", pdf_url: "#", web_url: null, published_at: "2026-06-02" },
  { id: "monthly-2026-04-01", type: "monthly", period_start: "2026-04-01", period_end: "2026-04-30", period_label: "2026년 4월호", title: "4월 교역 회복과 항공 성수기 진입", pdf_url: "#", web_url: null, published_at: "2026-05-07" },
];

const STYLE = `
.lsgrp-root{--bg:#070b16;--bg3:#0e1626;--lineD:#78a0cd1c;--dmut:#93a1b7;--dfaint:#5d6b80;
  --paper:#e6eaf1;--card:#f4f7fb;--line:#d8dfe9;--line2:#e6ebf2;--ink:#1a2433;--body:#54606f;--mute:#828d9d;
  --teal:#2dd4bf;--teal2:#0d9488;--teal3:#14b8a6;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsgrp-root *{box-sizing:border-box;margin:0;padding:0}
.lsgrp-root .mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsgrp-root .wrap{max-width:1180px;margin:0 auto;padding:0 26px}
.lsgrp-root a{color:inherit;text-decoration:none}
.lsgrp-root button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}
/* 공유 Wordmark(HomeNav·HomeFooter)의 's'는 전역 규칙이 필요하다. */
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}

.lsgrp-root .hero{position:relative;overflow:hidden;background:var(--bg)}
.lsgrp-root .hero .glow{position:absolute;left:50%;top:-120px;width:900px;height:460px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)}
.lsgrp-root .hero svg.motif{position:absolute;right:0;top:0;height:100%;width:520px;opacity:.5}
.lsgrp-root .hero .in{position:relative;z-index:1;padding:46px 0 70px}
.lsgrp-root .hero .eyebrow{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--teal)}
.lsgrp-root .hero h1{margin-top:12px;font-size:clamp(30px,4vw,44px);font-weight:800;line-height:1.06;letter-spacing:-.035em;color:#e9eef7}
.lsgrp-root .hero p{margin-top:13px;max-width:600px;font-size:15px;line-height:1.6;color:var(--dmut)}
.lsgrp-root .hpills{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
.lsgrp-root .hpills .p{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--lineD);background:var(--bg3);border-radius:999px;padding:7px 13px;font-size:12.5px;color:var(--dmut)}
.lsgrp-root .hpills .p b{color:#e9eef7}.lsgrp-root .hpills .dot{width:7px;height:7px;border-radius:50%}

.lsgrp-root .sheet{position:relative;z-index:2;margin-top:-28px;background:var(--paper);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -34px rgba(0,0,0,.7);padding-bottom:10px}
.lsgrp-root .sect-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:26px 0 14px;padding-top:8px}
.lsgrp-root .sect-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsgrp-root .chip{border:1px solid var(--line);background:#eef1f6;border-radius:999px;padding:3px 9px;font-size:11px;color:var(--mute)}

.lsgrp-root .cover{position:relative;overflow:hidden;color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:13px 13px 12px}
.lsgrp-root .cover.week{background:linear-gradient(157deg,#0e827b,#0a5a60 72%)}
.lsgrp-root .cover.month{background:linear-gradient(157deg,#0a66b4,#0a4685 72%)}
.lsgrp-root .cover .cmotif{position:absolute;right:-10px;bottom:-10px;width:130px;opacity:.22}
.lsgrp-root .cover .top{display:flex;justify-content:space-between;align-items:center;font-size:9px;font-weight:700;letter-spacing:.1em;opacity:.9}
.lsgrp-root .cover .mid{position:relative;z-index:1}
.lsgrp-root .cover .mid .t{font-size:15px;font-weight:800;line-height:1.25}
.lsgrp-root .cover .mid .p{font-size:10.5px;opacity:.88;margin-top:4px}
.lsgrp-root .cover .bot{font-size:9px;opacity:.8;letter-spacing:.04em}
.lsgrp-root .cv-img{width:100%;height:100%;object-fit:cover;display:block}

.lsgrp-root .feats{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:860px){.lsgrp-root .feats{grid-template-columns:1fr}}
.lsgrp-root .feat{display:grid;grid-template-columns:148px 1fr;border:1px solid var(--line);background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.lsgrp-root .feat .cover,.lsgrp-root .feat .cvbox{aspect-ratio:3/4}
.lsgrp-root .feat .bd{padding:16px 18px;display:flex;flex-direction:column;justify-content:center}
.lsgrp-root .badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;border-radius:6px;padding:3px 9px;width:fit-content}
.lsgrp-root .badge.week{color:#0a6f6a;background:#e3f5f2;border:1px solid #c2eae5}
.lsgrp-root .badge.month{color:#0a5da8;background:#e6f0fb;border:1px solid #cde0f6}
.lsgrp-root .feat .ti{margin-top:10px;font-size:17px;font-weight:800;line-height:1.3;letter-spacing:-.02em;color:var(--ink)}
.lsgrp-root .feat .pr{margin-top:5px;font-size:12px;color:var(--mute)}
.lsgrp-root .feat .su{margin-top:10px;font-size:12.5px;line-height:1.5;color:var(--body)}
.lsgrp-root .feat .act{margin-top:14px;display:flex;gap:8px}
.lsgrp-root .btn{font-size:12.5px;font-weight:700;border-radius:8px;padding:7px 13px;cursor:pointer}
.lsgrp-root .btn.pri{background:#0f1b33;color:#fff}
.lsgrp-root .btn.sec{background:#fff;color:var(--body);border:1px solid var(--line)}

.lsgrp-root .seg{display:flex;gap:2px;background:#eef1f6;border:1px solid var(--line);border-radius:9px;padding:3px}
.lsgrp-root .seg button{font-size:12.5px;font-weight:600;color:var(--body);padding:5px 12px;border-radius:7px}
.lsgrp-root .seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(16,24,40,.07)}
.lsgrp-root .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:900px){.lsgrp-root .grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.lsgrp-root .grid{grid-template-columns:1fr}}
.lsgrp-root .ac{border:1px solid var(--line);background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.lsgrp-root .ac .cover,.lsgrp-root .ac .cvbox{aspect-ratio:16/8}
.lsgrp-root .ac .bd{padding:12px 14px}
.lsgrp-root .ac .ti{margin-top:2px;font-size:14px;font-weight:700;color:var(--ink);line-height:1.35}
.lsgrp-root .ac .meta{margin-top:7px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.lsgrp-root .ac .dt{font-size:11px;color:var(--mute)}
.lsgrp-root .ac .lk{display:flex;gap:10px;font-size:12px;font-weight:600}
.lsgrp-root .ac .lk a{color:var(--teal2)}.lsgrp-root .ac .lk a.pdf{color:#0a5da8}
.lsgrp-root .more{display:block;text-align:center;margin:16px 0 4px;padding:10px;border:1px dashed var(--line);border-radius:10px;font-size:12.5px;font-weight:600;color:var(--teal2)}
.lsgrp-root .empty{padding:26px;text-align:center;color:var(--mute);font-size:13px;border:1px dashed var(--line);border-radius:12px;background:var(--card)}

.lsgrp-root .sk{background:linear-gradient(90deg,#e9edf3,#f3f6fa,#e9edf3);background-size:200% 100%;animation:lsgrpsh 1.2s infinite;border-radius:6px}
@keyframes lsgrpsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.lsgrp-root *{animation:none!important}}
`;

function CoverMotif({ week }: { week: boolean }) {
  return week
    ? <svg className="cmotif" viewBox="0 0 120 80" fill="none"><polyline points="6,60 28,48 50,54 72,30 94,40 114,18" stroke="#fff" strokeWidth="3" fill="none" /></svg>
    : <svg className="cmotif" viewBox="0 0 120 80" fill="none"><g fill="#fff"><rect x="14" y="40" width="12" height="30" rx="2" /><rect x="34" y="30" width="12" height="40" rx="2" /><rect x="54" y="34" width="12" height="36" rx="2" /><rect x="74" y="22" width="12" height="48" rx="2" /><rect x="94" y="28" width="12" height="42" rx="2" /></g></svg>;
}
function seriesName(r: Report) { return r.type === "weekly" ? "주간 물류 동향" : "월간 물류 시장 리포트"; }
function shortPeriod(r: Report) {
  const [y, m, d] = r.period_start.split("-");
  if (r.type === "monthly") return `${y}.${m}`;
  const pe = r.period_end.split("-");
  return `${m}.${d}–${pe[1]}.${pe[2]}`;
}

function Cover({ r, variant }: { r: Report; variant: "feat" | "archive" }) {
  if (r.cover_url) return <div className="cvbox"><img className="cv-img" src={r.cover_url} alt="" /></div>;
  const week = r.type === "weekly";
  if (variant === "feat") {
    return (
      <div className={`cover ${week ? "week" : "month"}`}>
        <div className="top"><span>{week ? "WEEKLY" : "MONTHLY"}</span><span>LOGISIGHT</span></div>
        <div className="mid"><div className="t">{seriesName(r)}</div><div className="p mono">{r.period_label}</div></div>
        <div className="bot">MTL Shipping Agency</div>
        <CoverMotif week={week} />
      </div>
    );
  }
  return (
    <div className={`cover ${week ? "week" : "month"}`}>
      <div className="top"><span>{week ? "WEEKLY" : "MONTHLY"}</span><span>{shortPeriod(r)}</span></div>
      <div className="mid"><div className="t" style={{ fontSize: 13 }}>{seriesName(r)}</div></div>
      <div className="bot">MTL · Logisight</div>
    </div>
  );
}

function FeaturedCard({ r, loading }: { r: Report | null; loading: boolean }) {
  if (loading) return (
    <div className="feat">
      <div className="sk" style={{ aspectRatio: "3/4", borderRadius: 0 }} />
      <div className="bd"><div className="sk" style={{ width: 60, height: 18 }} /><div className="sk" style={{ width: "90%", height: 18, marginTop: 10 }} /><div className="sk" style={{ width: "70%", height: 12, marginTop: 10 }} /></div>
    </div>
  );
  if (!r) return <div className="empty">아직 발행된 리포트가 없습니다.</div>;
  const week = r.type === "weekly";
  return (
    <article className="feat">
      <Cover r={r} variant="feat" />
      <div className="bd">
        <span className={`badge ${week ? "week" : "month"}`}>● {week ? "주간" : "월간"}</span>
        <div className="ti">{r.title}</div>
        {r.published_at ? <div className="pr mono">발행 {r.published_at}</div> : null}
        {r.summary ? <div className="su">{r.summary}</div> : null}
        <div className="act">
          {r.web_url
            ? (<><a className="btn pri" href={r.web_url}>웹으로 보기</a><a className="btn sec" href={r.pdf_url} target="_blank" rel="noopener noreferrer">PDF 다운로드</a></>)
            : (<a className="btn pri" href={r.pdf_url} target="_blank" rel="noopener noreferrer">PDF 다운로드</a>)}
        </div>
      </div>
    </article>
  );
}

function ArchiveCard({ r }: { r: Report }) {
  return (
    <article className="ac">
      <Cover r={r} variant="archive" />
      <div className="bd">
        <div className="ti">{r.title}</div>
        <div className="meta">
          <span className="dt mono">{r.period_label}</span>
          <span className="lk">
            {r.web_url ? <a href={r.web_url}>웹</a> : null}
            <a className="pdf" href={r.pdf_url} target="_blank" rel="noopener noreferrer">PDF</a>
          </span>
        </div>
      </div>
    </article>
  );
}

export default function LogisightReports({
  latestWeekly = FB_WEEKLY,
  latestMonthly = FB_MONTHLY,
  archive = FB_ARCHIVE,
  loading = false,
  segment,
  onSegmentChange,
}: Props) {
  const [segState, setSegState] = useState<Seg>("전체");
  const seg = segment ?? segState;
  const setSeg = (s: Seg) => (onSegmentChange ? onSegmentChange(s) : setSegState(s));
  const filtered = archive.filter((r) => seg === "전체" ? true : seg === "주간" ? r.type === "weekly" : r.type === "monthly");

  return (
    <div className="lsgrp-root min-h-screen">
      <style>{STYLE}</style>

      <HomeNav active="reports" />

      <section className="hero">
        <div className="glow" />
        <svg className="motif" viewBox="0 0 520 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="#2dd4bf" opacity="0.5">
            <rect x="250" y="70" width="150" height="200" rx="10" opacity="0.16" />
            <rect x="280" y="50" width="150" height="200" rx="10" opacity="0.22" />
            <rect x="310" y="30" width="150" height="200" rx="10" opacity="0.14" />
          </g>
          <g stroke="#5eead4" strokeWidth="1.4" opacity="0.5" fill="none"><polyline points="330,150 360,130 390,140 420,105 450,118" /></g>
          <g fill="#5eead4"><circle cx="420" cy="105" r="3.5" /></g>
        </svg>
        <div className="wrap in">
          <span className="eyebrow">Market Reports</span>
          <h1>마켓 리포트</h1>
          <p>MTL이 매주·매월 발행하는 물류 시장 인텔리전스 리포트 — 운임·해상·항공·철도·무역을 한 편에 정리합니다.</p>
          <div className="hpills">
            <span className="p"><span className="dot" style={{ background: "#2dd4bf" }} />최신 주간 <b className="mono">{latestWeekly?.period_label ?? "—"}</b></span>
            <span className="p"><span className="dot" style={{ background: "#3b82f6" }} />최신 월간 <b className="mono">{latestMonthly?.period_label ?? "—"}</b></span>
            <span className="p"><span className="dot" style={{ background: "#14b8a6" }} />무료 구독</span>
          </div>
        </div>
      </section>

      <div className="sheet"><div className="wrap">
        {/* 최신 리포트 */}
        <div className="sect-h"><h2>최신 리포트</h2><span className="chip">주간 · 월간</span></div>
        <div className="feats">
          <FeaturedCard r={latestWeekly} loading={loading} />
          <FeaturedCard r={latestMonthly} loading={loading} />
        </div>

        {/* 아카이브 */}
        <div className="sect-h"><h2>아카이브</h2>
          <span className="seg">{SEGS.map((s) => <button key={s} className={s === seg ? "on" : undefined} onClick={() => setSeg(s)}>{s}</button>)}</span>
        </div>
        {loading ? (
          <div className="grid">{[0, 1, 2].map((i) => (
            <div className="ac" key={i}><div className="sk" style={{ aspectRatio: "16/8", borderRadius: 0 }} /><div className="bd"><div className="sk" style={{ width: "80%", height: 14 }} /><div className="sk" style={{ width: "40%", height: 11, marginTop: 9 }} /></div></div>
          ))}</div>
        ) : filtered.length === 0 ? (
          <div className="empty">해당 조건의 리포트가 없습니다.</div>
        ) : (
          <div className="grid">{filtered.map((r) => <ArchiveCard key={r.id} r={r} />)}</div>
        )}
      </div></div>

      <HomeFooter />
    </div>
  );
}
