// LogisightArticle.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 뉴스 기사 상세 — 드롭인 컴포넌트 (무역/산업/뉴스/리포트와 동일 패턴)
// · 읽기 좋은 760px 칼럼 + 본문 17px/1.78
// · 데이터에 있을 때만 표시(없으면 자동 숨김): summary_points(핵심 요약), impact(영향 칩),
//   tags, image_url, source_origin/url, related
// · 본문: contentNode(우선, 마크다운 등 React 노드) → contentHtml(HTML 문자열) → body(평문/배열)
// · 공통 헤더/푸터는 HomeNav·HomeFooter 를 내부에서 렌더(.lsg-root 밖, /news·/reports 와 정렬)
// · 자체 포함 스타일(.lsg-root), 외부 CSS·Tailwind 불필요
//
// 사용:
//   <LogisightArticle article={a} related={rel} renderRelatedLink={...} />
//   // a: maritime_news 1행 + (선택) summary_points/impact 등 인텔리전스 필드
// prop 없이도 동작(샘플 폴백).
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";

export type ArticleImpact = { label: string; dir?: "up" | "down" };
export type Article = {
  id?: string;
  category?: string | null;
  title: string;
  deck?: string | null; // 부제/요약
  source?: string | null;
  published_at?: string | null;
  registered_at?: string | null; // Logisight 등록일(포맷됨) — 있으면 상단을 Logisight 브랜드 바이라인으로
  read_minutes?: number | null;
  image_url?: string | null;
  image_caption?: string | null;
  contentNode?: ReactNode; // 본문 React 노드(마크다운 렌더 등, 우선)
  contentHtml?: string | null; // 본문 HTML
  body?: string | string[] | null; // 본문 평문/배열(대안). 첫 문단=lead
  source_origin?: string | null; // 'WorldACD Market Data'
  source_url?: string | null;
  tags?: string[] | null;
  summary_points?: string[] | null; // 핵심 요약(있을 때만)
  impact?: ArticleImpact[] | null; // 영향 칩(있을 때만)
  impact_note?: string | null;
  show_placeholder?: boolean; // 이미지 없을 때 데모 플레이스홀더 표시
};
export type RelatedArticle = {
  id?: string;
  category?: string | null;
  title: string;
  source?: string | null;
  published_at?: string | null;
  href?: string;
};

type Props = {
  article?: Article;
  related?: RelatedArticle[];
  renderRelatedLink?: (item: RelatedArticle, children: ReactNode, className: string) => ReactNode;
  breadcrumb?: ReactNode; // 기본 "홈 › 뉴스 › {category}" 대신 커스텀 breadcrumb(예: 브리핑)
  // 하단 레포트 유도 CTA(뉴스 기사에만 전달). 있으면 공유바 뉴스레터 문구를 대체.
  reportCta?: { heading: string; body: string; buttonLabel: string };
};

