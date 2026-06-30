// LogisightReports.tsx  (v3 — 그래프 표지 + 아코디언 아카이브)
// ─────────────────────────────────────────────────────────────────────────────
// 마켓 리포트 랜딩 — 드롭인 컴포넌트
// · 최신: 그래프 배경 표지 카드(주간=영역 라인차트 / 월간=막대+추세) + 레이어드 배경
// · 아카이브: 접이식 아코디언 3개(월간 / 주간 종합 / 주간 권역)
//     - 헤더: 색 점 + 제목 + 개수 + 최신 미리보기 + ▼(열면 회전)
//     - 패널: 목록(또는 권역 매트릭스), 길어지면 패널 안에서만 스크롤(max 372px)
//     - <details> 네이티브 → 가볍고 접근성 OK
// · 분류: report_class('monthly'|'weekly'|'weekly_regional') + region + iso_week (없으면 type/region 추론)
// · web_url null/빈값 → "웹" 링크 자동 숨김(PDF만). period_label은 그대로 표시.
// · cover_url 있으면 표지 이미지 우선.
// · 자체 포함 스타일(.lsg-root). 공통 레이아웃 사용 시 showNav={false} + 푸터 중복 정리.
//
// 사용: <LogisightReports latestWeekly={w} latestMonthly={m} archive={all} loading={loading} />
// prop 없이도 동작(샘플 폴백; web_url=null).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { GeoArticleSchema } from "@/components/geo/GeoArticleSchema";

export type ReportClass = "monthly" | "weekly" | "weekly_regional";
export type Report = {
  id: string;
  report_class?: ReportClass | null;
  type?: "weekly" | "monthly" | null;
  region?: string | null;
  iso_week?: string | null;
  period_start: string;
  period_end: string;
  period_label: string;
  title: string;
  summary?: string | null;
  pdf_url: string;
  web_url?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
};

type Props = {
  showNav?: boolean;
  latestWeekly?: Report | null;
  latestMonthly?: Report | null;
  archive?: Report[];
  loading?: boolean;
  regionOrder?: string[];
};

const NAV = [{ l: "홈" }, { l: "뉴스" }, { l: "인사이트" }, { l: "리포트", on: true }];
const PREFERRED_REGIONS = [
  "미주",
  "유럽",
  "극동(러시아·CIS)",
  "극동",
  "중국",
  "일본",
  "동남아",
  "중동",
  "아프리카",
  "기타",
];

