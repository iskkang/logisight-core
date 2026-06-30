// 산업(Industries) 페이지 — 사용자 제공 샘플(LogisightIndustries) 디자인을 실데이터에 연결.
// 데이터/집계는 기존 /industries 와 동일(관세청 HS 품목 통계 + freight_indices). 표현만 샘플 디자인.
// 운송수단·장비 매핑은 산업 일반화 매핑(편집 상수)이고 교역 수치는 전부 실데이터. AI 종합은
// 파이프라인 미연동이라 규칙 기반 요약(실데이터 파생)으로 대체 — 미검수 AI 문구 생성 금지(Phase-6).
import { useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import LogisightLoader from "@/components/LogisightLoader";
import {
  tradeSummaryQueryOptions,
  hsChapterName,
  formatPeriod,
  formatUSD,
  type TradeSummaryRow,
} from "@/lib/api/industries";
import { indexStatsQueryOptions, type IndexStats } from "@/lib/api/rates";
import { DataMeta } from "@/components/ui/DataMeta";

/* ============================ STYLE (.lsgi-root 스코프) ============================ */
const STYLE = `
.lsgi-root{--bg:#070b16;--bg3:#0e1626;--lineD:#78a0cd1c;--dmut:#93a1b7;
  --paper:#e6eaf1;--card:#f4f7fb;--line:#d8dfe9;--line2:#e6ebf2;--ink:#1a2433;--body:#54606f;--mute:#828d9d;
  --teal:#2dd4bf;--teal2:#0d9488;--up:#16a34a;--down:#dc2626;--warn:#d97706;--blue:#3b82f6;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em;min-height:100vh}
.lsgi-root .mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
.lsgi-root .iwrap{max-width:1240px;margin:0 auto;padding:0 28px}
@media(max-width:640px){.lsgi-root .iwrap{padding:0 16px}}
.lsgi-root .up{color:var(--up)}.lsgi-root .down{color:var(--down)}.lsgi-root .bl{color:var(--blue)}

.lsgi-root .hero{position:relative;overflow:hidden;background:var(--bg)}
.lsgi-root .hero .glow{position:absolute;left:50%;top:-120px;width:900px;height:500px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%);pointer-events:none}
.lsgi-root .hero svg.motif{position:absolute;right:-30px;top:0;height:100%;width:560px;opacity:.55;pointer-events:none}
.lsgi-root .hero .in{position:relative;z-index:1;padding:52px 0 74px}
.lsgi-root .hero .eyebrow{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--teal)}
.lsgi-root .hero h1{margin-top:12px;font-size:clamp(30px,4vw,46px);font-weight:800;line-height:1.06;letter-spacing:-.035em;color:#e9eef7}
.lsgi-root .hero p{margin-top:14px;max-width:660px;font-size:15px;line-height:1.6;color:var(--dmut)}
.lsgi-root .hpills{margin-top:20px;display:flex;flex-wrap:wrap;gap:10px}
.lsgi-root .hpills .p{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--lineD);background:var(--bg3);border-radius:999px;padding:7px 13px;font-size:12.5px;color:var(--dmut)}
.lsgi-root .hpills .p b{color:#e9eef7}.lsgi-root .hpills .dot{width:7px;height:7px;border-radius:50%}

.lsgi-root .sheet{position:relative;z-index:2;margin-top:-28px;background:var(--paper);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -34px rgba(0,0,0,.7);padding-bottom:10px}
.lsgi-root .bc{padding-top:26px;font-size:12.5px;color:var(--mute)}.lsgi-root .bc b{color:var(--body);font-weight:500}
.lsgi-root .bc a:hover{color:var(--teal2)}

.lsgi-root .card{border:1px solid var(--line);background:var(--card);border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.lsgi-root .sect-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:26px 0 14px}
.lsgi-root .sect-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsgi-root .chip{border:1px solid var(--line);background:#eef1f6;border-radius:999px;padding:3px 9px;font-size:11px;color:var(--mute)}

.lsgi-root .filters{margin-top:14px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:12px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;font-size:12.5px}
.lsgi-root .filters .grp{display:flex;align-items:center;gap:7px}.lsgi-root .filters .k{color:var(--mute);font-size:11.5px}
.lsgi-root .filters .seg{display:flex;gap:2px;background:#eef1f6;border:1px solid var(--line);border-radius:9px;padding:3px}
.lsgi-root .filters .seg button{padding:5px 10px;border-radius:7px;color:var(--body);white-space:nowrap;border:none;background:transparent;cursor:pointer;font:inherit}
.lsgi-root .filters .seg button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(16,24,40,.06)}
.lsgi-root .filters .meta{margin-left:auto;color:var(--mute);font-size:11.5px}

.lsgi-root .judge{margin-top:14px;border:1px solid var(--line);background:linear-gradient(180deg,#fbfcfe,#f4f7fb);border-radius:16px;padding:18px 20px}
.lsgi-root .judge .top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.lsgi-root .judge .verdict{font-size:15px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
.lsgi-root .judge .ai{margin-top:6px;font-size:12.5px;color:var(--body);max-width:720px;line-height:1.55}
.lsgi-root .jstamp{font-size:11px;color:var(--mute);white-space:nowrap}
.lsgi-root .tiles{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:880px){.lsgi-root .tiles{grid-template-columns:repeat(2,1fr)}}
.lsgi-root .tile{border:1px solid var(--line);background:#fff;border-radius:12px;padding:13px 14px}
.lsgi-root .tile .k{font-size:11.5px;color:var(--mute)}
.lsgi-root .tile .v{margin-top:6px;font-size:23px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsgi-root .tile .d{margin-top:4px;font-size:11.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lsgi-root .tile .smu{color:var(--mute)}
.lsgi-root .gauge{height:6px;border-radius:999px;background:#e6ebf2;margin-top:9px;overflow:hidden}.lsgi-root .gauge i{display:block;height:100%;border-radius:999px}

.lsgi-root .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:980px){.lsgi-root .grid3{grid-template-columns:1fr}}
.lsgi-root .sig{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:16px 17px}
.lsgi-root .sig .bd{display:inline-flex;align-items:center;gap:5px;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700}
.lsgi-root .bd.surge{background:#ecfdf3;color:#067647;border:1px solid #c7ead6}
.lsgi-root .bd.roro{background:#fff7ed;color:#b45309;border:1px solid #fde6c8}
.lsgi-root .bd.def{background:#fef2f2;color:#b42318;border:1px solid #fbd5d5}
.lsgi-root .sig .nm{margin-top:11px;font-size:16px;font-weight:800;color:var(--ink);display:flex;align-items:baseline;gap:8px}
.lsgi-root .sig .nm .yoy{font-size:13px;font-weight:700}
.lsgi-root .sig .val{font-size:12px;color:var(--mute);margin-top:2px}
.lsgi-root .sig .desc{margin-top:9px;font-size:12.5px;line-height:1.5;color:var(--body)}.lsgi-root .sig .desc b{color:var(--ink)}
.lsgi-root .sig .map{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}
.lsgi-root .sig .bridge{margin-top:10px;border-top:1px dashed var(--line);padding-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.lsgi-root .sig .bridge .lane{font-size:12px;color:var(--body)}.lsgi-root .sig .bridge .lane b{color:var(--ink);font-weight:700}
.lsgi-root .fcast{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;white-space:nowrap}
.lsgi-root .fc-up{background:#ecfdf3;color:#067647}.lsgi-root .fc-dn{background:#fef2f2;color:#b42318}.lsgi-root .fc-fl{background:#f1f5f9;color:#475569}
.lsgi-root .sig .lk{margin-top:11px;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--teal2)}

.lsgi-root .mode{font-size:10.5px;font-weight:700;border-radius:5px;padding:2px 7px;border:1px solid;white-space:nowrap;display:inline-block}
.lsgi-root .m-fcl{color:#1d4ed8;background:#eff6ff;border-color:#cfe0fd}
.lsgi-root .m-air{color:#7c3aed;background:#f5f3ff;border-color:#e0d7fb}
.lsgi-root .m-roro{color:#b45309;background:#fff7ed;border-color:#fde6c8}
.lsgi-root .m-bulk{color:#475569;background:#f1f5f9;border-color:#dbe3ec}
.lsgi-root .m-reefer{color:#0d9488;background:#ecfdf5;border-color:#c7ead6}
.lsgi-root .m-spec{color:#9333ea;background:#faf5ff;border-color:#ecd9fb}

.lsgi-root .bridgewrap{border:1px solid var(--line);background:var(--card);border-radius:14px;overflow:hidden}
.lsgi-root .btbl{width:100%;border-collapse:collapse;font-size:13px}
.lsgi-root .btbl thead th{text-align:left;font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;padding:12px 16px;border-bottom:1px solid var(--line);background:#eef2f7}
.lsgi-root .btbl tbody td{padding:13px 16px;border-bottom:1px solid var(--line2);vertical-align:middle}
.lsgi-root .btbl tbody tr:last-child td{border-bottom:none}.lsgi-root .btbl tbody tr:hover{background:#eef2f8}
.lsgi-root .btbl .reg{font-weight:700;color:var(--ink)}.lsgi-root .btbl .reg small{display:block;font-weight:400;color:var(--mute);font-size:11px;margin-top:2px}
.lsgi-root .btbl .lane{color:var(--body)}.lsgi-root .btbl .idx{font-weight:700;color:var(--ink)}.lsgi-root .btbl .idx small{font-weight:400;color:var(--mute);font-size:11px}
.lsgi-root .btbl th.r,.lsgi-root .btbl td.r{text-align:right}
.lsgi-root .smu{color:var(--mute)}
.lsgi-root .idxnote{padding:11px 16px;font-size:11.5px;color:var(--mute);background:#f0f3f8;border-top:1px solid var(--line)}

.lsgi-root .two{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}
@media(max-width:980px){.lsgi-root .two{grid-template-columns:1fr}}
.lsgi-root .pad{padding:16px 18px}
.lsgi-root .ch-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}.lsgi-root .ch-h .t{font-size:14px;font-weight:700;color:var(--ink)}
.lsgi-root .legend{display:flex;gap:14px;justify-content:center;margin-top:8px;font-size:11.5px;color:var(--body)}
.lsgi-root .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}

.lsgi-root .dv{display:flex;flex-direction:column;gap:10px}
.lsgi-root .dv .r{display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;gap:8px;font-size:11.5px}
.lsgi-root .dv .imp{display:flex;justify-content:flex-end}.lsgi-root .dv .imp i{height:14px;border-radius:3px 0 0 3px;background:#b7c6dd}
.lsgi-root .dv .lbl{text-align:center;font-weight:700;color:var(--ink);font-size:11px}
.lsgi-root .dv .exp i{height:14px;border-radius:0 3px 3px 0;background:#1864ab;display:block}

.lsgi-root .donut{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.lsgi-root .ring{position:relative;width:150px;height:150px;border-radius:50%;flex:none}
.lsgi-root .ring::after{content:"";position:absolute;inset:26px;background:var(--card);border-radius:50%}
.lsgi-root .ring .ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1}
.lsgi-root .ring .ctr b{font-size:17px;font-weight:800;color:var(--ink)}.lsgi-root .ring .ctr span{font-size:10.5px;color:var(--mute)}
.lsgi-root .dleg{flex:1;min-width:180px;display:flex;flex-direction:column;gap:7px}
.lsgi-root .dleg .r{display:flex;align-items:center;gap:8px;font-size:12.5px}.lsgi-root .dleg .r .sw{width:10px;height:10px;border-radius:3px}
.lsgi-root .dleg .r .nm{color:var(--ink);font-weight:600}.lsgi-root .dleg .r .vv{margin-left:auto;color:var(--body)}.lsgi-root .dleg .r .pc{color:var(--mute);min-width:34px;text-align:right}

.lsgi-root .tree{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:42px;gap:6px}
.lsgi-root .tm{border-radius:9px;padding:9px 11px;color:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start}
.lsgi-root .tm b{font-size:12.5px;font-weight:700}.lsgi-root .tm span{font-size:10.5px;opacity:.85}
.lsgi-root .tm.s{justify-content:center}.lsgi-root .tm.s b{font-size:11px}.lsgi-root .tm.s span{font-size:9.5px}

.lsgi-root .ttable{width:100%;border-collapse:collapse;font-size:13px}
.lsgi-root .ttable thead th{text-align:left;font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;padding:11px 14px;border-bottom:1px solid var(--line)}
.lsgi-root .ttable th.r,.lsgi-root .ttable td.r{text-align:right}
.lsgi-root .ttable tbody td{padding:11px 14px;border-bottom:1px solid var(--line2)}
.lsgi-root .ttable tbody tr:last-child td{border-bottom:none}.lsgi-root .ttable tbody tr:hover{background:#eef2f8}
.lsgi-root .rk{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:6px;background:#eef1f6;color:var(--body);font-size:11px;font-weight:700;margin-right:2px}
.lsgi-root .hsb{font-size:10px;font-weight:700;color:var(--mute);background:#eef1f6;border-radius:4px;padding:2px 5px;margin-right:7px}
.lsgi-root .more{display:block;text-align:center;margin:0 16px 14px;padding:9px;border:1px dashed var(--line);border-radius:9px;font-size:12.5px;font-weight:600;color:var(--teal2)}

.lsgi-root .side{display:flex;flex-direction:column;gap:14px}
.lsgi-root .sc-h{font-size:14px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:8px;margin-bottom:2px}
.lsgi-root .sgrp{font-size:11px;color:var(--mute);margin:2px 0 6px;font-weight:600}
.lsgi-root .bal{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--line2)}
.lsgi-root .bal:last-child{border-bottom:none}.lsgi-root .bal .c{color:var(--ink);font-weight:600}.lsgi-root .bal .c small{color:var(--mute);font-weight:400;margin-left:4px}
.lsgi-root .note{font-size:12px;line-height:1.6;color:var(--body)}.lsgi-root .note b{color:var(--ink)}
@media(prefers-reduced-motion:reduce){.lsgi-root *{animation:none!important;transition:none!important}}
`;

/* ============================ MODEL ============================ */
type ChapterAgg = { chapter: string; name: string; exp: number; imp: number; balance: number };
const pk = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(0, 6);
const pctChange = (cur: number, prev: number | undefined | null) => (prev == null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);
const fmtPct = (v: number | null | undefined, d = 1) => (v == null || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);

// 사전집계 요약(hs_chapter 차원, 한 기준월)을 ChapterAgg로 변환 — 기존 aggregateByChapter와 동일 산출.
function chapterAggsFor(rows: TradeSummaryRow[], periodPk: string): ChapterAgg[] {
  return rows
    .filter((r) => r.dim_type === "hs_chapter" && pk(r.period) === periodPk)
    .map((r) => {
      const exp = r.export_usd ?? 0;
      const imp = r.import_usd ?? 0;
      return { chapter: r.dim_key, name: hsChapterName(r.dim_key), exp, imp, balance: exp - imp };
    })
    .sort((a, b) => b.exp - a.exp);
}

// trade_summary(hs_chapter)에서 산업별 모델 재구성. 기존 item 전수 집계와 동일 차원·기간·산출.
function buildIndustryModel(rows: TradeSummaryRow[]) {
  const ch = rows.filter((r) => r.dim_type === "hs_chapter");
  const periods = [...new Set(ch.map((r) => pk(r.period)).filter((x) => x.length === 6))].sort();
  const latest = periods.at(-1) ?? null;
  const prevYear = latest ? `${Number(latest.slice(0, 4)) - 1}${latest.slice(4, 6)}` : null;
  const aggs = latest ? chapterAggsFor(rows, latest) : [];
  const prevByCh = new Map((prevYear ? chapterAggsFor(rows, prevYear) : []).map((a) => [a.chapter, a.exp]));
  const totalExp = aggs.reduce((s, a) => s + a.exp, 0);
  const totalImp = aggs.reduce((s, a) => s + a.imp, 0);
  const prevTotalExp = [...prevByCh.values()].reduce((s, v) => s + v, 0);
  // 챕터별 월 수출 시계열(스파크용) — 요약 hs_chapter의 기간별 export.
  const monthlyOf = (chapter: string) =>
    ch
      .filter((r) => r.dim_key === chapter)
      .sort((a, b) => pk(a.period).localeCompare(pk(b.period)))
      .map((r) => r.export_usd ?? 0)
      .slice(-7);
  // 전체 월별 수출·수입(최근 6) — 기간별 챕터 합.
  const byMonth = new Map<string, { exp: number; imp: number }>();
  for (const r of ch) {
    const p = pk(r.period);
    if (p.length !== 6) continue;
    const c = byMonth.get(p) ?? { exp: 0, imp: 0 };
    c.exp += r.export_usd ?? 0;
    c.imp += r.import_usd ?? 0;
    byMonth.set(p, c);
  }
  const monthly = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([p, v]) => ({ p, ...v }));
  return { latest, aggs, prevByCh, totalExp, totalImp, balance: totalExp - totalImp, totalExpYoY: pctChange(totalExp, prevTotalExp), monthlyOf, monthly, periodCount: aggs.length };
}