const FB_ARTICLE: Article = {
  category: "항공",
  title: "항공화물 물량 9% 급감…운임은 2% 반등",
  deck: "WorldACD 주간 동향에 따르면 5월 25~31일 연휴로 물동량은 감소했으나 운임은 유지됨. 아시아발 노선 운임이 강세를 보이며 주요 노선에서 안정적 가격이 유지됐다.",
  source: "Air Freight News",
  published_at: "2026.06.24",
  read_minutes: 4,
  image_url: null,
  image_caption: "Air Cargo Market Trends — 최근 5주 · 출처: Air Freight News",
  show_placeholder: true,
  body: [
    "22주차(5월 25~31일) 글로벌 항공화물 유상중량 기준 물량이 전주 대비 9% 감소한 것으로 나타났다. 성령강림절·미국 현충일 등 공휴일이 집중된 영향으로 분석되며, 지난해 동기 8% 감소와 유사한 수준이다.",
    "지역별로는 모든 권역에서 물량이 줄었다. 아시아태평양과 중남미가 각각 3% 감소한 데 비해 중동·남아시아(MESA)는 21% 급감하며 가장 큰 낙폭을 보였다. 두바이·방글라데시발이 각각 25%, 45% 줄어든 영향이 컸다.",
    "운임은 물량 둔화에도 상승세를 이어갔다. 22주차 글로벌 평균 항공운임은 kg당 3.29달러로 전주 대비 2% 올랐고, 전년 동기 대비로는 35% 높은 수준이다. 아프리카(+9%)·MESA(+4%)·아시아태평양(+1%)이 상승을 주도한 반면 미주·유럽은 소폭 하락했다.",
    "시장에서는 MESA 지역이 연초 대비 17% 오르며 전 권역 중 가장 큰 운임 상승을 견인했다고 분석했다.",
  ],
  source_origin: "WorldACD Market Data",
  source_url: "#",
  tags: ["항공화물", "WorldACD", "운임", "MESA"],
  summary_points: [
    "22주차(5.25–31) 글로벌 항공화물 물량 전주比 −9% — 공휴일 영향, 전 권역 감소.",
    "중동·남아시아(MESA) −21%로 최대 낙폭, 아시아태평양·중남미는 각 −3%.",
    "물량 둔화에도 평균 운임 +2%(kg당 $3.29), 전년比 +35% — MESA가 상승 견인.",
  ],
  impact: [
    { label: "아시아발 운임 강세", dir: "up" },
    { label: "단기 물량 둔화", dir: "down" },
  ],
  impact_note: "물류 영향: 아시아발 노선 운임 강세 지속 · 단기 물량은 공휴일 일시 둔화",
};
const FB_RELATED: RelatedArticle[] = [
  {
    category: "항공",
    title: "롱비치항 물동량 31.7% 급증…서안 환적 수요 견인",
    source: "Asia Cargo News",
    published_at: "2026.06.24",
  },
  {
    category: "항공",
    title: "CEVA, 아태–미주 항공화물 증편…베트남·중국발 전세기 투입",
    source: "Air Freight News",
    published_at: "2026.06.24",
  },
  {
    category: "항공",
    title: "Awery, 오리엔탈 스카이를 첫 중국계 GSSA로 플랫폼 연동",
    source: "Air Cargo Week",
    published_at: "2026.06.24",
  },
];

