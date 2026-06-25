// LogisightEurasia.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 유라시아 코리도어 — 리드 뷰 드롭인 (인사이트 리디자인 패턴)
// · 공통 크롬: HomeNav(active=insight) + InsightSubNav(유라시아) + 다크 히어로 + 페이퍼 시트 + HomeFooter
// · 리드 콘텐츠는 운영 현재 지연(operational_current_delay) 레코드에서 파생:
//   종합 판단(tiles) · 코리도어 헬스 표(추세 컬럼 없음) · 코리도어 맵(데이터 기반 단순 스키매틱) · 소스 상태
// · 데이터 안전: 원본 컨테이너/shipment_legs 비노출, 집계 레코드만. 최초/최신 ETA는 있을 때만, 없으면 "—".
// · children = 보존 모드(집계 지연 지수 · 수동 이슈) 토글 — 리드 뷰 아래 페이퍼 시트에 렌더.
// · CSS 변수는 --e-* 로 프리픽스해 children(Tailwind/proto Kit)의 토큰과 충돌하지 않게 격리.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import type { OperationalCurrentDelay, SourceStatus } from "@/lib/api/operational-delay";

type Props = {
  records: OperationalCurrentDelay[];
  sources: SourceStatus[];
  children?: ReactNode; // 보존 모드(집계 지연 지수 · 수동 이슈)
};

type Tier = "normal" | "warn" | "delay";

