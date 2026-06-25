// LogisightEurasia.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 유라시아 코리도어 — 리드 뷰 드롭인 컴포넌트 (Logisight 패턴)
// · 종합 판단(계산식 팩트 요약 + 4타일) + 코리도어 헬스 표 + 데이터 구동 스키매틱 + 소스 상태
// · '추세' 컬럼 제거(대응 데이터 없음). TCR 0행이면 "수집 중".
// · 보존 모드(집계 지연 지수 / 수동 이슈 등)는 children으로 시트 아래에 렌더.
// · 데이터는 operational TCR 레코드(source #1)에서 매핑.
// · 자체 포함 스타일(.lsg-root). 공통 레이아웃 사용 시 showNav={false} + 푸터 중복 정리.
//   - 공통 레이아웃에선 외부에서 HomeNav/InsightSubNav/HomeFooter로 감싼다(eurasia.tsx 참고).
//   - children(보존 모드, Tailwind/proto Kit)이 .slot에 들어가므로 전역 리셋은 box-sizing만,
//     --card/--ink는 .slot에서 앱 토큰으로 복원해 Kit 스타일 충돌을 막는다.
//
// 사용:
//   <LogisightEurasia records={tcrRecords} sources={sources} updatedLabel="5분 전">
//     {/* 기존 집계 지연 지수 / 수동 이슈 모드 토글 섹션 */}
//   </LogisightEurasia>
// prop 없이도 동작(샘플 폴백).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, type ReactNode } from "react";

export type CorridorRecord = {
  route_label: string;
  status?: "정상" | "주의" | "지연" | null; // 없으면 delay_days로 자동 산정
  original_eta?: string | null; // 최초 ETA (original_expected_arrival_date)
  current_eta?: string | null; // 최신 ETA
  delay_days?: number | null; // 지연(vs 최초) = max/alert delay
  active_containers?: number | null; // 영향 컨테이너 (active_delayed_count)
};
export type SourceStatus = {
  name: string; // 'TCR · 중국 철도' / 'FESCO · TSR'
  state: "active" | "empty" | "view_missing" | "error" | "hold";
  detail?: string | null; // '정상 · 3건' / '보류 · 미수집'
};
type Props = {
  showNav?: boolean;
  records?: CorridorRecord[];
  sources?: SourceStatus[];
  updatedLabel?: string;
  loading?: boolean;
  children?: ReactNode; // 보존 모드 슬롯
};

const NAV = [{ l: "홈" }, { l: "뉴스" }, { l: "인사이트", on: true }, { l: "리포트" }];
const SUB = ["종합", "전망", "운임", "유라시아", "포트", "무역", "산업", "기후예측"];

const FB_RECORDS: CorridorRecord[] = [
  {
    route_label: "Kashgar → Andijan",
    original_eta: "2026-05-25",
    current_eta: "2026-06-16",
    delay_days: 22,
    active_containers: 11,
  },
  {
    route_label: "Xi'an → Małaszewicze",
    original_eta: "2026-05-21",
    current_eta: "2026-06-08",
    delay_days: 18,
    active_containers: 6,
  },
  {
    route_label: "Qingdao → Kashgar",
    original_eta: "2026-06-01",
    current_eta: "2026-06-09",
    delay_days: 8,
    active_containers: 10,
  },
];
const FB_SOURCES: SourceStatus[] = [
  { name: "TCR · 중국 철도", state: "active", detail: "정상 · 3건" },
  { name: "FESCO · TSR", state: "hold", detail: "보류 · 미수집" },
];