/* 산업 → 운송수단·장비 일반화 매핑(편집 상수, 수치 아님) + 연동 운임지수 코드 */
const HS_MODE: Record<string, { cls: string; t: string }[]> = {
  "85": [{ cls: "m-fcl", t: "해상 FCL" }, { cls: "m-air", t: "항공" }],
  "84": [{ cls: "m-fcl", t: "해상 FCL" }],
  "87": [{ cls: "m-roro", t: "RoRo" }],
  "27": [{ cls: "m-bulk", t: "탱커/벌크" }],
  "33": [{ cls: "m-fcl", t: "해상 FCL" }, { cls: "m-air", t: "항공" }],
  "30": [{ cls: "m-air", t: "항공" }, { cls: "m-reefer", t: "리퍼 콜드체인" }],
  "39": [{ cls: "m-fcl", t: "해상 FCL" }],
  "89": [{ cls: "m-spec", t: "특수(선박)" }],
  "90": [{ cls: "m-air", t: "항공·FCL" }],
  "71": [{ cls: "m-air", t: "항공(보안)" }],
  "72": [{ cls: "m-bulk", t: "벌크" }],
  "40": [{ cls: "m-fcl", t: "FCL" }],
};
const modeOf = (ch: string) => HS_MODE[ch] ?? [{ cls: "m-fcl", t: "해상 FCL" }];
const HS_INDEX: Record<string, string> = { "85": "SCFI", "84": "FBX", "27": "BDI", "33": "SCFI", "39": "SCFI", "72": "BDI", "40": "SCFI", "90": "SCFI" };
const HS_LANE: Record<string, string> = {
  "85": "부산 → 가오슝/상하이/LA", "84": "부산 → 유럽/미국", "87": "부산 → 유럽/미국/중동", "27": "중동 → 부산 (수입)",
  "33": "부산 → 중국/미국/베트남", "30": "항공 콜드체인", "39": "부산 → 아시아", "89": "조선 인도", "90": "부산 → 미국/중국", "72": "부산 → 아시아",
};