const STYLE = `
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
.lsg-root{--bg:#070b16;--lineD:#78a0cd1c;--dmut:#93a1b7;--dfaint:#5d6b80;--teal:#2dd4bf;--teal3:#14b8a6;
  --ink:#16202e;--read:#33404f;--body:#54606f;--mute:#828d9d;--line:#e3e8ef;--line2:#eef1f6;--card:#f7f9fc;--teal2:#0d9488;--blue:#1864ab;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:#fff;color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.lsg-root *{box-sizing:border-box;margin:0;padding:0}
.lsg-root .mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsg-root a{color:inherit;text-decoration:none}
.lsg-root button{font:inherit;cursor:pointer;background:none;border:none;color:inherit}
.lsg-root .read{max-width:760px;margin:0 auto;padding:0 24px}
/* 공유 Wordmark(HomeNav·HomeFooter)의 's'는 .lsg-root 밖이라 전역 규칙이 필요하다. */
.lsg-ls{background:linear-gradient(95deg,#fff 35%,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}

.lsg-root .bc{padding-top:22px;font-size:12px;color:var(--mute)}.lsg-root .bc b{color:var(--body);font-weight:500}
.lsg-root .bc a{color:var(--body)}.lsg-root .bc a:hover{color:var(--ink);text-decoration:underline}
.lsg-root .cat{display:inline-block;margin-top:18px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#fff;background:#0f1b33;border-radius:6px;padding:4px 10px}
.lsg-root h1{margin-top:14px;font-size:clamp(28px,4.4vw,40px);font-weight:800;line-height:1.18;letter-spacing:-.035em;color:var(--ink)}
.lsg-root .deck{margin-top:14px;font-size:18px;line-height:1.6;color:var(--body);font-weight:400}
.lsg-root .impact{margin-top:14px;display:flex;flex-wrap:wrap;gap:7px}
.lsg-root .ic{font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px}
.lsg-root .ic-up{background:#fdf0e3;color:#b45309}.lsg-root .ic-dn{background:#eaf2fb;color:#1d4ed8}.lsg-root .ic-neutral{background:#eef1f6;color:#54606f}

.lsg-root .meta{margin-top:18px;display:flex;align-items:center;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.lsg-root .src{display:flex;align-items:center;gap:9px}
.lsg-root .src .av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#1864ab);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
.lsg-root .src .nm{font-size:13px;font-weight:700;color:var(--ink)}.lsg-root .src .dt{font-size:12px;color:var(--mute)}
.lsg-root .share{margin-left:auto;display:flex;gap:7px}
.lsg-root .ib{width:34px;height:34px;border:1px solid var(--line);border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--body);background:#fff}
.lsg-root .ib:hover{background:var(--card);color:var(--ink)}.lsg-root .ib svg{width:16px;height:16px}

.lsg-root .tldr{margin:22px 0;background:#f0fdfa;border:1px solid #ccf0ea;border-left:3px solid #0d9488;border-radius:12px;padding:16px 18px}
.lsg-root .tldr .lbl{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.12em;color:#0a6f6a}
.lsg-root .tldr ul{list-style:none;margin-top:9px;display:flex;flex-direction:column;gap:7px}
.lsg-root .tldr li{position:relative;padding-left:16px;font-size:14px;line-height:1.55;color:var(--ink)}
.lsg-root .tldr li::before{content:"";position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:#0d9488}
.lsg-root .tldr .ai{margin-top:11px;padding-top:9px;border-top:1px dashed #cdeee8;font-size:11.5px;color:#0a6f6a}

.lsg-root figure{margin:8px 0 4px}
.lsg-root figure img{width:100%;border-radius:12px;border:1px solid var(--line);display:block}
.lsg-root .imgph{position:relative;border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,#fbfcfe,#f1f4f9);overflow:hidden;aspect-ratio:16/11;display:flex;align-items:center;justify-content:center}
.lsg-root .imgph svg{width:62%;opacity:.5}
.lsg-root .imgph .tag{position:absolute;top:12px;left:12px;font-size:10px;font-weight:700;color:#0a5da8;background:#e6f0fb;border:1px solid #cde0f6;border-radius:6px;padding:3px 8px}
.lsg-root figcaption{margin-top:8px;font-size:11.5px;color:var(--mute)}

.lsg-root .article{margin-top:22px;font-size:17px;line-height:1.78;color:var(--read)}
.lsg-root .article p{margin-bottom:20px}
.lsg-root .article p.lead{font-size:18.5px;color:var(--ink);font-weight:500;line-height:1.7}
.lsg-root .article b,.lsg-root .article strong{color:var(--ink)}
.lsg-root .article h2,.lsg-root .article h3{color:var(--ink);font-weight:800;margin:26px 0 10px;letter-spacing:-.02em}
.lsg-root .article h2{font-size:21px}.lsg-root .article h3{font-size:18px}
.lsg-root .article a{color:var(--blue);font-weight:600;text-decoration:underline;text-underline-offset:2px}
.lsg-root .article ul,.lsg-root .article ol{margin:0 0 20px 1.2em}
.lsg-root .article li{margin-bottom:6px}
.lsg-root .article img{max-width:100%;height:auto;display:block;border-radius:10px;border:1px solid var(--line);margin:8px 0}
.lsg-root .article blockquote{margin:0 0 20px;padding-left:14px;border-left:3px solid var(--line);color:var(--body)}

.lsg-root .srcblk{margin-top:8px;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:10px;font-size:13px;color:var(--body)}
.lsg-root .srcblk .k{color:var(--mute);font-size:11.5px}
.lsg-root .srcblk a{color:var(--blue);font-weight:700}
.lsg-root .tags{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px}
.lsg-root .tags a{font-size:12px;font-weight:600;color:var(--teal2);background:#ecfdf5;border:1px solid #c7ead6;border-radius:999px;padding:4px 11px}

.lsg-root .reportcta{margin-top:26px;padding:22px;border-radius:14px;background:linear-gradient(135deg,#0e1626,#0c2a2a);border:1px solid #2dd4bf47}
.lsg-root .reportcta .rc-h{font-size:17px;font-weight:800;letter-spacing:-.02em;color:#fff}
.lsg-root .reportcta .rc-b{margin-top:8px;font-size:14px;line-height:1.6;color:#9fb2c4}
.lsg-root .reportcta .rbtn{display:inline-flex;align-items:center;gap:6px;margin-top:16px;background:#2dd4bf;color:#04231f;font-weight:700;font-size:14px;border-radius:9px;padding:11px 18px}
.lsg-root .reportcta .rbtn:hover{background:#5eead4}

.lsg-root .sharebar{margin-top:22px;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.lsg-root .sharebar .t{font-size:13.5px;font-weight:700;color:var(--ink)}
.lsg-root .sharebar .t span{display:block;font-size:12px;font-weight:400;color:var(--mute);margin-top:2px}
.lsg-root .sharebar .b{display:flex;gap:8px}

.lsg-root .rel-h{margin:34px 0 14px;font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsg-root .rel{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:820px){.lsg-root .rel{grid-template-columns:1fr}}
.lsg-root .rc{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:15px 16px}
.lsg-root .rc:hover{box-shadow:0 8px 22px -20px rgba(13,33,60,.5)}
.lsg-root .rc .cb{font-size:10px;font-weight:700;color:#fff;background:#0f1b33;border-radius:5px;padding:2px 7px}
.lsg-root .rc .ti{margin-top:10px;font-size:14.5px;font-weight:700;line-height:1.4;color:var(--ink)}
.lsg-root .rc .mt{margin-top:9px;font-size:11.5px;color:var(--mute)}
.lsg-root .read{padding-bottom:40px}
@media(prefers-reduced-motion:reduce){.lsg-root *{animation:none!important}}
`;