const STYLE = `
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
.lsg-root{--bg:#070b16;--bg2:#0a0f1d;--bg3:#0e1626;--lineD:#78a0cd1c;--dmut:#93a1b7;--dfaint:#5d6b80;
  --paper:#e6eaf1;--card:#f4f7fb;--line:#d8dfe9;--line2:#e6ebf2;--ink:#1a2433;--body:#54606f;--mute:#828d9d;
  --teal:#2dd4bf;--teal2:#0d9488;--teal3:#14b8a6;--up:#16a34a;--down:#dc2626;--warn:#d97706;--blue:#1864ab;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
/* 전역 reset은 box-sizing만 — margin/padding을 0으로 만들면 .slot의 Tailwind/Kit이 깨진다. */
.lsg-root,.lsg-root *{box-sizing:border-box}
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

.lsg-root .sub{background:var(--bg2);border-bottom:1px solid var(--lineD)}
.lsg-root .sub .row{display:flex;align-items:center;gap:22px;height:46px;overflow-x:auto;font-size:13.5px;scrollbar-width:none;-ms-overflow-style:none}
.lsg-root .sub .row::-webkit-scrollbar{display:none}
.lsg-root .sub .lbl{flex:none;font-size:10.5px;font-weight:700;letter-spacing:.18em;color:var(--dfaint)}
.lsg-root .sub a{white-space:nowrap;color:var(--dmut);padding:14px 0}.lsg-root .sub a:hover{color:#fff}
.lsg-root .sub a.on{color:#fff;font-weight:600;position:relative}
.lsg-root .sub a.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--teal)}

.lsg-root .hero{position:relative;overflow:hidden;background:var(--bg)}
.lsg-root .hero .glow{position:absolute;left:50%;top:-120px;width:900px;height:460px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)}
.lsg-root .hero svg.motif{position:absolute;right:-20px;top:0;height:100%;width:560px;opacity:.85}
@keyframes lsgTwk{0%,100%{opacity:.12}50%{opacity:.95}}
@keyframes lsgPul{0%,100%{opacity:.22}50%{opacity:.55}}
.lsg-root .hero svg.motif .tw{animation:lsgTwk 2.6s ease-in-out infinite}
.lsg-root .hero svg.motif .pul{animation:lsgPul 3.4s ease-in-out infinite}
.lsg-root .hero .in{position:relative;z-index:1;padding-top:48px;padding-bottom:74px}
.lsg-root .hero .eyebrow{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--teal)}
.lsg-root .hero h1{margin-top:12px;font-size:clamp(30px,4vw,44px);font-weight:800;line-height:1.06;letter-spacing:-.035em;color:#e9eef7}
.lsg-root .hero p{margin-top:13px;max-width:640px;font-size:15px;line-height:1.6;color:var(--dmut)}
.lsg-root .hpills{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
.lsg-root .hpills .p{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--lineD);background:var(--bg3);border-radius:999px;padding:7px 13px;font-size:12.5px;color:var(--dmut)}
.lsg-root .hpills .p b{color:#e9eef7}.lsg-root .hpills .dot{width:7px;height:7px;border-radius:50%}

.lsg-root .sheet{position:relative;z-index:2;margin-top:-28px;background:var(--paper);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -34px rgba(0,0,0,.7);padding-bottom:10px}
.lsg-root .bc{padding-top:26px;font-size:12.5px;color:var(--mute)}.lsg-root .bc b{color:var(--body);font-weight:500}
.lsg-root .card{border:1px solid var(--line);background:var(--card);border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.lsg-root .sect-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:26px 0 14px}
.lsg-root .sect-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsg-root .chip{border:1px solid var(--line);background:#eef1f6;border-radius:999px;padding:3px 9px;font-size:11px;color:var(--mute)}

.lsg-root .judge{margin-top:14px;border:1px solid var(--line);background:linear-gradient(180deg,#fbfcfe,#f4f7fb);border-radius:16px;padding:18px 20px}
.lsg-root .judge .top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.lsg-root .judge .verdict{font-size:15px;font-weight:800;color:var(--ink);letter-spacing:-.02em}.lsg-root .judge .verdict b{color:var(--down)}
.lsg-root .judge .ai{margin-top:6px;font-size:12.5px;color:var(--body);max-width:780px;line-height:1.55}
.lsg-root .jstamp{font-size:11px;color:var(--mute);white-space:nowrap}
.lsg-root .srcrow{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
.lsg-root .stat{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;border-radius:7px;padding:4px 10px}
.lsg-root .stat .d{width:7px;height:7px;border-radius:50%}
.lsg-root .s-ok{background:#ecfdf3;color:#067647;border:1px solid #c7ead6}.lsg-root .s-ok .d{background:#16a34a}
.lsg-root .s-hold{background:#f1f5f9;color:#5b6677;border:1px solid #dbe3ec}.lsg-root .s-hold .d{background:#94a3b8}
.lsg-root .s-bad{background:#fef2f2;color:#b42318;border:1px solid #fbd5d5}.lsg-root .s-bad .d{background:#dc2626}
.lsg-root .tiles{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:880px){.lsg-root .tiles{grid-template-columns:repeat(2,1fr)}}
.lsg-root .tile{border:1px solid var(--line);background:#fff;border-radius:12px;padding:13px 14px}
.lsg-root .tile .k{font-size:11.5px;color:var(--mute)}
.lsg-root .tile .v{margin-top:6px;font-size:23px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.lsg-root .tile .v.bad{color:var(--down)}
.lsg-root .tile .d{margin-top:4px;font-size:11.5px;color:var(--mute)}
.lsg-root .tile .d.bad{color:var(--down)}.lsg-root .tile .d.warn{color:var(--warn)}
.lsg-root .gauge{height:6px;border-radius:999px;background:#e6ebf2;margin-top:9px;overflow:hidden}.lsg-root .gauge i{display:block;height:100%;border-radius:999px}

.lsg-root .htbl-wrap{border:1px solid var(--line);background:var(--card);border-radius:14px;overflow:hidden}
@media(max-width:760px){.lsg-root .htbl-wrap{overflow-x:auto}.lsg-root .htbl{min-width:580px}}
.lsg-root .htbl{width:100%;border-collapse:collapse;font-size:13px}
.lsg-root .htbl thead th{text-align:left;font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;padding:12px 16px;border-bottom:1px solid var(--line);background:#eef2f7}
.lsg-root .htbl tbody td{padding:13px 16px;border-bottom:1px solid var(--line2);vertical-align:middle}
.lsg-root .htbl tbody tr:last-child td{border-bottom:none}.lsg-root .htbl tbody tr:hover{background:#eef2f8}
.lsg-root .htbl th.r,.lsg-root .htbl td.r{text-align:right}.lsg-root .htbl th.c,.lsg-root .htbl td.c{text-align:center}
.lsg-root .route{font-weight:700;color:var(--ink)}.lsg-root .route small{display:block;font-weight:400;color:var(--mute);font-size:11px;margin-top:2px}
.lsg-root .sbadge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:6px;padding:3px 9px}
.lsg-root .b-normal{background:#ecfdf3;color:#067647;border:1px solid #c7ead6}
.lsg-root .b-warn{background:#fff7ed;color:#b45309;border:1px solid #fde6c8}
.lsg-root .b-delay{background:#fef2f2;color:#b42318;border:1px solid #fbd5d5}
.lsg-root .delay{font-weight:800}.lsg-root .delay.bad{color:var(--down)}.lsg-root .delay.warn{color:var(--warn)}
.lsg-root .emptytd{padding:26px 16px;text-align:center;color:var(--mute);font-size:13px}
.lsg-root .hnote{padding:11px 16px;font-size:11.5px;color:var(--mute);background:#f0f3f8;border-top:1px solid var(--line)}
.lsg-root .hnote b{color:var(--body)}

.lsg-root .two{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-top:14px}
@media(max-width:980px){.lsg-root .two{grid-template-columns:1fr}}
.lsg-root .pad{padding:16px 18px}
.lsg-root .ch-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}.lsg-root .ch-h .t{font-size:14px;font-weight:700;color:var(--ink)}

/* 데이터 구동 코리도어 스키매틱 */
.lsg-root .cmap{display:flex;flex-direction:column;gap:13px}
.lsg-root .crow{display:flex;align-items:center;gap:10px;color:#64748b}
.lsg-root .crow.s-normal{color:#16a34a}.lsg-root .crow.s-warn{color:#d97706}.lsg-root .crow.s-delay{color:#dc2626}
.lsg-root .cnode{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lsg-root .cnode.r{justify-content:flex-end;text-align:right}
.lsg-root .cdia{width:11px;height:11px;border-radius:2px;transform:rotate(45deg);flex:none;background:currentColor}
.lsg-root .crow.s-normal .cdia{background:#16a34a}.lsg-root .crow.s-warn .cdia{background:#d97706}.lsg-root .crow.s-delay .cdia{background:#dc2626}
.lsg-root .cnode .lbl{overflow:hidden;text-overflow:ellipsis}
.lsg-root .cmid{flex:0 0 96px;position:relative;height:20px}
.lsg-root .cmid .ln{position:absolute;top:50%;left:0;right:0;border-top:2px solid currentColor;opacity:.5}
.lsg-root .cmid .bg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:700;font-family:monospace;background:#fff;border:1px solid currentColor;color:currentColor;border-radius:999px;padding:1px 7px;white-space:nowrap}
.lsg-root .leg{display:flex;gap:16px;justify-content:center;margin-top:14px;font-size:11.5px;color:var(--body);flex-wrap:wrap}
.lsg-root .leg span{display:inline-flex;align-items:center;gap:6px}
.lsg-root .leg i{width:10px;height:10px;border-radius:2px;display:inline-block}

.lsg-root .srcbox .r{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;padding:9px 0;border-bottom:1px solid var(--line2)}
.lsg-root .srcbox .r:last-child{border-bottom:none}.lsg-root .srcbox .r .nm{color:var(--ink);font-weight:600}
.lsg-root .legend2{margin-top:8px;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--body)}
.lsg-root .legend2 .r{display:flex;align-items:center;gap:9px}

/* 보존 모드 슬롯 — Kit이 쓰는 토큰을 앱 기본값으로 복원(컴포넌트 .lsg-root override 무력화) */
.lsg-root .slot{margin-top:30px;border-top:1px solid var(--line);--card:#fff;--ink:#1e293b}

.lsg-root .foot{margin-top:30px;background:#060912;border-top:1px solid var(--lineD);color:var(--dfaint);font-size:13px;padding:48px 0 30px}
.lsg-root .foot .cols{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:30px;border-bottom:1px solid var(--lineD);padding-bottom:30px}
@media(max-width:880px){.lsg-root .foot .cols{grid-template-columns:1fr 1fr}}
.lsg-root .foot p{margin:10px 0 14px;max-width:240px;line-height:1.55;color:var(--dmut)}
.lsg-root .foot h6{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--dmut);margin-bottom:13px}
.lsg-root .foot .cols a{display:block;padding:5px 0;color:var(--dfaint)}.lsg-root .foot .cols a:hover{color:var(--teal)}
.lsg-root .news{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid var(--lineD);padding:22px 0}
.lsg-root .news b{font-size:14px;color:#e9eef7}.lsg-root .news p{margin-top:6px;color:var(--dmut)}.lsg-root .news .f{display:flex;gap:8px}
.lsg-root .news input{min-width:240px;border:1px solid var(--lineD);background:var(--bg3);border-radius:8px;padding:10px 14px;font-size:13px;color:#e9eef7}
.lsg-root .news button{background:var(--teal3);color:#03201d;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer}
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
function statusOf(r: CorridorRecord): "정상" | "주의" | "지연" {
  if (r.status) return r.status;
  const d = r.delay_days ?? 0;
  return d >= 14 ? "지연" : d >= 5 ? "주의" : "정상";
}
const STATUS_CLS: Record<string, string> = { 정상: "b-normal", 주의: "b-warn", 지연: "b-delay" };
const STATUS_ROW: Record<string, string> = { 정상: "s-normal", 주의: "s-warn", 지연: "s-delay" };
function eta(s?: string | null) {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[2]}-${m[3]}` : s;
}
function delayCell(n?: number | null) {
  if (n == null) return <span className="mute">—</span>;
  const cls = n >= 14 ? "bad" : n >= 5 ? "warn" : "";
  return <span className={`delay ${cls} mono`}>{n > 0 ? `+${n}일` : `${n}일`}</span>;
}
function splitRoute(label: string): [string, string] {
  const parts = label
    .split(/→|->|~|—/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [parts[0] ?? label, parts[1] ?? ""];
}
function sourceCls(s: SourceStatus) {
  return s.state === "active" ? "s-ok" : s.state === "error" ? "s-bad" : "s-hold";
}
function sourceText(s: SourceStatus) {
  if (s.detail) return s.detail;
  return { active: "정상", empty: "미수집", view_missing: "뷰 없음", error: "오류", hold: "보류" }[
    s.state
  ];
}

export default function LogisightEurasia({
  showNav = true,
  records = FB_RECORDS,
  sources = FB_SOURCES,
  updatedLabel = "5분 전",
  loading = false,
  children,
}: Props) {
  const m = useMemo(() => {
    const recs = records ?? [];
    const n = recs.length;
    const delays = recs.map((r) => r.delay_days ?? 0);
    const avg = n ? Math.round(delays.reduce((a, b) => a + b, 0) / n) : null;
    const cont = recs.reduce((a, r) => a + (r.active_containers ?? 0), 0);
    const worst = recs.reduce<CorridorRecord | null>(
      (w, r) => (!w || (r.delay_days ?? 0) > (w.delay_days ?? 0) ? r : w),
      null,
    );
    const gaugePct = avg == null ? 0 : Math.min(100, Math.round((avg / 25) * 100));
    return { n, avg, cont, worst, gaugePct };
  }, [records]);

  const verdict =
    m.n === 0 ? (
      "TCR 운영 지연 데이터 수집 중."
    ) : (
      <>
        TCR {m.n}개 노선 운영 중 —{" "}
        {m.worst ? (
          <>
            최대 지연{" "}
            <b>
              {m.worst.route_label} +{m.worst.delay_days}일
            </b>
          </>
        ) : null}
        .
      </>
    );
  const aiLine =
    m.n === 0
      ? "TCR 스냅샷이 수집되면 노선별 상태·지연이 표시됩니다. FESCO·TSR은 데이터 보류 중입니다."
      : `영향 컨테이너 합계 ${m.cont}건, 평균 ETA 지연 ${m.avg}일. 지연은 노선 최초 예정 ETA(baseline) 대비입니다. FESCO·TSR은 데이터 보류 중.`;

  return (
    <div className="lsg-root">
      <style>{STYLE}</style>

      {showNav && (
        <>
          <header className="nav">
            <div className="wrap row">
              <Wordmark />
              <nav>
                {NAV.map((x) => (
                  <a key={x.l} href="#" className={x.on ? "on" : undefined}>
                    {x.l}
                  </a>
                ))}
              </nav>
            </div>
          </header>
          <div className="sub">
            <div className="wrap row">
              <span className="lbl">INSIGHT</span>
              {SUB.map((s) => (
                <a key={s} href="#" className={s === "유라시아" ? "on" : undefined}>
                  {s}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      <section className="hero">
        <div className="glow" />
        <svg
          className="motif"
          viewBox="0 0 560 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g className="pul" stroke="#2dd4bf" strokeWidth="1.4" fill="none">
            <path d="M40 220 C 160 170, 300 250, 420 150 S 540 90, 545 80" />
          </g>
          <g fill="#2dd4bf">
            <rect
              className="tw"
              style={{ animationDelay: "0s" }}
              x="120"
              y="195"
              width="13"
              height="13"
              rx="2"
              transform="rotate(45 126 201)"
            />
            <rect
              className="tw"
              style={{ animationDelay: ".9s" }}
              x="300"
              y="208"
              width="13"
              height="13"
              rx="2"
              transform="rotate(45 306 214)"
            />
            <rect
              className="tw"
              style={{ animationDelay: "1.7s" }}
              x="420"
              y="143"
              width="13"
              height="13"
              rx="2"
              transform="rotate(45 426 149)"
            />
          </g>
          <g fill="#5eead4">
            <circle className="tw" style={{ animationDelay: ".4s" }} cx="40" cy="220" r="4" />
            <circle className="tw" style={{ animationDelay: "1.3s" }} cx="545" cy="80" r="4" />
          </g>
          <g fill="#7ef0e0">
            <circle className="tw" style={{ animationDelay: ".2s" }} cx="480" cy="44" r="2.6" />
            <circle className="tw" style={{ animationDelay: "1.1s" }} cx="520" cy="160" r="2.1" />
            <circle className="tw" style={{ animationDelay: ".7s" }} cx="430" cy="118" r="2.6" />
            <circle className="tw" style={{ animationDelay: "2s" }} cx="378" cy="62" r="2.1" />
            <circle className="tw" style={{ animationDelay: "1.5s" }} cx="552" cy="226" r="2.6" />
          </g>
        </svg>
        <div className="wrap in">
          <span className="eyebrow">Eurasia Corridor Intelligence</span>
          <h1>유라시아 코리도어</h1>
          <p>
            TCR(중국횡단철도) 노선의 운영 상태·ETA 지연을 한눈에. 지연은 노선 최초 예정
            ETA(baseline) 대비로 산출합니다.
          </p>
          <div className="hpills">
            <span className="p">
              <span className="dot" style={{ background: "#16a34a" }} />
              TCR 정상 <b className="mono">{m.n}</b>개 노선
            </span>
            <span className="p">
              <span className="dot" style={{ background: "#94a3b8" }} />
              FESCO·TSR <b>보류</b>
            </span>
            <span className="p">
              <span className="dot" style={{ background: "#dc2626" }} />
              최대 지연 <b className="mono">{m.worst ? `+${m.worst.delay_days}일` : "—"}</b>
            </span>
          </div>
        </div>
      </section>

      <div className="sheet">
        <div className="wrap">
          <div className="bc">
            홈 <b>›</b> 인사이트 <b>›</b> 유라시아
          </div>

          {/* 종합 판단 */}
          <div className="judge">
            <div className="top">
              <div>
                <div className="verdict">{verdict}</div>
                <div className="ai">{aiLine}</div>
              </div>
              <div className="jstamp">마지막 업데이트 {updatedLabel}</div>
            </div>
            <div className="srcrow">
              {sources.map((s) => (
                <span key={s.name} className={`stat ${sourceCls(s)}`}>
                  <span className="d" />
                  {s.name} {sourceText(s)}
                </span>
              ))}
            </div>
            <div className="tiles">
              <div className="tile">
                <div className="k">활성 TCR 노선</div>
                <div className="v mono">{m.n || "—"}</div>
                <div className="d">{m.n ? "정상 수집 중" : "수집 중"}</div>
              </div>
              <div className="tile">
                <div className="k">평균 ETA 지연 (vs 최초)</div>
                <div className={`v mono ${m.avg && m.avg >= 5 ? "bad" : ""}`}>
                  {m.avg == null ? "—" : `+${m.avg}일`}
                </div>
                <div className="gauge">
                  <i style={{ width: `${m.gaugePct}%`, background: "var(--down)" }} />
                </div>
              </div>
              <div className="tile">
                <div className="k">영향 컨테이너</div>
                <div className="v mono">{m.n ? m.cont : "—"}</div>
                <div className="d">{m.n ? `${m.n}개 노선 합산` : "수집 중"}</div>
              </div>
              <div className="tile">
                <div className="k">최대 지연 노선</div>
                <div className={`v mono ${m.worst && (m.worst.delay_days ?? 0) >= 5 ? "bad" : ""}`}>
                  {m.worst ? `+${m.worst.delay_days}일` : "—"}
                </div>
                <div className="d warn">{m.worst ? m.worst.route_label : "수집 중"}</div>
              </div>
            </div>
          </div>

          {/* 코리도어 헬스 */}
          <div className="sect-h">
            <h2>코리도어 헬스</h2>
            <span className="chip">노선별 상태 · ETA 지연</span>
          </div>
          <div className="htbl-wrap">
            <table className="htbl">
              <thead>
                <tr>
                  <th>노선</th>
                  <th className="c">상태</th>
                  <th className="c">최초 ETA</th>
                  <th className="c">최신 ETA</th>
                  <th className="r">지연(vs 최초)</th>
                  <th className="r">영향 컨테이너</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="emptytd" colSpan={6}>
                      불러오는 중…
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td className="emptytd" colSpan={6}>
                      TCR 지연 데이터 수집 중
                    </td>
                  </tr>
                ) : (
                  records.map((r, i) => {
                    const st = statusOf(r);
                    return (
                      <tr key={i}>
                        <td className="route">
                          {r.route_label}
                          <small>TCR · 중국 철도</small>
                        </td>
                        <td className="c">
                          <span className={`sbadge ${STATUS_CLS[st]}`}>● {st}</span>
                        </td>
                        <td className="c mono">{eta(r.original_eta)}</td>
                        <td className="c mono">{eta(r.current_eta)}</td>
                        <td className="r">{delayCell(r.delay_days)}</td>
                        <td className="r mono">{r.active_containers ?? "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div className="hnote">
              <b>지연 = 최신 ETA − 최초 예정 ETA(baseline)</b>. 일일 스냅샷 누적으로 산출하며,
              FESCO·TSR은 데이터 보류 중입니다.
            </div>
          </div>

          {/* 보조: 코리도어 맵 + 소스 상태 */}
          <div className="two">
            <div className="card pad">
              <div className="ch-h">
                <span className="t">코리도어 맵</span>
                <span className="chip">TCR 노선 개요</span>
              </div>
              {records.length === 0 ? (
                <div className="emptytd">노선 데이터 수집 중</div>
              ) : (
                <div className="cmap">
                  {records.map((r, i) => {
                    const st = statusOf(r);
                    const [o, d] = splitRoute(r.route_label);
                    return (
                      <div className={`crow ${STATUS_ROW[st]}`} key={i}>
                        <div className="cnode">
                          <span className="cdia" />
                          <span className="lbl">{o}</span>
                        </div>
                        <div className="cmid">
                          <div className="ln" />
                          {r.delay_days != null && <div className="bg">+{r.delay_days}일</div>}
                        </div>
                        <div className="cnode r">
                          <span className="lbl">{d || "—"}</span>
                          <span className="cdia" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="leg">
                <span>
                  <i style={{ background: "#16a34a" }} /> 정상
                </span>
                <span>
                  <i style={{ background: "#d97706" }} /> 주의
                </span>
                <span>
                  <i style={{ background: "#dc2626" }} /> 지연
                </span>
                <span style={{ color: "var(--mute)" }}>FESCO = 보류</span>
              </div>
            </div>

            <div className="card pad">
              <div className="ch-h">
                <span className="t">소스 상태</span>
                <span className="chip">데이터 수집</span>
              </div>
              <div className="srcbox">
                {sources.map((s) => (
                  <div className="r" key={s.name}>
                    <span className="nm">{s.name}</span>
                    <span className={`stat ${sourceCls(s)}`}>
                      <span className="d" />
                      {sourceText(s)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="ch-h" style={{ marginTop: 16 }}>
                <span className="t">읽는 법</span>
              </div>
              <div className="legend2">
                <div className="r">
                  <span className="sbadge b-normal">● 정상</span> 지연 없음/미미
                </div>
                <div className="r">
                  <span className="sbadge b-warn">● 주의</span> 지연 발생, 관찰
                </div>
                <div className="r">
                  <span className="sbadge b-delay">● 지연</span> 큰 지연, 영향 모니터링
                </div>
                <div
                  className="r"
                  style={{ color: "var(--mute)", fontSize: 11.5, lineHeight: 1.5 }}
                >
                  지연은 최초 예정 ETA(baseline) 대비 최신 ETA 차이입니다.
                </div>
              </div>
            </div>
          </div>

          {/* 보존 모드 슬롯 (집계 지연 지수 / 수동 이슈 등) */}
          {children ? <div className="slot">{children}</div> : null}
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
            <div className="news">
              <div>
                <b>Weekly Logistics Briefing</b>
                <p>
                  운임 지수, 정책 변화, 교역 흐름, 유라시아 코리도어 이슈를 매주 정리해 드립니다.
                </p>
              </div>
              <div className="f">
                <input type="email" placeholder="your@email.com" />
                <button>구독하기</button>
              </div>
              <div style={{ width: "100%", fontSize: 11.5, color: "var(--dfaint)" }}>
                주 1회 발송되며, 언제든 구독을 해지할 수 있습니다.
              </div>
            </div>
            <div className="legal mono">
              Logisight is operated by MTL Shipping Agency. · 공공데이터 출처: PORT-MIS · 관세청 ·
              해양수산부
              <br />© 2026 MTL Shipping Agency. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