const STYLE = `
.lsge-root{--e-bg:#070b16;--e-bg2:#0a0f1d;--e-bg3:#0e1626;--e-lineD:#78a0cd1c;--e-dmut:#93a1b7;--e-dfaint:#5d6b80;
  --e-paper:#e6eaf1;--e-card:#f4f7fb;--e-line:#d8dfe9;--e-line2:#e6ebf2;--e-ink:#1a2433;--e-body:#54606f;--e-mute:#828d9d;
  --e-teal2:#0d9488;--e-down:#dc2626;--e-warn:#d97706;--e-ok:#0a7d54;--e-blue:#1864ab;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,sans-serif;background:var(--e-bg);color:var(--e-ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em;min-height:100vh}
.lsge-root .e-mono{font-feature-settings:"tnum" 1;letter-spacing:0}
.lsge-root .e-wrap{max-width:1200px;margin:0 auto;padding:0 44px}
@media(max-width:900px){.lsge-root .e-wrap{padding:0 24px}}
@media(max-width:640px){.lsge-root .e-wrap{padding:0 16px}}

.lsge-root .hero{position:relative;overflow:hidden;background:var(--e-bg)}
.lsge-root .hero .glow{position:absolute;left:50%;top:-120px;width:900px;height:460px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 40%,rgba(45,212,191,.10),transparent 70%)}
.lsge-root .hero .motif{position:absolute;right:-20px;top:0;height:100%;width:560px;opacity:.85}
@keyframes lsgeTwk{0%,100%{opacity:.12}50%{opacity:.95}}
@keyframes lsgePul{0%,100%{opacity:.22}50%{opacity:.55}}
.lsge-root .hero .motif .tw{animation:lsgeTwk 2.6s ease-in-out infinite}
.lsge-root .hero .motif .pul{animation:lsgePul 3.4s ease-in-out infinite}
.lsge-root .hero .in{position:relative;z-index:1;padding-top:48px;padding-bottom:74px}
.lsge-root .hero .eyebrow{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#2dd4bf}
.lsge-root .hero h1{margin-top:12px;font-size:clamp(30px,4vw,44px);font-weight:800;line-height:1.06;letter-spacing:-.035em;color:#e9eef7}
.lsge-root .hero p{margin-top:13px;max-width:640px;font-size:15px;line-height:1.6;color:var(--e-dmut)}
.lsge-root .hpills{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
.lsge-root .hpills .p{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--e-lineD);background:var(--e-bg3);border-radius:999px;padding:7px 13px;font-size:12.5px;color:var(--e-dmut)}
.lsge-root .hpills .p b{color:#e9eef7}.lsge-root .hpills .dot{width:7px;height:7px;border-radius:50%}

.lsge-root .sheet{position:relative;z-index:2;margin-top:-28px;background:var(--e-paper);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -34px rgba(0,0,0,.7);padding-bottom:30px}
.lsge-root .bc{padding-top:26px;font-size:12.5px;color:var(--e-mute)}.lsge-root .bc b{color:var(--e-body);font-weight:500}
.lsge-root .bc a:hover{color:var(--e-ink);text-decoration:underline}
.lsge-root .sect-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:26px 0 14px}
.lsge-root .sect-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--e-ink)}
.lsge-root .chip{border:1px solid var(--e-line);background:#eef1f6;border-radius:999px;padding:3px 9px;font-size:11px;color:var(--e-mute)}

.lsge-root .judge{margin-top:14px;border:1px solid var(--e-line);background:linear-gradient(180deg,#fbfcfe,#f4f7fb);border-radius:16px;padding:18px 20px}
.lsge-root .judge .top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.lsge-root .judge .verdict{font-size:15px;font-weight:800;color:var(--e-ink);letter-spacing:-.02em}.lsge-root .judge .verdict b{color:var(--e-down)}
.lsge-root .judge .ai{margin-top:6px;font-size:12.5px;color:var(--e-body);max-width:760px;line-height:1.55}
.lsge-root .jstamp{font-size:11px;color:var(--e-mute);white-space:nowrap}
.lsge-root .srcrow{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
.lsge-root .stat{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;border-radius:7px;padding:4px 10px}
.lsge-root .stat .d{width:7px;height:7px;border-radius:50%}
.lsge-root .s-ok{background:#ecfdf3;color:#067647;border:1px solid #c7ead6}.lsge-root .s-ok .d{background:#16a34a}
.lsge-root .s-hold{background:#f1f5f9;color:#5b6677;border:1px solid #dbe3ec}.lsge-root .s-hold .d{background:#94a3b8}
.lsge-root .tiles{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:880px){.lsge-root .tiles{grid-template-columns:repeat(2,1fr)}}
.lsge-root .tile{border:1px solid var(--e-line);background:#fff;border-radius:12px;padding:13px 14px}
.lsge-root .tile .k{font-size:11.5px;color:var(--e-mute)}
.lsge-root .tile .v{margin-top:6px;font-size:23px;font-weight:800;letter-spacing:-.02em;color:var(--e-ink)}
.lsge-root .tile .v.bad{color:var(--e-down)}
.lsge-root .tile .d{margin-top:4px;font-size:11.5px;color:var(--e-mute)}
.lsge-root .tile .d.bad{color:var(--e-down)}.lsge-root .tile .d.warn{color:var(--e-warn)}
.lsge-root .gauge{height:6px;border-radius:999px;background:#e6ebf2;margin-top:9px;overflow:hidden}.lsge-root .gauge i{display:block;height:100%;border-radius:999px}

.lsge-root .htbl-wrap{border:1px solid var(--e-line);background:var(--e-card);border-radius:14px;overflow:hidden}
@media(max-width:760px){.lsge-root .htbl-wrap{overflow-x:auto}.lsge-root .htbl{min-width:600px}}
.lsge-root .htbl{width:100%;border-collapse:collapse;font-size:13px}
.lsge-root .htbl thead th{text-align:left;font-size:11px;font-weight:600;color:var(--e-mute);text-transform:uppercase;letter-spacing:.04em;padding:12px 16px;border-bottom:1px solid var(--e-line);background:#eef2f7}
.lsge-root .htbl tbody td{padding:13px 16px;border-bottom:1px solid var(--e-line2);vertical-align:middle}
.lsge-root .htbl tbody tr:last-child td{border-bottom:none}
.lsge-root .htbl th.r,.lsge-root .htbl td.r{text-align:right}.lsge-root .htbl th.c,.lsge-root .htbl td.c{text-align:center}
.lsge-root .route{font-weight:700;color:var(--e-ink)}.lsge-root .route small{display:block;font-weight:400;color:var(--e-mute);font-size:11px;margin-top:2px}
.lsge-root .sbadge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:6px;padding:3px 9px}
.lsge-root .b-normal{background:#ecfdf3;color:#067647;border:1px solid #c7ead6}
.lsge-root .b-warn{background:#fff7ed;color:#b45309;border:1px solid #fde6c8}
.lsge-root .b-delay{background:#fef2f2;color:#b42318;border:1px solid #fbd5d5}
.lsge-root .delay{font-weight:800}.lsge-root .delay.bad{color:var(--e-down)}.lsge-root .delay.warn{color:var(--e-warn)}
.lsge-root .hnote{padding:11px 16px;font-size:11.5px;color:var(--e-mute);background:#f0f3f8;border-top:1px solid var(--e-line)}
.lsge-root .hnote b{color:var(--e-body)}

.lsge-root .two{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-top:14px}
@media(max-width:980px){.lsge-root .two{grid-template-columns:1fr}}
.lsge-root .card{border:1px solid var(--e-line);background:var(--e-card);border-radius:14px}
.lsge-root .pad{padding:16px 18px}
.lsge-root .ch-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}.lsge-root .ch-h .t{font-size:14px;font-weight:700;color:var(--e-ink)}

.lsge-root .eroute{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--e-line2)}
.lsge-root .eroute:last-child{border-bottom:none}
.lsge-root .eroute .nd{width:9px;height:9px;border-radius:2px;transform:rotate(45deg);flex:none}
.lsge-root .eroute .pts{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.lsge-root .eroute .ep{font-size:12.5px;font-weight:600;color:var(--e-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lsge-root .eroute .ln{flex:1;min-width:18px;height:2px;background:repeating-linear-gradient(90deg,var(--e-line) 0 6px,transparent 6px 10px)}
.lsge-root .eroute .dchip{flex:none;font-size:11px;font-weight:700;border-radius:8px;padding:2px 9px}

.lsge-root .srcbox .r{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;padding:9px 0;border-bottom:1px solid var(--e-line2)}
.lsge-root .srcbox .r:last-child{border-bottom:none}.lsge-root .srcbox .r .nm{color:var(--e-ink);font-weight:600}
.lsge-root .legend2{margin-top:8px;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--e-body)}
.lsge-root .legend2 .r{display:flex;align-items:center;gap:9px}

.lsge-root .detail{margin-top:26px;border-top:1px solid var(--e-line);padding-top:18px}
.lsge-root .detail-toggle{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:var(--e-ink);border:1px solid var(--e-line);background:#fff;border-radius:10px;padding:9px 14px;cursor:pointer}
.lsge-root .detail-toggle:hover{background:var(--e-card)}
.lsge-root .detail-toggle .cv{font-size:11px;color:var(--e-mute);transition:transform .2s}
.lsge-root .detail-toggle[aria-expanded="true"] .cv{transform:rotate(180deg)}
@media(prefers-reduced-motion:reduce){.lsge-root *{animation:none!important}}
`;