const IconShare = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);
const IconLink = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);

function initials(name?: string | null) {
  if (!name) return "•";
  const w = name.trim().split(/\s+/);
  if (/[A-Za-z]/.test(name) && w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return name.slice(0, 2);
}
function toParagraphs(body?: string | string[] | null): string[] {
  if (!body) return [];
  if (Array.isArray(body)) return body.filter(Boolean);
  return body
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function LogisightArticle({
  article = FB_ARTICLE,
  related = FB_RELATED,
  renderRelatedLink,
  breadcrumb,
  reportCta,
}: Props) {
  const a = article;
  const paras = toParagraphs(a.body);
  const readBit = a.read_minutes ? `읽는 시간 약 ${a.read_minutes}분` : null;
  // registered_at 있으면 Logisight 등록일 중심 바이라인, 아니면 기존 출처+발행일.
  const brand = Boolean(a.registered_at);
  const bylineName = brand ? "Logisight" : (a.source ?? "출처");
  const bylineDate = brand
    ? [`등록 ${a.registered_at}`, readBit].filter(Boolean).join(" · ")
    : [a.published_at, readBit].filter(Boolean).join(" · ");

  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 접근 거부 — 무시 */
    }
  };

  const shareArticle = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: a.title, url: window.location.href });
      } catch {
        /* 사용자 취소 등 — 무시 */
      }
      return;
    }
    // Web Share 미지원 → 링크 복사로 대체
    void copyLink();
  };

  return (
    // 다크 래퍼: 반투명 HomeNav(bg #070b16cc) 뒤 배경을 홈과 동일하게 어둡게 둬 슬레이트색 번짐 방지.
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="news" />

      <div className="lsg-root">
        <style>{STYLE}</style>

        <article>
          <div className="read">
            <div className="bc">
              {breadcrumb ?? (
                <>
                  <Link to="/">홈</Link> <b>›</b> <Link to="/news">뉴스</Link>
                  {a.category ? (
                    <>
                      {" "}
                      <b>›</b>{" "}
                      <Link to="/news" search={{ cat: a.category }}>
                        {a.category}
                      </Link>
                    </>
                  ) : null}
                </>
              )}
            </div>
            {a.category ? <span className="cat">{a.category}</span> : null}
            <h1>{a.title}</h1>
            {a.deck ? <p className="deck">{a.deck}</p> : null}

            {a.impact && a.impact.length > 0 && (
              <div className="impact">
                {a.impact.map((c, i) => (
                  <span
                    key={i}
                    className={`ic ${c.dir === "up" ? "ic-up" : c.dir === "down" ? "ic-dn" : "ic-neutral"}`}
                  >
                    {c.dir === "up" ? "▲ " : c.dir === "down" ? "▼ " : ""}
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            <div className="meta">
              <div className="src">
                <span className="av">{brand ? "L" : initials(a.source)}</span>
                <div>
                  <div className="nm">{bylineName}</div>
                  {bylineDate ? <div className="dt mono">{bylineDate}</div> : null}
                </div>
              </div>
              <div className="share">
                <button type="button" className="ib" title="공유" onClick={shareArticle}>
                  <IconShare />
                </button>
                <button
                  type="button"
                  className="ib"
                  title={copied ? "복사됨!" : "링크 복사"}
                  onClick={copyLink}
                >
                  <IconLink />
                </button>
              </div>
            </div>

            {a.summary_points && a.summary_points.length > 0 && (
              <div className="tldr">
                <div className="lbl">⚡ 핵심 요약</div>
                <ul>
                  {a.summary_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                {a.impact_note ? <div className="ai">{a.impact_note}</div> : null}
              </div>
            )}

            {a.image_url ? (
              <figure>
                <img src={a.image_url} alt="" />
                {a.image_caption ? <figcaption>{a.image_caption}</figcaption> : null}
              </figure>
            ) : a.show_placeholder ? (
              <figure>
                <div className="imgph">
                  <span className="tag">출처 차트</span>
                  <svg
                    viewBox="0 0 400 260"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <g fill="#c3cee0">
                      <rect x="40" y="150" width="44" height="70" rx="3" />
                      <rect x="110" y="135" width="44" height="85" rx="3" />
                      <rect x="180" y="140" width="44" height="80" rx="3" />
                      <rect x="250" y="130" width="44" height="90" rx="3" />
                      <rect x="320" y="120" width="44" height="100" rx="3" />
                    </g>
                    <polyline
                      points="62,120 132,110 202,114 272,100 342,96"
                      stroke="#1864ab"
                      strokeWidth="3"
                      fill="none"
                    />
                    <polyline
                      points="62,150 132,144 202,148 272,140 342,138"
                      stroke="#5b9bd5"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5 4"
                    />
                    <g fill="#1864ab">
                      <circle cx="62" cy="120" r="4" />
                      <circle cx="132" cy="110" r="4" />
                      <circle cx="202" cy="114" r="4" />
                      <circle cx="272" cy="100" r="4" />
                      <circle cx="342" cy="96" r="4" />
                    </g>
                  </svg>
                </div>
                {a.image_caption ? <figcaption>{a.image_caption}</figcaption> : null}
              </figure>
            ) : null}

            {a.contentNode ? (
              <div className="article">{a.contentNode}</div>
            ) : a.contentHtml ? (
              <div className="article" dangerouslySetInnerHTML={{ __html: a.contentHtml }} />
            ) : (
              <div className="article">
                {paras.map((p, i) => (
                  <p key={i} className={i === 0 ? "lead" : undefined}>
                    {p}
                  </p>
                ))}
              </div>
            )}

            {(a.source_origin || a.source_url) && (
              <div className="srcblk">
                <span className="k">출처</span>
                {a.source_origin ? ` · ${a.source_origin}` : ""}
                {a.source_url ? (
                  <>
                    {" "}
                    · 원문 <a href={a.source_url}>{a.source ?? "원문"} →</a>
                  </>
                ) : null}
              </div>
            )}

            {a.tags && a.tags.length > 0 && (
              <div className="tags">
                {a.tags.map((t, i) => (
                  <a key={i} href="#">
                    # {t}
                  </a>
                ))}
              </div>
            )}

            {reportCta && (
              <div className="reportcta">
                <div className="rc-h">{reportCta.heading}</div>
                <p className="rc-b">{reportCta.body}</p>
                <Link to="/reports" className="rbtn">
                  {reportCta.buttonLabel} →
                </Link>
              </div>
            )}

            <div className="sharebar">
              <div className="t">
                {reportCta ? (
                  "이 기사 공유하기"
                ) : (
                  <>
                    이 기사가 유용했나요?<span>매주 핵심만 추린 물류 브리핑을 받아보세요.</span>
                  </>
                )}
              </div>
              <div className="b">
                <button type="button" className="ib" title="공유" onClick={shareArticle}>
                  <IconShare />
                </button>
                <button
                  type="button"
                  className="ib"
                  title={copied ? "복사됨!" : "링크 복사"}
                  onClick={copyLink}
                >
                  <IconLink />
                </button>
              </div>
            </div>

            {related && related.length > 0 && (
              <>
                <div className="rel-h">관련 기사</div>
                <div className="rel">
                  {related.map((r, i) => {
                    const inner = (
                      <>
                        {r.category ? <span className="cb">{r.category}</span> : null}
                        <div className="ti">{r.title}</div>
                        <div className="mt mono">
                          {[r.source, r.published_at].filter(Boolean).join(" · ")}
                        </div>
                      </>
                    );
                    return renderRelatedLink ? (
                      <Fragment key={r.id ?? i}>{renderRelatedLink(r, inner, "rc")}</Fragment>
                    ) : (
                      <a className="rc" key={r.id ?? i} href={r.href ?? "#"}>
                        {inner}
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </article>
      </div>

      <HomeFooter />
    </div>
  );
}