// ── 폴백(샘플; web_url=null) ─────────────────────────────────────────────────
const mk = (
  o: Partial<Report> &
    Pick<Report, "id" | "period_start" | "period_end" | "period_label" | "title">,
): Report => ({ pdf_url: "#", web_url: null, ...o }) as Report;
const FB_WEEKLY = mk({
  id: "w-25",
  report_class: "weekly",
  iso_week: "2026-W25",
  period_start: "2026-06-15",
  period_end: "2026-06-21",
  period_label: "25주차 · 06.15–06.21",
  title: "25주차 글로벌 물류 시황",
  summary: "SCFI·WCI·FBX 강세, 호르무즈 변수, BTK 철도 재개 등 이번 주 핵심.",
  published_at: "2026-06-24",
});
const FB_MONTHLY = mk({
  id: "m-2026-06",
  report_class: "monthly",
  period_start: "2026-06-01",
  period_end: "2026-06-30",
  period_label: "2026년 6월호",
  title: "월간 시장 인텔리전스 리포트 · 6월호",
  summary: "글로벌 해운·항공·철도 운임과 공급망·지정학 동향 종합 분석.",
  published_at: "2026-06-24",
});
const FB_ARCHIVE: Report[] = [
  FB_MONTHLY,
  mk({
    id: "m-2026-05",
    report_class: "monthly",
    period_start: "2026-05-01",
    period_end: "2026-05-31",
    period_label: "2026년 5월호",
    title: "월간 시장 인텔리전스 리포트 · 5월호",
    published_at: "2026-05-07",
  }),
  mk({
    id: "m-2026-04",
    report_class: "monthly",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    period_label: "2026년 4월호",
    title: "월간 시장 인텔리전스 리포트 · 4월호",
    published_at: "2026-04-06",
  }),
  FB_WEEKLY,
  mk({
    id: "w-24",
    report_class: "weekly",
    iso_week: "2026-W24",
    period_start: "2026-06-08",
    period_end: "2026-06-14",
    period_label: "24주차 · 06.08–06.14",
    title: "24주차 글로벌 물류 시황",
    published_at: "2026-06-16",
  }),
  mk({
    id: "w-23",
    report_class: "weekly",
    iso_week: "2026-W23",
    period_start: "2026-06-01",
    period_end: "2026-06-07",
    period_label: "23주차 · 06.01–06.07",
    title: "23주차 글로벌 물류 시황",
    published_at: "2026-06-09",
  }),
  mk({
    id: "r-26-am",
    report_class: "weekly_regional",
    region: "미주",
    iso_week: "2026-W26",
    period_start: "2026-06-22",
    period_end: "2026-06-28",
    period_label: "미주 · 06.22~06.28",
    title: "주간 권역 리포트 · 미주 (2026-W26)",
  }),
  mk({
    id: "r-26-eu",
    report_class: "weekly_regional",
    region: "유럽",
    iso_week: "2026-W26",
    period_start: "2026-06-22",
    period_end: "2026-06-28",
    period_label: "유럽 · 06.22~06.28",
    title: "주간 권역 리포트 · 유럽 (2026-W26)",
  }),
  mk({
    id: "r-26-fe",
    report_class: "weekly_regional",
    region: "극동(러시아·CIS)",
    iso_week: "2026-W26",
    period_start: "2026-06-22",
    period_end: "2026-06-28",
    period_label: "극동(러시아·CIS) · 06.22~06.28",
    title: "주간 권역 리포트 · 극동(러시아·CIS) (2026-W26)",
  }),
  mk({
    id: "r-25-am",
    report_class: "weekly_regional",
    region: "미주",
    iso_week: "2026-W25",
    period_start: "2026-06-15",
    period_end: "2026-06-21",
    period_label: "미주 · 06.15~06.21",
    title: "주간 권역 리포트 · 미주 (2026-W25)",
  }),
  mk({
    id: "r-25-eu",
    report_class: "weekly_regional",
    region: "유럽",
    iso_week: "2026-W25",
    period_start: "2026-06-15",
    period_end: "2026-06-21",
    period_label: "유럽 · 06.15~06.21",
    title: "주간 권역 리포트 · 유럽 (2026-W25)",
  }),
  mk({
    id: "r-24-am",
    report_class: "weekly_regional",
    region: "미주",
    iso_week: "2026-W24",
    period_start: "2026-06-08",
    period_end: "2026-06-14",
    period_label: "미주 · 06.08~06.14",
    title: "주간 권역 리포트 · 미주 (2026-W24)",
  }),
  mk({
    id: "r-24-eu",
    report_class: "weekly_regional",
    region: "유럽",
    iso_week: "2026-W24",
    period_start: "2026-06-08",
    period_end: "2026-06-14",
    period_label: "유럽 · 06.08~06.14",
    title: "주간 권역 리포트 · 유럽 (2026-W24)",
  }),
];

