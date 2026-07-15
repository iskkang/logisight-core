// LogisightNewsTop.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 뉴스 페이지 상단 — 드롭인 컴포넌트 (무역/산업과 동일 패턴)
// · 슬림 "마켓 데스크 · 날짜" + 기간 세그먼트 + 카테고리 탭
// · "이번 주 주목"(자동 선정) 3-상태: pickLoading→스켈레톤 / pick 있음 / 없음→폴백
// · 자체 포함 스타일(.lsgn-root), 외부 CSS·Tailwind 불필요. prop 제어(없으면 내부 state).
// · 공통 레이아웃에 통일 헤더(HomeNav)가 이미 있으면 showNav={false} 로 둔다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { ReactNode } from "react";

export type Pick = {
  category: string; // "해상 · 중동"
  why: string; // 선정 근거 "최다 조회 · 운임 영향"
  headline: string;
  source: string;
  date: string; // "2026.06.18"
  views?: string; // "4.2k"
  href?: string;
  imageUrl?: string; // 기사 대표 이미지(없으면 그라데이션 플레이스홀더)
  periodLabel?: string; // "06.16 – 06.22"
  internal?: boolean; // 내부 기사면 라우터 Link, 외부면 새 탭
};

type Props = {
  showNav?: boolean;
  deskTitle?: string;
  intro?: string;
  date?: string;
  category?: string;
  onCategoryChange?: (c: string) => void;
  period?: string;
  onPeriodChange?: (p: string) => void;
  pick?: Pick | null;
  pickLoading?: boolean;
  noteText?: string;
  renderPickLink?: (pick: Pick, children: ReactNode, className: string) => ReactNode;
};

const CATEGORIES = ["전체", "해상", "항공", "철도", "물류", "무역"];
const PERIODS = ["전체", "오늘", "이번 주", "이번 달"];
const NAV = [{ l: "홈" }, { l: "뉴스", on: true }, { l: "인사이트" }];

const FALLBACK_PICK: Pick = {
  category: "수집 중",
  why: "선정 데이터 준비 중",
  headline: "이번 주 주목 기사를 집계하는 중입니다",
  source: "Logisight",
  date: "—",
  periodLabel: "",
};

