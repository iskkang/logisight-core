// LogisightLoader.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Logisight"를 한 글자씩 타이핑하며 보여주는 전체화면 로딩 오버레이.
// 글자마다 흰색→민트→찐민트 그라데이션, 인디케이터 바 + 점멸 점.
//
// 사용:
//   const [loading, setLoading] = useState(true);
//   useEffect(() => { fetchData().finally(() => setLoading(false)); }, []);
//   return (<>
//     <LogisightLoader show={loading} />
//     ...page...
//   </>);
//
// props:
//   show   : true면 표시, false로 바뀌면 (minMs 경과 후) 페이드아웃 + 언마운트. 기본 true.
//   minMs  : 최소 노출 시간(글자 애니메이션이 다 보이도록). 기본 1800ms.
//   label  : 하단 문구. 기본 "물류 인텔리전스 불러오는 중".
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";

const WORD = "Logisight";

// 흰색 → 민트(0.55) → 찐민트(1.0) 그라데이션을 글자 위치별로 샘플링
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 255, 255]],
  [0.55, [45, 212, 191]],
  [1, [13, 148, 136]],
];
function gradColor(t: number): string {
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i][0] && t <= STOPS[i + 1][0]) { lo = STOPS[i]; hi = STOPS[i + 1]; break; }
  }
  const span = hi[0] - lo[0] || 1, k = (t - lo[0]) / span;
  const c = [0, 1, 2].map((j) => Math.round(lo[1][j] + (hi[1][j] - lo[1][j]) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const CSS = `
.lsgl{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(80% 80% at 50% 38%,#0b1426,#070b16);transition:opacity .55s ease;
  font-family:"Pretendard","Pretendard Variable",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.lsgl.hide{opacity:0;pointer-events:none}
.lsgl-box{display:flex;flex-direction:column;align-items:center;gap:20px}
.lsgl-word{display:flex;align-items:center;font-size:clamp(34px,6vw,56px);font-weight:800;letter-spacing:-.03em}
.lsgl-mark{display:inline-flex;align-items:center;margin-right:.2em;opacity:1;will-change:opacity,transform;animation:lsglIn .5s cubic-bezier(.2,.7,.2,1) both}
.lsgl-mark i{display:block;width:.30em;height:.74em;border-radius:.06em;background:linear-gradient(180deg,#2dd4bf,#0d9488);transform:translateY(.04em) skewX(-12deg)}
.lsgl-ch{display:inline-block;opacity:1;will-change:opacity,transform;
  animation:lsglIn .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes lsglIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.lsgl-bar{position:relative;width:188px;height:3px;border-radius:999px;background:#15233c;overflow:hidden}
.lsgl-bar i{position:absolute;top:0;left:0;height:100%;width:42%;border-radius:999px;
  background:linear-gradient(90deg,transparent,#2dd4bf,transparent);animation:lsglBar 1.15s ease-in-out infinite}
@keyframes lsglBar{0%{transform:translateX(-110%)}100%{transform:translateX(350%)}}
.lsgl-text{font-size:12.5px;letter-spacing:.02em;color:#93a1b7}
.lsgl-dots b{animation:lsglDot 1.2s infinite}
.lsgl-dots b:nth-child(2){animation-delay:.2s}.lsgl-dots b:nth-child(3){animation-delay:.4s}
@keyframes lsglDot{0%,100%{opacity:.2}50%{opacity:1}}
@media(prefers-reduced-motion:reduce){
  .lsgl *{animation:none!important}.lsgl{transition:none!important}
  .lsgl-ch{opacity:1!important;transform:none!important}
}
`;

export default function LogisightLoader({
  show = true,
  minMs = 1800,
  label = "물류 인텔리전스 불러오는 중",
}: { show?: boolean; minMs?: number; label?: string }) {
  const [mounted, setMounted] = useState(true);
  const [hide, setHide] = useState(false);
  const start = useRef<number>(Date.now());

  useEffect(() => {
    if (show) return; // 아직 로딩 중
    const wait = Math.max(0, minMs - (Date.now() - start.current));
    const t1 = setTimeout(() => setHide(true), wait);            // 페이드 시작
    const t2 = setTimeout(() => setMounted(false), wait + 650);  // 페이드 후 제거
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show, minMs]);

  if (!mounted) return null;
  const chars = WORD.split("");
  return (
    <div className={`lsgl${hide ? " hide" : ""}`} role="status" aria-label="불러오는 중">
      <style>{CSS}</style>
      <div className="lsgl-box">
        <div className="lsgl-word" aria-hidden="true">
          <span className="lsgl-mark"><i /></span>
          {chars.map((ch, i) => (
            <span key={i} className="lsgl-ch" style={{ color: gradColor(i / (chars.length - 1)), animationDelay: `${(i + 1) * 0.085}s` }}>{ch}</span>
          ))}
        </div>
        <div className="lsgl-bar"><i /></div>
        <div className="lsgl-text">{label}<span className="lsgl-dots"><b>.</b><b>.</b><b>.</b></span></div>
      </div>
    </div>
  );
}