/* ============================ UI ============================ */
function Spark({ vals, color }: { vals: number[]; color: string }) {
  const rawId = useId();
  const id = "isg" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  if (vals.length < 2) return <div style={{ height: 30 }} />;
  const w = 120, h = 30, min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg style={{ margin: "10px 0 4px", height: 30, width: "100%", display: "block" }} viewBox="0 0 120 30" preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} 120,30 0,30`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
const fcOf = (wow: number | null): "fc-up" | "fc-dn" | "fc-fl" => (wow == null ? "fc-fl" : wow > 1 ? "fc-up" : wow < -1 ? "fc-dn" : "fc-fl");
const fcLabel = (fc: string) => (fc === "fc-up" ? "▲ 상승" : fc === "fc-dn" ? "▼ 약세" : "◆ 보합");

/* 트리맵 고정 그리드 템플릿(샘플과 동일, rank 기반) */
const TM_TEMPLATE: { rank: number; c: number; r: number; big: boolean }[] = [
  { rank: 0, c: 6, r: 4, big: true }, { rank: 1, c: 3, r: 3, big: true }, { rank: 2, c: 3, r: 2, big: true },
  { rank: 3, c: 3, r: 1, big: false }, { rank: 4, c: 6, r: 1, big: false }, { rank: 5, c: 2, r: 1, big: false },
  { rank: 6, c: 2, r: 1, big: false }, { rank: 7, c: 2, r: 1, big: false }, { rank: 8, c: 3, r: 1, big: false },
  { rank: 9, c: 3, r: 1, big: false }, { rank: 10, c: 3, r: 1, big: false }, { rank: 11, c: 3, r: 1, big: false },
];
const TM_SHADES = ["#3b4f7a", "#5a6f9e", "#6478a6", "#7d8fb8", "#8294ba", "#92a2c4", "#9aa9c9", "#8a9bc0", "#a2b0ce", "#aab7d3", "#b2bed8", "#bcc7df"];
const DONUT_COLORS = ["#1864ab", "#38bdf8", "#3b82f6", "#f59e0b", "#8b9dc9", "#cbb6d6"];

/* 데이터 도착 전 즉시 그려지는 스켈레톤. 빈 화면 대신 로딩 맥락(관세청 월간 집계)과
   필터·차트·테이블 자리를 보여준다. 실제 데이터는 useQuery 가 받아 IndustriesBody 로 교체. */
function Sk({ h, w, mt }: { h: number; w: number | string; mt?: number }) {
  return <span className="block animate-pulse rounded-[6px] bg-[#d8dfe9]" style={{ height: h, width: w, marginTop: mt }} />;
}
function IndustriesSkeleton() {
  return (
    <div className="lsgi-root"><style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />
      <section className="hero">
        <span className="glow" />
        <div className="iwrap in">
          <div className="eyebrow">Industry Intelligence</div>
          <h1>산업별 교역 동향</h1>
          <p>산업별 교역 데이터를 불러오고 있습니다. 관세청 월간 수출입 데이터 기준으로 HS Code·산업군·국가별 흐름을 집계 중입니다. 데이터량이 많아 다소 시간이 걸릴 수 있습니다.</p>
        </div>
      </section>
      <div className="sheet">
        <div className="iwrap">
          <div className="bc" style={{ color: "#828d9d" }}>홈 › 인사이트 › 산업별</div>
          {/* 필터(산업·국가) 자리 */}
          <div className="filters" style={{ marginTop: 14 }}>
            <Sk h={28} w={140} /><Sk h={28} w={120} /><Sk h={28} w={120} />
          </div>
          {/* KPI 카드 자리 */}
          <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: "16px 18px" }}>
                <Sk h={14} w={80} /><Sk h={24} w={120} mt={10} /><Sk h={12} w={96} mt={10} />
              </div>
            ))}
          </div>
          {/* 차트 박스 자리 */}
          <div className="card" style={{ marginTop: 14, padding: 18 }}>
            <Sk h={16} w={160} /><Sk h={180} w="100%" mt={14} />
          </div>
          {/* 테이블 자리 */}
          <div className="card" style={{ marginTop: 14, padding: 18 }}>
            <Sk h={16} w={140} />
            {[0, 1, 2, 3, 4].map((i) => <Sk key={i} h={20} w="100%" mt={12} />)}
          </div>
          <div className="mono" style={{ marginTop: 14, fontSize: 11, color: "#828d9d" }}>최근 기준월 · 관세청 월간 수출입 통계</div>
        </div>
      </div>
      <HomeFooter />
    </div>
  );
}

/* ============================ PAGE ============================ */
// 데이터 로드가 끝날 때까지 스켈레톤 + 브랜드 로딩 오버레이를 띄우고, 도착하면 페이드아웃(/trade 와 동일).
export function LogisightIndustries() {
  const { data: summaryRows } = useQuery(tradeSummaryQueryOptions());
  const { data: indexStats } = useQuery(indexStatsQueryOptions());
  const loading = !summaryRows || !indexStats;
  return (
    <>
      <LogisightLoader show={loading} />
      {loading ? <IndustriesSkeleton /> : <IndustriesBody summaryRows={summaryRows} indexStats={indexStats} />}
    </>
  );
}

function IndustriesBody({ summaryRows, indexStats }: { summaryRows: TradeSummaryRow[]; indexStats: IndexStats[] }) {
  const [metric, setMetric] = useState<"exp" | "imp" | "bal">("exp");

  const model = useMemo(() => buildIndustryModel(summaryRows), [summaryRows]);

  const { aggs, totalExp, balance } = model;
  const yoyOf = (ch: string) => pctChange(model.aggs.find((a) => a.chapter === ch)?.exp ?? 0, model.prevByCh.get(ch));
  const idxOf = (ch: string) => indexStats.find((s) => s.index_code === (HS_INDEX[ch] ?? ""));
  const periodLabel = formatPeriod(model.latest ?? "");

  if (aggs.length === 0) {
    return (
      <div className="lsgi-root"><style>{STYLE}</style><HomeNav active="insight" /><InsightSubNav />
        <div className="iwrap" style={{ padding: "80px 28px", textAlign: "center" }}><p style={{ fontSize: 15, fontWeight: 700, color: "#e9eef7" }}>데이터 수집 중</p><p style={{ marginTop: 6, fontSize: 12.5, color: "#93a1b7" }}>관세청 HS 통계가 적재되면 표시됩니다.</p></div>
        <HomeFooter />
      </div>
    );
  }

  const top = aggs[0];
  const deficit = [...aggs].sort((a, b) => a.balance - b.balance)[0];
  const surplusTop = [...aggs].filter((a) => a.balance > 0).slice(0, 3);
  const deficitTop = [...aggs].filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance).slice(0, 3);

  // 시그널 — 급증(YoY 최상위)·자동차/RoRo·최대 적자
  const movers = aggs.map((a) => ({ a, yoy: yoyOf(a.chapter) })).filter((x) => x.yoy != null);
  const surge = [...movers].sort((a, b) => b.yoy! - a.yoy!)[0]?.a ?? top;
  const auto = aggs.find((a) => a.chapter === "87") ?? aggs[1] ?? top;
  const signals = [
    { kind: "surge", bd: "▲ 급증", a: surge, modes: modeOf(surge.chapter), lane: HS_LANE[surge.chapter] ?? "부산 → 주요 노선" },
    { kind: "roro", bd: "⚓ 물류 압박", a: auto, modes: modeOf(auto.chapter), lane: HS_LANE[auto.chapter] ?? "부산 → 주요 노선" },
    { kind: "def", bd: "▼ 최대 적자", a: deficit, modes: modeOf(deficit.chapter), lane: HS_LANE[deficit.chapter] ?? "수입 노선" },
  ];

  // 종합 판단(규칙 기반)
  const topShare = totalExp > 0 ? Math.round((top.exp / totalExp) * 100) : 0;
  const verdict = `수출은 ${top.name}(HS${top.chapter}) 단일 산업이 ${topShare}% 주도, 무역수지 ${balance >= 0 ? "흑자" : "적자"} ${formatUSD(Math.abs(balance))}.`;
  const detail = `${top.name}(HS${top.chapter})가 수출의 ${topShare}%를 차지하며 최대 흑자 산업입니다.${deficit.balance < 0 ? ` ${deficit.name}(HS${deficit.chapter})은 ${formatUSD(deficit.balance)}로 최대 적자 — 운송 측면은 ${modeOf(deficit.chapter)[0].t} 의존.` : ""} 운송수단·장비 매핑은 산업 일반화이며 화주·품목에 따라 달라질 수 있습니다.`;

  // 트리맵 / 도넛 데이터(metric 반영: 수출/수입/수지)
  const valOf = (a: ChapterAgg) => (metric === "imp" ? a.imp : metric === "bal" ? a.balance : a.exp);
  const tmSorted = [...aggs].map((a) => ({ a, v: Math.max(0, valOf(a)) })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v).slice(0, 12);
  const donutTop = [...aggs].sort((a, b) => valOf(b) - valOf(a)).filter((a) => valOf(a) > 0).slice(0, 5);
  const donutRest = [...aggs].sort((a, b) => valOf(b) - valOf(a)).filter((a) => valOf(a) > 0).slice(5).reduce((s, a) => s + valOf(a), 0);
  const donutSegs = [...donutTop.map((a) => ({ nm: `HS${a.chapter} ${a.name}`, v: valOf(a) })), ...(donutRest > 0 ? [{ nm: "기타", v: donutRest }] : [])];
  const donutTotal = donutSegs.reduce((s, x) => s + x.v, 0);
  let dacc = 0;
  const donutStops = donutSegs.map((seg, i) => { const f = donutTotal > 0 ? (dacc / donutTotal) * 100 : 0; dacc += seg.v; const t = donutTotal > 0 ? (dacc / donutTotal) * 100 : 0; return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${f.toFixed(1)}% ${t.toFixed(1)}%`; }).join(",");
  // 다이버징(상위 6, 수입/수출 비율)
  const dvTop = aggs.slice(0, 6);
  const dvMax = Math.max(...dvTop.map((a) => Math.max(a.exp, a.imp)), 1);
  const monMax = Math.max(...model.monthly.flatMap((m) => [m.exp, m.imp]), 1);
  const mapRows = aggs.slice(0, 6);

  const metricLabel = metric === "imp" ? "수입액" : metric === "bal" ? "무역수지" : "수출액";

  return (
    <div className="lsgi-root">
      <style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />

      {/* HERO */}
      <section className="hero">
        <div className="glow" />
        <svg className="motif" viewBox="0 0 560 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="#2dd4bf">
            <rect x="60" y="120" width="150" height="150" rx="8" opacity="0.16" /><rect x="218" y="120" width="92" height="70" rx="6" opacity="0.20" /><rect x="218" y="198" width="92" height="72" rx="6" opacity="0.13" />
            <rect x="318" y="120" width="64" height="64" rx="6" opacity="0.22" /><rect x="318" y="192" width="64" height="40" rx="5" opacity="0.12" /><rect x="390" y="120" width="42" height="42" rx="5" opacity="0.17" /><rect x="390" y="170" width="42" height="26" rx="4" opacity="0.10" />
          </g>
          <g stroke="#2dd4bf" strokeWidth="1" opacity="0.30" fill="none"><path d="M135 270 C 230 320, 360 300, 470 250 S 540 150, 545 110" /></g>
          <g fill="#5eead4"><circle cx="470" cy="250" r="4" opacity="0.9" /><circle cx="545" cy="110" r="4" opacity="0.9" /></g>
        </svg>
        <div className="iwrap in">
          <span className="eyebrow">Industry Intelligence</span>
          <h1>산업 교역 동향</h1>
          <p>관세청 무역통계를 HS 산업 단위로 묶고, 산업 변화를 <b style={{ color: "#cbd5e6" }}>운송수단·장비·레인 수요</b>와 연결합니다. 실제 데이터가 있는 챕터만 표시합니다.</p>
          <div className="hpills">
            <span className="p"><span className="dot" style={{ background: "#2dd4bf" }} />기준 <b className="mono">{periodLabel}</b> 확정</span>
            <span className="p"><span className="dot" style={{ background: balance >= 0 ? "#16a34a" : "#dc2626" }} />무역수지 <b className="mono">{formatUSD(balance)}</b> {balance >= 0 ? "흑자" : "적자"}</span>
            <span className="p"><span className="dot" style={{ background: "#3b82f6" }} />표시 <b className="mono">{model.periodCount}</b>챕터</span>
          </div>
        </div>
      </section>

      {/* SHEET */}
      <div className="sheet"><div className="iwrap">
        <div className="bc"><Link to="/">홈</Link> <b>›</b> 인사이트 <b>›</b> 산업</div>

        {/* FILTERS */}
        <div className="filters">
          <div className="grp"><span className="k">구분</span><span className="seg">{(["exp", "imp", "bal"] as const).map((m) => <button key={m} type="button" className={metric === m ? "on" : ""} onClick={() => setMetric(m)}>{m === "exp" ? "수출액(USD)" : m === "imp" ? "수입액" : "무역수지"}</button>)}</span></div>
          <div className="meta"><DataMeta source="관세청 수출입무역통계" asOf={`${periodLabel} 확정`} cadence="월 1회" unit="USD · HS 챕터별" /></div>
        </div>

        {/* JUDGMENT */}
        <div className="judge">
          <div className="top">
            <div style={{ flex: 1, minWidth: 260 }}><div className="verdict">{verdict}</div><div className="ai">{detail}</div></div>
            <div className="jstamp">규칙 기반 요약 · 확정 {periodLabel}</div>
          </div>
          <div className="tiles">
            <div className="tile"><div className="k">총수출</div><div className="v mono">{formatUSD(totalExp)}</div><div className="d"><span className={`mono ${(model.totalExpYoY ?? 0) >= 0 ? "up" : "down"}`}>YoY {fmtPct(model.totalExpYoY)}</span></div></div>
            <div className="tile"><div className="k">무역수지</div><div className={`v mono ${balance >= 0 ? "up" : "down"}`}>{formatUSD(balance)}</div><div className="d"><span className={balance >= 0 ? "up" : "down"}>{balance >= 0 ? "흑자" : "적자"}</span></div><div className="gauge"><i style={{ width: `${totalExp + model.totalImp > 0 ? Math.round((totalExp / (totalExp + model.totalImp)) * 100) : 0}%`, background: balance >= 0 ? "var(--up)" : "var(--down)" }} /></div></div>
            <div className="tile"><div className="k">1위 산업 비중 (HS{top.chapter} {top.name})</div><div className="v mono">{topShare}%</div><div className="d"><span className="smu">단일 산업 의존</span></div><div className="gauge"><i style={{ width: `${topShare}%`, background: "var(--blue)" }} /></div></div>
            <div className="tile"><div className="k">최대 적자 산업 (HS{deficit.chapter})</div><div className={`v mono ${deficit.balance < 0 ? "down" : "up"}`}>{formatUSD(deficit.balance)}</div><div className="d"><span className="smu">{deficit.name}</span></div></div>
          </div>
        </div>

        {/* SIGNALS */}
        <div className="sect-h"><h2>이번 달 산업 시그널</h2><span className="chip">자동 탐지 · 급증·물류·수지</span></div>
        <div className="grid3">
          {signals.map((s, i) => {
            const yoy = yoyOf(s.a.chapter);
            const idx = idxOf(s.a.chapter);
            const fc = s.kind === "def" ? "fc-fl" : fcOf(idx?.change_pct ?? null);
            const spark = model.monthlyOf(s.a.chapter);
            const color = s.kind === "surge" ? "#16a34a" : s.kind === "def" ? "#dc2626" : "#d97706";
            return (
              <div className="sig" key={i}>
                <span className={`bd ${s.kind}`}>{s.bd}</span>
                <div className="nm">HS{s.a.chapter} {s.a.name} <span className={`yoy mono ${(yoy ?? 0) >= 0 ? "up" : "down"}`}>{s.kind === "def" ? formatUSD(s.a.balance) : fmtPct(yoy)}</span></div>
                <div className="val mono">{s.kind === "def" ? `수입 ${formatUSD(s.a.imp)}` : `수출 ${formatUSD(s.a.exp)}`} · 수출의 {totalExp > 0 ? Math.round((s.a.exp / totalExp) * 100) : 0}%</div>
                <div className="desc">{s.kind === "surge" ? <><b>{s.a.name} 수출 호조.</b> 산업 모멘텀이 해상·항공 수요로 연결되는 구간.</> : s.kind === "roro" ? <><b>{s.a.name} 물류 특성.</b> 전용 선복·장비 수요가 운임에 반영됩니다.</> : <><b>{s.a.name} 최대 적자.</b> 수입 중심으로 탱커·벌크 운임 변동성이 큰 구간.</>}</div>
                <div className="map">{s.modes.map((m, j) => <span key={j} className={`mode ${m.cls}`}>{m.t}</span>)}</div>
                <Spark vals={spark} color={color} />
                <div className="bridge"><span className="lane">연동 레인 <b>{s.lane}</b></span><span className={`fcast ${fc}`}>{idx ? `${idx.index_code} ${fcLabel(fc)}` : "운임 수집 중"}</span></div>
                <Link to="/rates" className="lk">레인·운임 보기 →</Link>
              </div>
            );
          })}
        </div>

        {/* MAPPING */}
        <div className="sect-h"><h2>산업 → 물류 매핑</h2><span className="chip">HS 산업 → 운송수단·장비 → 대표 레인 → 운임 추세</span></div>
        <div className="bridgewrap">
          <div style={{ overflowX: "auto" }}>
            <table className="btbl">
              <thead><tr><th>산업 (HS)</th><th>운송수단 · 장비</th><th>대표 레인</th><th className="r">연동 운임</th><th className="r">운임 추세</th></tr></thead>
              <tbody>
                {mapRows.map((a) => {
                  const idx = idxOf(a.chapter); const fc = fcOf(idx?.change_pct ?? null);
                  return (
                    <tr key={a.chapter}>
                      <td className="reg">HS{a.chapter} {a.name}<small>{formatUSD(a.exp)} · YoY {fmtPct(yoyOf(a.chapter))}</small></td>
                      <td>{modeOf(a.chapter).map((m, j) => <span key={j} className={`mode ${m.cls}`} style={{ marginRight: 4 }}>{m.t}</span>)}</td>
                      <td className="lane">{HS_LANE[a.chapter] ?? "부산 → 주요 노선"}</td>
                      <td className="r idx">{idx ? <>{idx.index_code} <small className="mono">{idx.latest_value != null ? idx.latest_value.toLocaleString() : "—"} · {fmtPct(idx.change_pct)}</small></> : <small className="smu">매핑 없음</small>}</td>
                      <td className="r"><span className={`fcast ${idx ? fc : "fc-fl"}`}>{idx ? fcLabel(fc) : "—"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="idxnote">산업별 대표 운송수단·장비는 일반화 매핑이며 화주·품목에 따라 달라질 수 있습니다. 운임지수는 freight_indices 실측(WoW), 교역액은 관세청 확정({periodLabel}). 운임 추세는 상관 관점 표시로 확정 전망이 아닙니다.</div>
        </div>

        {/* FLOW & STRUCTURE */}
        <div className="sect-h"><h2>수출 구조</h2><span className="chip">확정 · USD</span></div>
        <div className="two">
          <div className="card pad">
            <div className="ch-h"><span className="t">수출 vs 수입 — 상위 HS 챕터</span><span className="chip">상위 {dvTop.length}개</span></div>
            <div className="dv">
              {dvTop.map((a) => (
                <div className="r" key={a.chapter}>
                  <div className="imp"><i style={{ width: `${Math.round((a.imp / dvMax) * 100)}%`, ...(a.imp > a.exp ? { background: "#dc2626", opacity: 0.55 } : {}) }} /></div>
                  <div className="lbl">HS{a.chapter}</div>
                  <div className="exp"><i style={{ width: `${Math.round((a.exp / dvMax) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="legend"><span><i style={{ background: "#b7c6dd" }} />수입</span><span><i style={{ background: "#1864ab" }} />수출</span><span><i style={{ background: "#dc2626", opacity: 0.55 }} />수입&gt;수출(적자)</span></div>
          </div>
          <div className="card pad">
            <div className="ch-h"><span className="t">{metricLabel} 비중 (HS)</span><span className="chip">Top 5 + 기타</span></div>
            {donutTotal <= 0 ? <div style={{ padding: "30px 0", textAlign: "center", color: "var(--mute)", fontSize: 13 }}>데이터 수집 중</div> : (
              <div className="donut">
                <div className="ring" style={{ background: `conic-gradient(${donutStops})` }}><div className="ctr"><b className="mono">{formatUSD(donutTotal)}</b><span>{metricLabel} 합계</span></div></div>
                <div className="dleg">{donutSegs.map((d, i) => <div className="r" key={i}><span className="sw" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} /><span className="nm">{d.nm}</span><span className="vv mono">{formatUSD(d.v)}</span><span className="pc mono">{donutTotal > 0 ? `${Math.round((d.v / donutTotal) * 100)}%` : "—"}</span></div>)}</div>
              </div>
            )}
          </div>
        </div>

        {/* TREEMAP */}
        <div className="sect-h"><h2>HS 챕터 {metricLabel} 트리맵</h2><span className="chip">면적 = {metricLabel}</span></div>
        <div className="card pad">
          <div className="tree">
            {TM_TEMPLATE.filter((t) => t.rank < tmSorted.length).map((t) => {
              const x = tmSorted[t.rank];
              return (
                <div className={`tm${t.big ? "" : " s"}`} key={x.a.chapter} style={{ gridColumn: `span ${t.c}`, gridRow: `span ${t.r}`, background: TM_SHADES[t.rank] }}>
                  {t.big ? <><b>HS{x.a.chapter} {x.a.name}</b><span className="mono">{formatUSD(x.v)}{topShare && t.rank === 0 ? ` · ${topShare}%` : ""}</span></> : <b>HS{x.a.chapter} <span className="mono">{formatUSD(x.v)}</span></b>}
                </div>
              );
            })}
          </div>
        </div>

        {/* RANKING + SIDEBAR */}
        <div className="two" style={{ marginTop: 14, alignItems: "start" }}>
          <div className="card">
            <div className="sect-h" style={{ margin: 0, padding: "16px 18px 6px" }}><h2 style={{ fontSize: 16 }}>HS 챕터 랭킹</h2><span className="chip">운송특성 포함 · {model.periodCount}챕터</span></div>
            <div style={{ overflowX: "auto" }}>
              <table className="ttable">
                <thead><tr><th style={{ paddingLeft: 18 }}>순위 / 산업</th><th>운송특성</th><th className="r">수출</th><th className="r">무역수지</th></tr></thead>
                <tbody>
                  {aggs.slice(0, 12).map((a, i) => (
                    <tr key={a.chapter}>
                      <td style={{ paddingLeft: 18 }}><span className="rk">{i + 1}</span><span className="hsb">{a.chapter}</span>{a.name}</td>
                      <td><span className={`mode ${modeOf(a.chapter)[0].cls}`}>{modeOf(a.chapter)[0].t}</span></td>
                      <td className="r mono">{formatUSD(a.exp)}</td>
                      <td className={`r mono ${a.balance >= 0 ? "up" : "down"}`}>{formatUSD(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a className="more">전체 {model.periodCount}챕터 · 출처 관세청 확정</a>
          </div>

          <div className="side">
            <div className="card pad">
              <div className="sc-h">산업 흑자/적자 구조 <span className="chip">HS 챕터별</span></div>
              <div className="sgrp">흑자 견인</div>
              {surplusTop.length ? surplusTop.map((a) => <div className="bal" key={a.chapter}><span className="c">HS{a.chapter} {a.name}</span><span className="up mono">{formatUSD(a.balance)}</span></div>) : <div className="bal"><span className="smu">흑자 챕터 없음</span></div>}
              <div className="sgrp" style={{ marginTop: 10 }}>적자</div>
              {deficitTop.length ? deficitTop.map((a) => <div className="bal" key={a.chapter}><span className="c">HS{a.chapter} {a.name}</span><span className="down mono">{formatUSD(a.balance)}</span></div>) : <div className="bal"><span className="smu">적자 챕터 없음</span></div>}
            </div>

            <div className="card pad">
              <div className="sc-h">월별 교역 추이 <span className="chip">최근 {model.monthly.length}개월</span></div>
              {model.monthly.length < 2 ? <div style={{ padding: "20px 0", textAlign: "center", color: "var(--mute)", fontSize: 12.5 }}>월별 추이 수집 중</div> : (
                <svg viewBox="0 0 300 130" width="100%" preserveAspectRatio="xMidYMid meet" style={{ fontFamily: "Pretendard" }}>
                  <g stroke="#e6ebf2" strokeWidth="1"><line x1="6" y1="14" x2="294" y2="14" /><line x1="6" y1="56" x2="294" y2="56" /><line x1="6" y1="98" x2="294" y2="98" /></g>
                  {model.monthly.map((m, i) => {
                    const slot = 288 / model.monthly.length, cx = 6 + slot * i + slot / 2;
                    const eh = (m.exp / monMax) * 84, ih = (m.imp / monMax) * 84;
                    return (
                      <g key={m.p}>
                        <rect x={cx - 16} y={98 - eh} width="14" height={eh} rx="2" fill="#1864ab" />
                        <rect x={cx} y={98 - ih} width="14" height={ih} rx="2" fill="#b7c6dd" />
                        <text x={cx} y={114} textAnchor="middle" fontSize="8" fill="#828d9d">{m.p.slice(4, 6)}</text>
                      </g>
                    );
                  })}
                </svg>
              )}
              <div className="legend" style={{ marginTop: 4 }}><span><i style={{ background: "#1864ab" }} />수출</span><span><i style={{ background: "#b7c6dd" }} />수입</span></div>
            </div>

            <div className="card pad">
              <div className="sc-h">데이터 안내</div>
              <p className="note">출처: 관세청 수출입무역통계 · 기준 {periodLabel} 확정. <b>실제 데이터가 있는 챕터만</b> 표시됩니다. 운송수단·장비 매핑과 운임 연동·추세는 참고용 추정이며 관세청 확정 통계가 아닙니다.</p>
            </div>
          </div>
        </div>
      </div></div>

      <HomeFooter />
    </div>
  );
}