const STYLE = `
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
.lsg-root{--bg:#070b16;--bg3:#0e1626;--lineD:#78a0cd1c;--dmut:#93a1b7;--dfaint:#5d6b80;
  --paper:#e6eaf1;--card:#f4f7fb;--line:#d8dfe9;--line2:#e6ebf2;--ink:#1a2433;--body:#54606f;--mute:#828d9d;--teal:#2dd4bf;--teal2:#0d9488;--teal3:#14b8a6;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-root *{box-sizing:border-box;margin:0;padding:0}
.lsg-root .mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-root .wrap{max-width:1200px;margin:0 auto;padding:0 44px}
@media(max-width:900px){.lsg-root .wrap{padding:0 24px}}
@media(max-width:640px){.lsg-root .wrap{padding:0 16px}}
.lsg-root a{color:inherit;text-decoration:none}

.lsg-root .brand{display:inline-flex;align-items:center;gap:9px;font-size:18px;font-weight:800;letter-spacing:-.02em}
.lsg-root .brand .mk{width:9px;height:18px;border-radius:2px;transform:skewX(-12deg);background:linear-gradient(180deg,#2dd4bf,#0ea5a0)}
.lsg-root .brand .b1{color:#fff}.lsg-root .brand .b2{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}.lsg-root .brand .b3{color:#2dd4bf}

.lsg-root .nav{position:sticky;top:0;z-index:50;background:#070b16d1;backdrop-filter:blur(14px) saturate(1.5);border-bottom:1px solid var(--lineD)}
.lsg-root .nav .row{display:flex;align-items:center;gap:36px;height:60px}
.lsg-root .nav nav{display:flex;gap:24px;font-size:14px;font-weight:500;color:var(--dmut)}
.lsg-root .nav nav a{padding:4px 0;position:relative}.lsg-root .nav nav a:hover{color:#fff}.lsg-root .nav nav a.on{color:#fff}
.lsg-root .nav nav a.on::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;border-radius:2px;background:var(--teal)}

.lsg-root .hero{position:relative;overflow:hidden;background:var(--bg)}
.lsg-root .hero .glow{position:absolute;left:50%;top:-120px;width:900px;height:460px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)}
.lsg-root .hero svg.motif{position:absolute;right:0;top:0;height:100%;width:520px;opacity:.5}
.lsg-root .hero .in{position:relative;z-index:1;padding-top:46px;padding-bottom:70px}
.lsg-root .hero .eyebrow{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--teal)}
.lsg-root .hero h1{margin-top:12px;font-size:clamp(30px,4vw,44px);font-weight:800;line-height:1.06;letter-spacing:-.035em;color:#e9eef7}
.lsg-root .hero p{margin-top:13px;max-width:600px;font-size:15px;line-height:1.6;color:var(--dmut)}
.lsg-root .hpills{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
.lsg-root .hpills .p{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--lineD);background:var(--bg3);border-radius:999px;padding:7px 13px;font-size:12.5px;color:var(--dmut)}
.lsg-root .hpills .p b{color:#e9eef7}.lsg-root .hpills .dot{width:7px;height:7px;border-radius:50%}

.lsg-root .sheet{position:relative;z-index:2;margin-top:-28px;background:var(--paper);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -34px rgba(0,0,0,.7);padding-bottom:10px}
.lsg-root .sect-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:26px 0 14px;padding-top:8px}
.lsg-root .sect-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsg-root .chip{border:1px solid var(--line);background:#eef1f6;border-radius:999px;padding:3px 9px;font-size:11px;color:var(--mute)}

.lsg-root .cover{position:relative;overflow:hidden;color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:13px 14px 12px;isolation:isolate}
.lsg-root .cover.week{background:radial-gradient(115% 78% at 88% -8%,rgba(94,234,212,.30),transparent 56%),linear-gradient(155deg,#10897f 0%,#0a5f60 46%,#053f47 100%)}
.lsg-root .cover.month{background:radial-gradient(115% 78% at 88% -8%,rgba(96,165,250,.32),transparent 56%),linear-gradient(155deg,#0c6fbf 0%,#0a4f8e 46%,#06305a 100%)}
.lsg-root .cover::before{content:"";position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:20px 20px;-webkit-mask-image:linear-gradient(180deg,rgba(0,0,0,.7),transparent 72%);mask-image:linear-gradient(180deg,rgba(0,0,0,.7),transparent 72%)}
.lsg-root .cover .cmotif{position:absolute;left:0;right:0;bottom:0;width:100%;height:56%;z-index:0;pointer-events:none}
.lsg-root .cover .top,.lsg-root .cover .mid,.lsg-root .cover .bot{position:relative;z-index:1}
.lsg-root .cover .top{display:flex;justify-content:space-between;align-items:center;font-size:9px;font-weight:700;letter-spacing:.1em;opacity:.92}
.lsg-root .cover .mid .t{font-size:15px;font-weight:800;line-height:1.25;text-shadow:0 1px 8px rgba(0,0,0,.18)}
.lsg-root .cover .mid .p{font-size:10.5px;opacity:.9;margin-top:4px}
.lsg-root .cover .bot{font-size:9px;opacity:.82;letter-spacing:.04em}
.lsg-root .cvimg{width:100%;height:100%;object-fit:cover;display:block}

.lsg-root .feats{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:820px){.lsg-root .feats{grid-template-columns:1fr}}
.lsg-root .feat{display:grid;grid-template-columns:146px 1fr;border:1px solid var(--line);background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.lsg-root .feat .cover,.lsg-root .feat .cvbox{aspect-ratio:3/4}
.lsg-root .feat .bd{padding:16px 18px;display:flex;flex-direction:column;justify-content:center}
.lsg-root .badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;border-radius:6px;padding:3px 9px;width:fit-content}
.lsg-root .badge.week{color:#0a6f6a;background:#e3f5f2;border:1px solid #c2eae5}
.lsg-root .badge.month{color:#0a5da8;background:#e6f0fb;border:1px solid #cde0f6}
.lsg-root .feat .ti{margin-top:10px;font-size:17px;font-weight:800;line-height:1.3;letter-spacing:-.02em;color:var(--ink)}
.lsg-root .feat .pr{margin-top:5px;font-size:12px;color:var(--mute)}
.lsg-root .feat .su{margin-top:10px;font-size:12.5px;line-height:1.5;color:var(--body)}
.lsg-root .feat .act{margin-top:14px;display:flex;gap:8px}
.lsg-root .btn{font-size:12.5px;font-weight:700;border-radius:8px;padding:7px 13px;cursor:pointer}
.lsg-root .btn.pri{background:#0f1b33;color:#fff}
.lsg-root .btn.sec{background:#fff;color:var(--body);border:1px solid var(--line)}

.lsg-root .acc{border:1px solid var(--line);background:var(--card);border-radius:12px;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.lsg-root .acc summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:11px;padding:14px 16px;user-select:none}
.lsg-root .acc summary::-webkit-details-marker{display:none}
.lsg-root .acc summary:hover{background:#eef2f8}
.lsg-root .acc .sq{width:9px;height:9px;border-radius:2px;flex:none}
.lsg-root .acc.blue .sq{background:#0a66b4}.lsg-root .acc.green .sq{background:#0e827b}.lsg-root .acc.amber .sq{background:#b45309}
.lsg-root .acc .t{font-size:14.5px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
.lsg-root .acc .n{font-size:11px;color:var(--mute);background:#eef1f6;border:1px solid var(--line);border-radius:999px;padding:2px 8px}
.lsg-root .acc .right{margin-left:auto;display:flex;align-items:center;gap:12px}
.lsg-root .acc .prev{font-size:11.5px;color:var(--mute);white-space:nowrap}
@media(max-width:560px){.lsg-root .acc .prev{display:none}}
.lsg-root .acc .chev{width:16px;height:16px;color:var(--mute);transition:transform .22s ease;flex:none}
.lsg-root .acc[open] .chev{transform:rotate(180deg)}
.lsg-root .acc .panel{border-top:1px solid var(--line2)}
.lsg-root .acc .scroll{max-height:372px;overflow:auto}

.lsg-root .arow{display:flex;align-items:center;gap:13px;padding:13px 16px;border-bottom:1px solid var(--line2)}
.lsg-root .arow:last-child{border-bottom:none}.lsg-root .arow:hover{background:#eef2f8}
.lsg-root .arow .dot{width:8px;height:8px;border-radius:2px;flex:none}
.lsg-root .arow.blue .dot{background:#0a66b4}.lsg-root .arow.green .dot{background:#0e827b}
.lsg-root .arow .per{font-size:12px;font-weight:700;color:var(--ink);background:#eef2f7;border:1px solid var(--line);border-radius:6px;padding:3px 9px;white-space:nowrap;font-feature-settings:"tnum" 1}
.lsg-root .arow .ti{flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lsg-root .arow .ti:hover{color:#0a5da8}
.lsg-root .arow .dt{font-size:11.5px;color:var(--mute);white-space:nowrap}
.lsg-root .arow .links{display:flex;align-items:center;gap:10px}
.lsg-root .arow .web{font-size:12px;font-weight:700;color:var(--teal2)}
.lsg-root .arow .pdf{font-size:12px;font-weight:700;color:#0a5da8;border:1px solid #cde0f6;background:#eef5fc;border-radius:7px;padding:4px 11px;white-space:nowrap}
.lsg-root .arow .pdf:hover{background:#e1eefb}
@media(max-width:600px){.lsg-root .arow .dt{display:none}.lsg-root .arow{gap:10px;padding:12px 13px}}

.lsg-root .mtx{width:100%;border-collapse:collapse;font-size:13px}
@media(max-width:680px){.lsg-root .mtx{min-width:560px}}
.lsg-root .mtx thead th{font-size:11px;font-weight:700;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;padding:11px 16px;border-bottom:1px solid var(--line);background:#eef2f7;text-align:left;position:sticky;top:0;z-index:1}
.lsg-root .mtx thead th.c{text-align:center}
.lsg-root .mtx tbody td{padding:11px 16px;border-bottom:1px solid var(--line2);vertical-align:middle}
.lsg-root .mtx tbody tr:last-child td{border-bottom:none}.lsg-root .mtx tbody tr:hover{background:#eef2f8}
.lsg-root .mtx td.c{text-align:center}
.lsg-root .mtx .wk{font-weight:700;color:var(--ink)}.lsg-root .mtx .wk small{display:block;font-weight:400;color:var(--mute);font-size:11px;margin-top:2px}
.lsg-root .mtx .cell{display:inline-flex;align-items:center;gap:8px}
.lsg-root .mtx .web{font-size:12px;font-weight:700;color:var(--teal2)}
.lsg-root .mtx .pdf{font-size:12px;font-weight:700;color:#0a5da8;border:1px solid #cde0f6;background:#eef5fc;border-radius:7px;padding:4px 11px;display:inline-block}
.lsg-root .mtx .pdf:hover{background:#e1eefb}
.lsg-root .mtx .na{color:#c2cad6;font-size:13px}
.lsg-root .mtx-note{padding:10px 16px;font-size:11.5px;color:var(--mute);background:#f0f3f8;border-top:1px solid var(--line)}

.lsg-root .empty{padding:24px;text-align:center;color:var(--mute);font-size:13px;border:1px dashed var(--line);border-radius:12px;background:var(--card)}
.lsg-root .more{display:block;text-align:center;margin:18px 0 4px;padding:10px;border:1px dashed var(--line);border-radius:10px;font-size:12.5px;font-weight:600;color:var(--teal2)}
.lsg-root .sk{background:linear-gradient(90deg,#e9edf3,#f3f6fa,#e9edf3);background-size:200% 100%;animation:lsgsh 1.2s infinite;border-radius:6px}
@keyframes lsgsh{0%{background-position:200% 0}100%{background-position:-200% 0}}

.lsg-root .foot{margin-top:30px;background:#060912;border-top:1px solid var(--lineD);color:var(--dfaint);font-size:13px;padding:48px 0 30px}
.lsg-root .foot .cols{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:30px;border-bottom:1px solid var(--lineD);padding-bottom:30px}
@media(max-width:880px){.lsg-root .foot .cols{grid-template-columns:1fr 1fr}}
.lsg-root .foot p{margin:10px 0 14px;max-width:240px;line-height:1.55;color:var(--dmut)}
.lsg-root .foot h6{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--dmut);margin-bottom:13px}
.lsg-root .foot .cols a{display:block;padding:5px 0;color:var(--dfaint)}.lsg-root .foot .cols a:hover{color:var(--teal)}
.lsg-root .legal{padding-top:22px;font-size:11.5px;line-height:1.8;color:#445064}
@media(prefers-reduced-motion:reduce){.lsg-root *{animation:none!important}}
`;