// ── 파생 헬퍼 (OperationalCurrentDelayMap과 동일 규칙) ──────────────────────────
function delayOf(r: OperationalCurrentDelay): number {
  return Math.max(
    0,
    Math.round(r.alert_delay_days ?? r.max_delay_days ?? r.median_delay_days ?? 0),
  );
}
function affectedContainers(r: OperationalCurrentDelay): number {
  return Math.max(0, r.active_delayed_count || r.container_count || 0);
}
function routeLabel(r: OperationalCurrentDelay): string {
  const fallback = [r.current_from ?? r.origin, r.current_to ?? r.destination]
    .filter(Boolean)
    .join(" → ");
  return r.route_label || fallback || "경로 미확인";
}
function endpoints(r: OperationalCurrentDelay): [string, string] {
  const from = r.current_from ?? r.origin;
  const to = r.current_to ?? r.destination ?? r.location_name;
  if (from && to) return [from, to];
  const parts = routeLabel(r)
    .split(/\s*(?:→|->|—|–|~)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [parts[0] ?? "—", parts[parts.length - 1] ?? "—"];
}
function sourceLabel(r: OperationalCurrentDelay): string {
  if (r.source_system === "FESCO") return "FESCO · TSR";
  return r.transport_mode === "CHINA_RAIL_TRUCK" ? "TCR · 중국 철도+트럭" : "TCR · 중국 철도";
}
// 정상/주의/지연 3단계 — 지연일 기준. (+8 주의 / +18·+22 지연 목업과 정합)
function tierOf(delay: number): Tier {
  if (delay >= 10) return "delay";
  if (delay >= 1) return "warn";
  return "normal";
}
const TIER_BADGE: Record<Tier, { cls: string; label: string }> = {
  normal: { cls: "b-normal", label: "정상" },
  warn: { cls: "b-warn", label: "주의" },
  delay: { cls: "b-delay", label: "지연" },
};
const TIER_COLOR: Record<Tier, string> = {
  normal: "#16a34a",
  warn: "#d97706",
  delay: "#dc2626",
};

const STATE_LABEL: Record<SourceStatus["state"], string> = {
  active: "정상",
  empty: "보류 · 미수집",
  view_missing: "보류 · 뷰 미생성",
  error: "오류",
};
function getSource(sources: SourceStatus[], system: "FESCO" | "TCR"): SourceStatus {
  return (
    sources.find((s) => s.source_system === system) ?? {
      source_system: system,
      state: "view_missing",
      rows: 0,
    }
  );
}
function statusText(s: SourceStatus): string {
  return s.state === "active" ? `정상 · ${s.rows}건` : STATE_LABEL[s.state];
}
function fmtEta(v: string | undefined): string {
  if (!v) return "—";
  // 'YYYY-MM-DD…' → 'MM-DD' (목업과 동일 짧은 표기), 그 외 원문.
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}` : v;
}
function fmtDate(v: string | undefined): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : v;
}

function Hero({
  records,
  sources,
}: {
  records: OperationalCurrentDelay[];
  sources: SourceStatus[];
}) {
  const tcr = getSource(sources, "TCR");
  const fesco = getSource(sources, "FESCO");
  const tcrRoutes = records.filter((r) => r.source_system === "TCR").length;
  const maxDelay = records.reduce((m, r) => Math.max(m, delayOf(r)), 0);
  return (
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
        <g fill="#7ef0e0">
          <circle className="tw" style={{ animationDelay: ".2s" }} cx="480" cy="44" r="2.6" />
          <circle className="tw" style={{ animationDelay: "1.1s" }} cx="520" cy="160" r="2.1" />
          <circle className="tw" style={{ animationDelay: ".7s" }} cx="430" cy="118" r="2.6" />
          <circle className="tw" style={{ animationDelay: "1.5s" }} cx="552" cy="226" r="2.6" />
          <circle className="tw" style={{ animationDelay: ".55s" }} cx="250" cy="150" r="2" />
        </g>
      </svg>
      <div className="e-wrap in">
        <span className="eyebrow">Eurasia Corridor Intelligence</span>
        <h1>유라시아 코리도어</h1>
        <p>
          TCR(중국횡단철도) 노선의 운영 상태·ETA 지연을 한눈에. 지연은 노선 최신 ETA와 최초 관측
          ETA(baseline) 대비로 산출하며, 원본 컨테이너는 비공개·집계만 표시합니다.
        </p>
        <div className="hpills">
          <span className="p">
            <span
              className="dot"
              style={{ background: tcr.state === "active" ? "#16a34a" : "#94a3b8" }}
            />
            TCR {tcr.state === "active" ? "정상" : "보류"} <b className="e-mono">{tcrRoutes}</b>개
            노선
          </span>
          <span className="p">
            <span
              className="dot"
              style={{ background: fesco.state === "active" ? "#16a34a" : "#94a3b8" }}
            />
            FESCO·TSR <b>{fesco.state === "active" ? `${fesco.rows}건` : "보류"}</b>
          </span>
          <span className="p">
            <span className="dot" style={{ background: maxDelay > 0 ? "#dc2626" : "#94a3b8" }} />
            최대 지연 <b className="e-mono">{maxDelay > 0 ? `+${maxDelay}일` : "—"}</b>
          </span>
        </div>
      </div>
    </section>
  );
}

function Judge({
  records,
  sources,
}: {
  records: OperationalCurrentDelay[];
  sources: SourceStatus[];
}) {
  const tcr = getSource(sources, "TCR");
  const fesco = getSource(sources, "FESCO");
  const sorted = [...records].sort((a, b) => delayOf(b) - delayOf(a));
  const worst = sorted[0] ?? null;
  const worstDelay = worst ? delayOf(worst) : 0;
  const delays = records.map(delayOf);
  const avg = delays.length
    ? Math.round((delays.reduce((s, v) => s + v, 0) / delays.length) * 10) / 10
    : null;
  const containers = records.reduce((s, r) => s + affectedContainers(r), 0);
  const stamp = records
    .map((r) => r.last_checked_at)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);

  const verdict =
    records.length === 0 ? (
      <>
        현재 운영 지연 데이터 <b>수집 중</b>.
      </>
    ) : (
      <>
        {records.length}개 노선 모니터링 —{" "}
        <b>
          {routeLabel(worst!)} +{worstDelay}일 최대
        </b>
        .
      </>
    );
  const summary =
    records.length === 0
      ? "운영 추적 소스(FESCO·TCR)의 현재 지연 집계 행이 아직 없습니다. 소스 상태를 확인하세요."
      : `${routeLabel(worst!)}가 +${worstDelay}일로 가장 큽니다. 평균 ETA 지연은 +${avg}일, 영향 컨테이너는 ${containers}건입니다. FESCO·TSR은 ${tcr.state === "active" && fesco.state !== "active" ? "데이터 보류 중" : statusText(fesco)}. ETA 지연은 최신 ETA와 최초 관측 ETA(baseline) 대비이며, 일일 스냅샷이 누적될수록 추세 정확도가 올라갑니다.`;

  return (
    <div className="judge">
      <div className="top">
        <div>
          <div className="verdict">{verdict}</div>
          <div className="ai">{summary}</div>
        </div>
        <div className="jstamp e-mono">
          {stamp ? `마지막 업데이트 ${fmtDate(stamp)}` : "업데이트 시각 수집 중"}
        </div>
      </div>
      <div className="srcrow">
        <span className="stat s-ok">
          <span className="d" />
          TCR · 중국 철도 {tcr.state === "active" ? `정상 · ${tcr.rows}건` : STATE_LABEL[tcr.state]}
        </span>
        <span className="stat s-hold">
          <span className="d" />
          FESCO · TSR {statusText(fesco)}
        </span>
      </div>
      <div className="tiles">
        <div className="tile">
          <div className="k">활성 노선</div>
          <div className="v e-mono">{records.length}</div>
          <div className="d">현재 지연 집계</div>
        </div>
        <div className="tile">
          <div className="k">평균 ETA 지연</div>
          <div className={`v e-mono ${avg && avg > 0 ? "bad" : ""}`}>
            {avg !== null ? `+${avg}일` : "—"}
          </div>
          <div className="d">관측 노선 평균</div>
          {avg !== null && (
            <div className="gauge">
              <i
                style={{
                  width: `${Math.min(100, avg * 5)}%`,
                  background: avg > 0 ? "var(--e-down)" : "#94a3b8",
                }}
              />
            </div>
          )}
        </div>
        <div className="tile">
          <div className="k">영향 컨테이너</div>
          <div className="v e-mono">{containers}</div>
          <div className="d">전 노선 합산</div>
        </div>
        <div className="tile">
          <div className="k">최대 지연 노선</div>
          <div className="v e-mono bad">{worst ? `+${worstDelay}일` : "—"}</div>
          <div className="d warn">{worst ? routeLabel(worst) : "—"}</div>
        </div>
      </div>
    </div>
  );
}

function CorridorHealth({ records }: { records: OperationalCurrentDelay[] }) {
  const rows = [...records].sort((a, b) => delayOf(b) - delayOf(a));
  return (
    <>
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
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", color: "var(--e-mute)", padding: "26px 16px" }}
                >
                  현재 운영 지연 데이터 수집 중
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const delay = delayOf(r);
                const tier = tierOf(delay);
                const badge = TIER_BADGE[tier];
                return (
                  <tr key={r.id}>
                    <td className="route">
                      {routeLabel(r)}
                      <small>{sourceLabel(r)}</small>
                    </td>
                    <td className="c">
                      <span className={`sbadge ${badge.cls}`}>● {badge.label}</span>
                    </td>
                    <td className="c e-mono">{fmtEta(r.original_expected_arrival_date)}</td>
                    <td className="c e-mono">{fmtEta(r.current_eta)}</td>
                    <td className="r">
                      <span
                        className={`delay e-mono ${tier === "delay" ? "bad" : tier === "warn" ? "warn" : ""}`}
                      >
                        {delay > 0 ? `+${delay}일` : "정시"}
                      </span>
                    </td>
                    <td className="r e-mono">{affectedContainers(r)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="hnote">
          <b>지연 = 최신 ETA − 최초 관측 ETA(baseline)</b>. 일일 업로드를 스냅샷으로 누적해
          산출하며, 최초 ETA가 없는 노선은 "—"로 표기합니다.{" "}
          <span style={{ color: "#94a3b8" }}>· 이력 집계 시작 단계</span>
        </div>
      </div>
    </>
  );
}

function CorridorMapSources({
  records,
  sources,
}: {
  records: OperationalCurrentDelay[];
  sources: SourceStatus[];
}) {
  const tcr = getSource(sources, "TCR");
  const fesco = getSource(sources, "FESCO");
  const routes = [...records].sort((a, b) => delayOf(b) - delayOf(a));
  return (
    <div className="two">
      <div className="card pad">
        <div className="ch-h">
          <span className="t">코리도어 맵</span>
          <span className="chip">노선 개요</span>
        </div>
        {routes.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--e-mute)", padding: "20px 0" }}>
            노선 데이터 수집 중
          </p>
        ) : (
          <div>
            {routes.map((r) => {
              const [from, to] = endpoints(r);
              const delay = delayOf(r);
              const tier = tierOf(delay);
              const color = TIER_COLOR[tier];
              const badge = TIER_BADGE[tier];
              return (
                <div className="eroute" key={r.id}>
                  <span className="nd" style={{ background: color }} />
                  <span className="pts">
                    <span className="ep">{from}</span>
                    <span className="ln" />
                    <span className="ep">{to}</span>
                  </span>
                  <span
                    className={`dchip ${badge.cls}`}
                    title={`${sourceLabel(r)} · ${badge.label}`}
                  >
                    {delay > 0 ? `+${delay}일` : "정시"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="legend2" style={{ marginTop: 12 }}>
          <div className="r">
            <i
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#dc2626",
              }}
            />{" "}
            지연
            <i
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#d97706",
                marginLeft: 12,
              }}
            />{" "}
            주의
            <i
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#16a34a",
                marginLeft: 12,
              }}
            />{" "}
            정상
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="ch-h">
          <span className="t">소스 상태</span>
          <span className="chip">데이터 수집</span>
        </div>
        <div className="srcbox">
          <div className="r">
            <span className="nm">TCR · 중국 철도</span>
            <span className={`stat ${tcr.state === "active" ? "s-ok" : "s-hold"}`}>
              <span className="d" />
              {statusText(tcr)}
            </span>
          </div>
          <div className="r">
            <span className="nm">FESCO · TSR</span>
            <span className={`stat ${fesco.state === "active" ? "s-ok" : "s-hold"}`}>
              <span className="d" />
              {statusText(fesco)}
            </span>
          </div>
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
          <div className="r" style={{ color: "var(--e-mute)", fontSize: 11.5, lineHeight: 1.5 }}>
            원본 shipment_legs·컨테이너 ID는 비공개. 집계 지연·영향 건수만 표시합니다.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogisightEurasia({ records, sources, children }: Props) {
  return (
    <div className="lsge-root">
      <style>{STYLE}</style>
      <HomeNav active="insight" />
      <InsightSubNav />

      <Hero records={records} sources={sources} />

      <div className="sheet">
        <div className="e-wrap">
          <div className="bc">
            <a href="/">홈</a> <b>›</b> <a href="/dashboard">인사이트</a> <b>›</b> 유라시아
          </div>

          <Judge records={records} sources={sources} />
          <CorridorHealth records={records} />
          <CorridorMapSources records={records} sources={sources} />

          {children ? <div className="detail">{children}</div> : null}
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}