const STYLE = `
.lsgn-root{--bg:#070b16;--lineD:#78a0cd1c;--dmut:#93a1b7;--teal:#2dd4bf;
  --ink:#1a2433;--body:#4a5568;--mute:#8a93a3;--line:#e3e8ef;--card:#f7f9fc;--teal2:#0d9488;--blue:#1864ab;--amber:#b45309;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:#fff;color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsgn-root *{box-sizing:border-box;margin:0;padding:0}
.lsgn-root .mono{font-feature-settings:"tnum" 1;letter-spacing:0}
/* 본문 편집 영역(max-w-[1280px] px-4 lg:px-6)과 좌우 정렬을 맞춘다. */
.lsgn-root .wrap{max-width:1280px;margin:0 auto;padding:0 16px}
@media(min-width:1024px){.lsgn-root .wrap{padding:0 24px}}
.lsgn-root a{color:inherit;text-decoration:none}
.lsgn-root button{font:inherit;background:none;border:none;cursor:pointer;color:inherit}
/* 공유 Wordmark(HomeNav·HomeFooter)의 's'는 .lsgn-root 밖이라 전역 규칙이 필요하다. */
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}

.lsgn-root .nav{position:sticky;top:0;z-index:50;background:#070b16d1;backdrop-filter:blur(14px) saturate(1.5);border-bottom:1px solid var(--lineD)}
.lsgn-root .nav .row{display:flex;align-items:center;gap:36px;height:60px}
.lsgn-root .brand{display:inline-flex;align-items:center;gap:9px;font-size:18px;font-weight:800;letter-spacing:-.02em}
.lsgn-root .brand .mk{width:9px;height:18px;border-radius:2px;transform:skewX(-12deg);background:linear-gradient(180deg,#2dd4bf,#0ea5a0)}
.lsgn-root .brand .b1{color:#fff}.lsgn-root .brand .b2{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}.lsgn-root .brand .b3{color:#2dd4bf}
.lsgn-root .nav nav{display:flex;gap:24px;font-size:14px;font-weight:500;color:var(--dmut)}
.lsgn-root .nav nav a{padding:4px 0;position:relative}.lsgn-root .nav nav a:hover{color:#fff}.lsgn-root .nav nav a.on{color:#fff}
.lsgn-root .nav nav a.on::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;border-radius:2px;background:var(--teal)}

.lsgn-root .bc{padding:12px 0 0;font-size:12px;color:var(--mute)}.lsgn-root .bc b{color:var(--body);font-weight:500}
.lsgn-root .intro{margin:0 0 14px;font-size:14px;line-height:1.55;color:var(--body);max-width:680px}

.lsgn-root .desk{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px 0 12px}
.lsgn-root .desk .l{display:flex;align-items:baseline;gap:9px}
.lsgn-root .desk .dt{font-size:17px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsgn-root .desk .sep{color:#cdd4de}
.lsgn-root .desk .day{font-size:12.5px;color:var(--mute)}
.lsgn-root .period{display:flex;align-items:center;gap:9px}
.lsgn-root .period .pk{font-size:11.5px;color:var(--mute)}
.lsgn-root .seg{display:flex;gap:2px;background:#eef1f6;border:1px solid var(--line);border-radius:9px;padding:3px}
.lsgn-root .seg button{font-size:12.5px;font-weight:600;color:var(--body);padding:5px 11px;border-radius:7px;white-space:nowrap}
.lsgn-root .seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(16,24,40,.07)}

.lsgn-root .tabs{display:flex;gap:6px;padding:0 0 12px;border-bottom:1px solid var(--line);overflow-x:auto}
.lsgn-root .tabs button{font-size:13px;font-weight:600;color:var(--body);padding:6px 13px;border-radius:8px;white-space:nowrap}
.lsgn-root .tabs button.on{background:#0f1b33;color:#fff}

.lsgn-root .pick{margin:16px 0 8px}
.lsgn-root .pick .ph-h{display:flex;align-items:center;gap:9px;margin-bottom:9px;flex-wrap:wrap}
.lsgn-root .pick .ph-h .ey{font-size:10.5px;font-weight:700;letter-spacing:.2em;color:var(--teal2)}
.lsgn-root .pick .ph-h .ttl{font-size:14px;font-weight:800;color:var(--ink)}
.lsgn-root .pick .ph-h .auto{display:inline-flex;align-items:center;gap:5px;background:#ecfdf5;color:#0d9488;border:1px solid #c7ead6;font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 8px}
.lsgn-root .pick .ph-h .per{margin-left:auto;font-size:11px;color:var(--mute)}

.lsgn-root .feat{display:grid;grid-template-columns:200px 1fr;min-height:124px;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:#fff;box-shadow:0 8px 22px -20px rgba(13,33,60,.45)}
@media(max-width:560px){.lsgn-root .feat{grid-template-columns:104px 1fr}.lsgn-root .feat h2{font-size:16px}}
.lsgn-root .feat .ph{position:relative;background:radial-gradient(120% 120% at 22% 12%,#16315b,#0c1d3a 62%,#0a1228);overflow:hidden}
.lsgn-root .feat .ph img{width:100%;height:100%;object-fit:cover;display:block}
.lsgn-root .feat .ph svg{position:absolute;inset:0;width:100%;height:100%;opacity:.5}
.lsgn-root .feat .ph .rib{position:absolute;top:10px;left:10px;background:#0f1b33cc;color:#fff;font-size:9.5px;font-weight:700;letter-spacing:.05em;border-radius:5px;padding:3px 7px;border:1px solid #ffffff22}
.lsgn-root .feat .bd{padding:13px 17px;display:flex;flex-direction:column;justify-content:center}
.lsgn-root .feat .tags{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px}
.lsgn-root .feat .cat{font-size:10px;font-weight:700;color:var(--blue);background:#eaf2fb;border-radius:5px;padding:2px 7px}
.lsgn-root .feat .why{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--amber);background:#fdf0e3;border-radius:5px;padding:2px 7px}
.lsgn-root .feat h2{font-size:20px;font-weight:800;line-height:1.28;letter-spacing:-.022em;color:var(--ink)}
.lsgn-root .feat .meta{margin-top:9px;display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--mute)}
.lsgn-root .feat .meta b{color:var(--body);font-weight:600}.lsgn-root .feat .meta .read{margin-left:auto;color:var(--blue);font-weight:700}
.lsgn-root .pick .note{margin-top:8px;font-size:11px;color:var(--mute)}

.lsgn-root .sk{height:13px;border-radius:5px;background:linear-gradient(90deg,#e9edf3,#f3f6fa,#e9edf3);background-size:200% 100%;animation:lsgnsh 1.2s infinite}
@keyframes lsgnsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.lsgn-root *{animation:none!important}}
`;

function Wordmark() {
  return (
    <a href="#" className="brand">
      <span className="mk" />
      <span><span className="b1">Logi</span><span className="b2">s</span><span className="b3">ight</span></span>
    </a>
  );
}