function Wordmark() {
  return (
    <a href="#" className="brand">
      <span className="mk" />
      <span>
        <span className="b1">Logi</span>
        <span className="b2">s</span>
        <span className="b3">ight</span>
      </span>
    </a>
  );
}
const Chevron = () => (
  <svg
    className="chev"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function classOf(r: Report): ReportClass {
  if (r.report_class) return r.report_class;
  if (r.region) return "weekly_regional";
  return r.type === "monthly" ? "monthly" : "weekly";
}
function isMonth(r: Report) {
  return classOf(r) === "monthly";
}
function shortRange(start?: string, end?: string) {
  if (!start) return "";
  const s = start.split("-"),
    e = (end ?? start).split("-");
  return `${s[1]}.${s[2]}~${e[1]}.${e[2]}`;
}
function fmtMd(s?: string | null) {
  if (!s) return "";
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}.${m[2]}` : s;
}
function seriesName(r: Report) {
  return isMonth(r) ? "월간 시장 리포트" : "주간 물류 동향";
}

function CoverMotif({ week }: { week: boolean }) {
  return week ? (
    <svg
      className="cmotif"
      viewBox="0 0 240 90"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon
        points="0,72 30,60 60,64 90,44 120,52 150,30 180,40 210,22 240,34 240,90 0,90"
        fill="rgba(255,255,255,.13)"
      />
      <polyline
        points="0,72 30,60 60,64 90,44 120,52 150,30 180,40 210,22 240,34"
        fill="none"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  ) : (
    <svg
      className="cmotif"
      viewBox="0 0 240 90"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="rgba(255,255,255,.16)">
        <rect x="10" y="50" width="20" height="40" />
        <rect x="44" y="40" width="20" height="50" />
        <rect x="78" y="46" width="20" height="44" />
        <rect x="112" y="30" width="20" height="60" />
        <rect x="146" y="38" width="20" height="52" />
        <rect x="180" y="24" width="20" height="66" />
        <rect x="214" y="34" width="20" height="56" />
      </g>
      <polyline
        points="20,46 54,36 88,42 122,26 156,34 190,20 224,30"
        fill="none"
        stroke="rgba(255,255,255,.5)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Cover({ r }: { r: Report }) {
  if (r.cover_url)
    return (
      <div className="cvbox">
        <img className="cvimg" src={r.cover_url} alt="" />
      </div>
    );
  const week = !isMonth(r);
  return (
    <div className={`cover ${week ? "week" : "month"}`}>
      <CoverMotif week={week} />
      <div className="top">
        <span>{week ? "WEEKLY" : "MONTHLY"}</span>
        <span>LOGISIGHT</span>
      </div>
      <div className="mid">
        <div className="t">{seriesName(r)}</div>
        <div className="p mono">{r.period_label}</div>
      </div>
      <div className="bot">MTL Shipping Agency</div>
    </div>
  );
}

function FeaturedCard({ r, loading }: { r: Report | null; loading: boolean }) {
  if (loading)
    return (
      <div className="feat">
        <div className="sk" style={{ aspectRatio: "3/4", borderRadius: 0 }} />
        <div className="bd">
          <div className="sk" style={{ width: 60, height: 18 }} />
          <div className="sk" style={{ width: "90%", height: 18, marginTop: 10 }} />
          <div className="sk" style={{ width: "70%", height: 12, marginTop: 10 }} />
        </div>
      </div>
    );
  if (!r) return <div className="empty">아직 발행된 리포트가 없습니다.</div>;
  const week = !isMonth(r);
  return (
    <article className="feat">
      <Cover r={r} />
      <div className="bd">
        <span className={`badge ${week ? "week" : "month"}`}>● {week ? "주간 종합" : "월간"}</span>
        <div className="ti">{r.title}</div>
        {r.published_at ? <div className="pr mono">발행 {fmtMd(r.published_at)}</div> : null}
        {r.summary ? <div className="su">{r.summary}</div> : null}
        <div className="act">
          {r.web_url ? (
            <>
              <a className="btn pri" href={r.web_url}>
                웹으로 보기
              </a>
              <a className="btn sec" href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                PDF 다운로드
              </a>
            </>
          ) : (
            <a className="btn pri" href={r.pdf_url} target="_blank" rel="noopener noreferrer">
              PDF 다운로드
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ListRows({ items, color }: { items: Report[]; color: "blue" | "green" }) {
  return (
    <div className="scroll">
      {items.map((r) => (
        <div className={`arow ${color}`} key={r.id}>
          <span className="dot" />
          <span className="per mono">{r.period_label}</span>
          <a className="ti" href={r.pdf_url} target="_blank" rel="noopener noreferrer">
            {r.title}
          </a>
          {r.published_at ? <span className="dt mono">발행 {fmtMd(r.published_at)}</span> : null}
          <span className="links">
            {r.web_url ? (
              <a className="web" href={r.web_url}>
                웹
              </a>
            ) : null}
            <a className="pdf" href={r.pdf_url} target="_blank" rel="noopener noreferrer">
              PDF
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}

function RegionalMatrix({ items, regionOrder }: { items: Report[]; regionOrder?: string[] }) {
  const cols = useMemo(() => {
    if (regionOrder && regionOrder.length) return regionOrder;
    const present = Array.from(new Set(items.map((r) => r.region).filter(Boolean) as string[]));
    present.sort((a, b) => {
      const ia = PREFERRED_REGIONS.indexOf(a),
        ib = PREFERRED_REGIONS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return present;
  }, [items, regionOrder]);

  const weeks = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        isoWeek?: string | null;
        start: string;
        end: string;
        byRegion: Record<string, Report>;
      }
    >();
    for (const r of items) {
      const key = r.iso_week ?? r.period_start;
      if (!map.has(key))
        map.set(key, {
          key,
          isoWeek: r.iso_week ?? null,
          start: r.period_start,
          end: r.period_end,
          byRegion: {},
        });
      const g = map.get(key)!;
      if (r.region) g.byRegion[r.region] = r;
    }
    return Array.from(map.values()).sort((a, b) => (a.start < b.start ? 1 : -1));
  }, [items]);

  return (
    <>
      <div className="scroll">
        <table className="mtx">
          <thead>
            <tr>
              <th>주차</th>
              {cols.map((c) => (
                <th key={c} className="c">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.key}>
                <td className="wk">
                  {w.isoWeek ?? "주간"}
                  <small>{shortRange(w.start, w.end)}</small>
                </td>
                {cols.map((c) => {
                  const r = w.byRegion[c];
                  return (
                    <td key={c} className="c">
                      {r ? (
                        <span className="cell">
                          {r.web_url ? (
                            <a className="web" href={r.web_url}>
                              웹
                            </a>
                          ) : null}
                          <a
                            className="pdf"
                            href={r.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            PDF
                          </a>
                        </span>
                      ) : (
                        <span className="na">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mtx-note">
        권역별 주간 리포트는 주차×권역으로 묶어 표시합니다. 발행 안 된 권역은 <b>—</b>.
      </div>
    </>
  );
}

function Accordion({
  defaultOpen,
  color,
  title,
  count,
  preview,
  children,
}: {
  defaultOpen?: boolean;
  color: "blue" | "green" | "amber";
  title: string;
  count: ReactNode;
  preview?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <details
      className={`acc ${color}`}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="sq" />
        <span className="t">{title}</span>
        <span className="n mono">{count}</span>
        <span className="right">
          {preview ? <span className="prev mono">{preview}</span> : null}
          <Chevron />
        </span>
      </summary>
      <div className="panel">{children}</div>
    </details>
  );
}

/* ===================== GEO: Article 스키마용 최신 발행일 산출 ===================== */
// 최신 주간·월간 리포트의 실제 발행일만 사용한다(날조 금지). 보이지 않는 Article JSON-LD 전용.
function buildReportsGeo(weekly: Report | null | undefined, monthly: Report | null | undefined) {
  // 참조일 = 가장 최근 리포트 발행일(ISO 비교용 원본 사용).
  const isoDates = [weekly?.published_at, monthly?.published_at].filter(Boolean) as string[];
  const latestIso = isoDates.sort().slice(-1)[0]?.slice(0, 10) ?? null;
  return { latestIso };
}

export default function LogisightReports({
  showNav = true,
  latestWeekly = FB_WEEKLY,
  latestMonthly = FB_MONTHLY,
  archive = FB_ARCHIVE,
  loading = false,
  regionOrder,
}: Props) {
  const { monthly, weekly, regional } = useMemo(() => {
    const monthly: Report[] = [],
      weekly: Report[] = [],
      regional: Report[] = [];
    for (const r of archive ?? []) {
      const c = classOf(r);
      if (c === "monthly") monthly.push(r);
      else if (c === "weekly_regional") regional.push(r);
      else weekly.push(r);
    }
    const byStart = (a: Report, b: Report) => (a.period_start < b.period_start ? 1 : -1);
    return {
      monthly: monthly.sort(byStart),
      weekly: weekly.sort(byStart),
      regional: regional.sort(byStart),
    };
  }, [archive]);

  const sections = useMemo(() => {
    const out: {
      key: string;
      color: "blue" | "green" | "amber";
      title: string;
      count: ReactNode;
      preview?: string;
      kind: "list" | "matrix";
      items: Report[];
    }[] = [];
    if (monthly.length)
      out.push({
        key: "m",
        color: "blue",
        title: "월간 시장 리포트",
        count: monthly.length,
        preview: `최신 ${monthly[0].period_label}`,
        kind: "list",
        items: monthly,
      });
    if (weekly.length)
      out.push({
        key: "w",
        color: "green",
        title: "주간 물류 동향 (종합)",
        count: weekly.length,
        preview: `최신 ${weekly[0].iso_week ?? weekly[0].period_label}`,
        kind: "list",
        items: weekly,
      });
    if (regional.length)
      out.push({
        key: "r",
        color: "amber",
        title: "주간 권역 리포트",
        count: `${new Set(regional.map((r) => r.region).filter(Boolean)).size}개 권역`,
        preview: `최신 ${regional[0].iso_week ?? shortRange(regional[0].period_start, regional[0].period_end)}`,
        kind: "matrix",
        items: regional,
      });
    return out;
  }, [monthly, weekly, regional]);

  const geo = useMemo(
    () => buildReportsGeo(latestWeekly, latestMonthly),
    [latestWeekly, latestMonthly],
  );

  return (
    <div className="lsg-root">
      <style>{STYLE}</style>

      {showNav && (
        <header className="nav">
          <div className="wrap row">
            <Wordmark />
            <nav>
              {NAV.map((n) => (
                <a key={n.l} href="#" className={n.on ? "on" : undefined}>
                  {n.l}
                </a>
              ))}
            </nav>
          </div>
        </header>
      )}

      <section className="hero">
        <div className="glow" />
        <svg
          className="motif"
          viewBox="0 0 520 360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g fill="#2dd4bf" opacity="0.5">
            <rect x="250" y="70" width="150" height="200" rx="10" opacity="0.16" />
            <rect x="280" y="50" width="150" height="200" rx="10" opacity="0.22" />
            <rect x="310" y="30" width="150" height="200" rx="10" opacity="0.14" />
          </g>
          <g stroke="#5eead4" strokeWidth="1.4" opacity="0.5" fill="none">
            <polyline points="330,150 360,130 390,140 420,105 450,118" />
          </g>
          <g fill="#5eead4">
            <circle cx="420" cy="105" r="3.5" />
          </g>
        </svg>
        <div className="wrap in">
          <span className="eyebrow">Market Reports</span>
          <h1>마켓 리포트</h1>
          <p>
            MTL이 매주·매월 발행하는 물류 시장 인텔리전스 리포트 — 운임·해상·항공·철도·무역을 한
            편에 정리합니다.
          </p>
          <div className="hpills">
            <span className="p">
              <span className="dot" style={{ background: "#2dd4bf" }} />
              최신 주간 <b className="mono">{latestWeekly?.period_label ?? "—"}</b>
            </span>
            <span className="p">
              <span className="dot" style={{ background: "#3b82f6" }} />
              최신 월간 <b className="mono">{latestMonthly?.period_label ?? "—"}</b>
            </span>
            <span className="p">
              <span className="dot" style={{ background: "#14b8a6" }} />
              무료 구독
            </span>
          </div>
        </div>
      </section>

      <div className="sheet">
        <div className="wrap">
          {/* GEO: 보이지 않는 Article JSON-LD만 유지(시각 요소 없음) */}
          <GeoArticleSchema
            article={{
              headline: "마켓 리포트 — 주간·월간 물류 시장 인텔리전스",
              description:
                "MTL이 매주·매월 발행하는 물류 시장 인텔리전스 리포트 — 운임·해상·항공·철도·무역을 한 편에 정리합니다.",
              path: "/reports",
              datePublished: geo.latestIso,
              dateModified: geo.latestIso,
            }}
          />

          {/* 최신: 그래프 표지 카드 */}
          <div className="sect-h">
            <h2>최신 리포트</h2>
            <span className="chip">주간 종합 · 월간</span>
          </div>
          <div className="feats">
            <FeaturedCard r={latestWeekly} loading={loading} />
            <FeaturedCard r={latestMonthly} loading={loading} />
          </div>

          {/* 아카이브: 아코디언 */}
          <div className="sect-h">
            <h2>아카이브</h2>
            <span className="chip">종류별 · ▼ 펼치기</span>
          </div>
          {loading ? (
            <div className="empty">불러오는 중…</div>
          ) : sections.length === 0 ? (
            <div className="empty">아직 발행된 리포트가 없습니다.</div>
          ) : (
            sections.map((sec, i) => (
              <Accordion
                key={sec.key}
                defaultOpen={i === 0}
                color={sec.color}
                title={sec.title}
                count={sec.count}
                preview={sec.preview}
              >
                {sec.kind === "matrix" ? (
                  <RegionalMatrix items={regional} regionOrder={regionOrder} />
                ) : (
                  <ListRows items={sec.items} color={sec.color as "blue" | "green"} />
                )}
              </Accordion>
            ))
          )}

          <a href="#" className="more">
            이전 리포트 더 보기 (연·월 아카이브) →
          </a>
        </div>
      </div>

      {showNav && (
        <footer className="foot">
          <div className="wrap">
            <div className="cols">
              <div>
                <Wordmark />
                <p>(주)MTL이 운영하는 물류 인텔리전스</p>
              </div>
              <div>
                <h6>서비스</h6>
                <a href="#">운임 대시보드</a>
                <a href="#">유라시아 코리도어</a>
                <a href="#">산업별 교역</a>
                <a href="#">마켓 리포트</a>
              </div>
              <div>
                <h6>뉴스</h6>
                <a href="#">해상</a>
                <a href="#">항공</a>
                <a href="#">철도</a>
                <a href="#">무역</a>
              </div>
              <div>
                <h6>MTL</h6>
                <a href="#">회사소개</a>
                <a href="#">뉴스레터 구독</a>
                <a href="#">영업 문의</a>
              </div>
            </div>
            <div className="legal mono">
              Logisight is operated by MTL Shipping Agency. · 주요 데이터 출처는{" "}
              <a href="/methodology" style={{ textDecoration: "underline" }}>데이터 방법론</a> 페이지 참조
              <br />© 2026 MTL Shipping Agency. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