function Placeholder() {
  return (
    <>
      <svg viewBox="0 0 220 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g opacity="0.5"><path d="M0 96 C 50 84, 84 106, 130 92 S 200 78, 220 86" stroke="#2dd4bf" strokeWidth="1.2" fill="none" /></g>
        <g>
          <rect x="64" y="58" width="30" height="20" rx="2" fill="#2dd4bf" opacity="0.55" />
          <rect x="96" y="58" width="30" height="20" rx="2" fill="#5eead4" opacity="0.45" />
          <rect x="128" y="58" width="30" height="20" rx="2" fill="#2dd4bf" opacity="0.38" />
          <rect x="80" y="36" width="30" height="20" rx="2" fill="#5eead4" opacity="0.5" />
          <rect x="112" y="36" width="30" height="20" rx="2" fill="#2dd4bf" opacity="0.34" />
        </g>
      </svg>
      <span className="rib">REPORT</span>
    </>
  );
}

export default function LogisightNewsTop({
  showNav = true,
  deskTitle = "마켓 데스크",
  intro,
  date = "",
  category,
  onCategoryChange,
  period,
  onPeriodChange,
  pick = null,
  pickLoading = false,
  noteText = "조회수·언급량·물류 영향도를 종합해 매주 자동 선정합니다.",
  renderPickLink,
}: Props) {
  const [catState, setCatState] = useState(CATEGORIES[0]);
  const [perState, setPerState] = useState(PERIODS[0]);
  const cat = category ?? catState;
  const per = period ?? perState;
  const setCat = (c: string) => (onCategoryChange ? onCategoryChange(c) : setCatState(c));
  const setPer = (p: string) => (onPeriodChange ? onPeriodChange(p) : setPerState(p));

  const p = pick ?? FALLBACK_PICK;

  return (
    <div className="lsgn-root">
      <style>{STYLE}</style>

      {showNav && (
        <header className="nav"><div className="wrap row">
          <Wordmark />
          <nav>{NAV.map((n) => <a key={n.l} href="#" className={n.on ? "on" : undefined}>{n.l}</a>)}</nav>
        </div></header>
      )}

      <div className="wrap">
        <div className="bc">홈 <b>›</b> 뉴스</div>

        {intro ? <p className="intro">{intro}</p> : null}

        {/* 슬림 헤더 + 기간 세그먼트 */}
        <div className="desk">
          <div className="l">
            <span className="dt">{deskTitle}</span>
            {date ? <><span className="sep">·</span><span className="day mono">{date}</span></> : null}
          </div>
          <div className="period">
            <span className="pk">기간</span>
            <span className="seg">
              {PERIODS.map((x) => <button key={x} className={x === per ? "on" : undefined} onClick={() => setPer(x)}>{x}</button>)}
            </span>
          </div>
        </div>

        {/* 카테고리 탭 */}
        <div className="tabs">
          {CATEGORIES.map((x) => <button key={x} className={x === cat ? "on" : undefined} onClick={() => setCat(x)}>{x}</button>)}
        </div>

        {/* 이번 주 주목 (자동 선정) */}
        <section className="pick">
          <div className="ph-h">
            <span className="ey">WEEKLY PICK</span>
            <span className="ttl">이번 주 주목</span>
            <span className="auto">⚡ 자동 선정</span>
            <span className="per mono">{p.periodLabel ?? ""}</span>
          </div>

          <article className="feat">
            <div className="ph">
              {pickLoading ? null : p.imageUrl ? <img src={p.imageUrl} alt="" /> : <Placeholder />}
            </div>
            <div className="bd">
              {pickLoading ? (
                <>
                  <div className="sk" style={{ width: "38%", height: 11 }} />
                  <div className="sk" style={{ width: "85%", marginTop: 10, height: 18 }} />
                  <div className="sk" style={{ width: "55%", marginTop: 9, height: 11 }} />
                </>
              ) : (
                <>
                  <div className="tags">
                    <span className="cat">{p.category}</span>
                    <span className="why">⚡ {p.why}</span>
                  </div>
                  <h2>{p.headline}</h2>
                  <div className="meta">
                    <b>{p.source}</b> · {p.date}{p.views ? ` · 조회 ${p.views}` : ""}
                    {pick && renderPickLink ? (
                      renderPickLink(p, "읽기 →", "read")
                    ) : (
                      <a href={p.href ?? "#"} className="read">읽기 →</a>
                    )}
                  </div>
                </>
              )}
            </div>
          </article>

          <div className="note">{noteText}</div>
        </section>
      </div>
    </div>
  );
}
