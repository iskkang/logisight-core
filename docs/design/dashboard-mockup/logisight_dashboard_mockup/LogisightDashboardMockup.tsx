import type { CSSProperties } from "react";
import "./LogisightDashboardMockup.css";

type SparkColor = "blue" | "green" | "red" | "orange" | "gray";

type IndexRow = {
  symbol: string;
  value: string;
  pct: string;
  negative?: boolean;
};

type Lane = {
  route: string;
  value: string;
  pct: string;
  pressure: string;
  negative?: boolean;
};

const colorMap: Record<SparkColor, string> = {
  blue: "#2e86ff",
  green: "#12a66a",
  red: "#ef4444",
  orange: "#f59e0b",
  gray: "#95a6ba",
};

const tickerItems = [
  ["SCFI", "2,726.48", "+6.02%"],
  ["KCCI", "2,675", "+7.95%"],
  ["CCFI", "1,411.6", "+3.28%"],
  ["NYFI 아시아→미주", "3,103", "+5.89%"],
  ["NYFI 아시아→유럽", "3,994", "+2.74%"],
  ["NYFI 아시아→중국", "2,633", "+6.07%"],
];

const globalIndexes: IndexRow[] = [
  { symbol: "SCFI", value: "2,726.48", pct: "+6.02%" },
  { symbol: "KCCI", value: "2,675", pct: "+7.95%" },
  { symbol: "CCFI", value: "1,411.6", pct: "+3.28%" },
  { symbol: "FBX", value: "2,867.75", pct: "-7.82%", negative: true },
  { symbol: "WCI", value: "3,433", pct: "+2.30%" },
];

const lanes: Lane[] = [
  { route: "부산 → 로스앤젤레스", value: "$2,960/FEU", pct: "+6.5%", pressure: "6 / 10" },
  { route: "부산 → 뉴욕", value: "$4,200/FEU", pct: "+5.0%", pressure: "7 / 10" },
  { route: "부산 → 시카고", value: "$5,100/FEU", pct: "+3.8%", pressure: "6 / 10" },
  { route: "한국 → 안디잔", value: "$1,680/FEU", pct: "+4.2%", pressure: "5 / 10" },
  { route: "중국 → 알마티", value: "$1,950/FEU", pct: "+3.1%", pressure: "5 / 10" },
];

const miniIndexes = [
  { name: "WCI", full: "종합 운임 지수", value: "3,833", pct: "+2.4%", score: "+0.45", color: "red" as SparkColor },
  { name: "SCFI", full: "상하이 컨테이너 운임지수", value: "2,726.48", pct: "+6.02%", score: "+0.47", color: "orange" as SparkColor },
  { name: "KCCI", full: "한국 컨테이너 운임지수", value: "2,675", pct: "+7.95%", score: "+0.66", color: "green" as SparkColor },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">
      <path d="M20.2 7.4c-1.6-2-4-3.2-6.7-3.2-4.9 0-8.9 4-8.9 8.9s4 8.9 8.9 8.9h3.1" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M13.6 8.2h6.1a5.4 5.4 0 010 10.8H8.8" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function Sparkline({ color = "blue", height = 34 }: { color?: SparkColor; height?: number }) {
  const stroke = colorMap[color];
  return (
    <svg viewBox="0 0 120 42" height={height} aria-hidden="true">
      <path d="M2 29 C15 24, 22 18, 34 21 S52 32, 66 21 S86 16, 98 22 S111 27, 118 16" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MainChart() {
  return (
    <div className="ld-main-chart">
      <div className="ld-chart-legend">
        <span><i className="ld-legend-dot ld-legend-blue" />WCI_SHA_RTM</span>
        <span><i className="ld-legend-dot ld-legend-gray" />WCI</span>
        <span><i className="ld-legend-dot ld-legend-band" />예측 범위</span>
      </div>
      <svg viewBox="0 0 700 250" role="img" aria-label="WCI SHA RTM forecast chart">
        <defs>
          <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2e86ff" stopOpacity="0.20" />
            <stop offset="1" stopColor="#2e86ff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160, 200].map((y) => (
          <line key={y} x1="42" y1={y} x2="675" y2={y} stroke="#e5edf6" strokeWidth="1" />
        ))}
        {["4,000", "3,500", "3,000", "2,500", "2,000"].map((t, i) => (
          <text key={t} x="4" y={44 + i * 40} fill="#708198" fontSize="12" fontWeight="700">{t}</text>
        ))}
        <path d="M42 175 C80 148, 113 132, 150 126 S226 105, 272 92 S326 84, 370 75" fill="none" stroke="#b9c6d6" strokeWidth="3" />
        <path d="M42 190 C84 172, 117 165, 160 160 S230 138, 280 126 S326 120, 370 118 C430 114, 500 116, 575 99 S642 90, 675 78" fill="none" stroke="#2e86ff" strokeWidth="4" strokeLinecap="round" />
        <path d="M420 132 C470 112, 535 120, 590 86 S650 72, 675 66 L675 115 C640 126, 598 128, 550 150 S475 145, 420 162 Z" fill="url(#forecastBand)" />
        <path d="M420 148 C475 130, 525 136, 585 108 S650 98, 675 92" fill="none" stroke="#2e86ff" strokeWidth="3" strokeDasharray="8 8" />
        <line x1="420" y1="34" x2="420" y2="210" stroke="#b6c5d6" strokeDasharray="6 7" />
        <text x="432" y="204" fill="#6f8198" fontSize="11" fontWeight="800">예측 구간</text>
        {['05-01', '05-08', '05-15', '05-22', '05-29', '06-01'].map((t, i) => (
          <text key={t} x={42 + i * 120} y="234" textAnchor="middle" fill="#708198" fontSize="12" fontWeight="700">{t}</text>
        ))}
      </svg>
    </div>
  );
}

function FactorBar({ label, value, width, color = "#2e86ff" }: { label: string; value: string; width: number; color?: string }) {
  return (
    <div className="ld-factor-row">
      <span>{label}</span>
      <div className="ld-factor-bar"><div className="ld-factor-fill" style={{ "--v": `${width}%`, "--c": color } as CSSProperties} /></div>
      <span className="val">{value}</span>
    </div>
  );
}

function MiniIndexCard({ item }: { item: typeof miniIndexes[number] }) {
  const c = colorMap[item.color];
  return (
    <article className="ld-card ld-mini-card">
      <div className="ld-mini-head">
        <div>
          <h3>{item.name}</h3>
          <div className="ld-mini-sub">{item.full}</div>
        </div>
        <span className={item.color === "green" ? "ld-badge green" : item.color === "orange" ? "ld-badge orange" : "ld-badge red"}>상승 우세</span>
      </div>
      <div className="ld-mini-metric">
        <strong>{item.value}</strong>
        <span className="ld-pct-pos">{item.pct}</span>
      </div>
      <div className="ld-mini-spark"><Sparkline color={item.color} height={40} /></div>
      <div className="ld-mini-bars">
        <div className="ld-mini-bar">수요 <i style={{ "--v": "68%", "--c": c } as CSSProperties} /></div>
        <div className="ld-mini-bar">운임선 <i style={{ "--v": "44%", "--c": "#8395ac" } as CSSProperties} /></div>
        <div className="ld-mini-bar">요인 점수 <strong>{item.score}</strong></div>
        <div className="ld-mini-bar">자세히 보기 ›</div>
      </div>
    </article>
  );
}

function LaneCard({ lane }: { lane: Lane }) {
  return (
    <article className="ld-lane-card">
      <div className="ld-lane-route"><span>⚓ {lane.route}</span></div>
      <div className="ld-lane-value">{lane.value.includes("/") ? <>{lane.value.split("/")[0]}<small>/{lane.value.split("/")[1]}</small></> : lane.value}</div>
      <div className="ld-lane-bottom">
        <span className={lane.negative ? "ld-pct-neg" : "ld-pct-pos"}>{lane.pct}</span>
        <span>운임 압력 {lane.pressure}</span>
        <Sparkline color="green" height={22} />
      </div>
    </article>
  );
}

export default function LogisightDashboardMockup() {
  return (
    <div className="ld-dashboard">
      <header className="ld-topbar">
        <div className="ld-brand"><span className="ld-logo-mark"><LogoMark /></span>Logisight</div>
        <nav className="ld-nav" aria-label="Main navigation">
          {['종합', '운임', '무역', '정책', '유라시아', '뉴스', '전망', '산업별'].map((nav, idx) => (
            <a href="#" className={idx === 0 ? 'active' : undefined} key={nav}>{nav}</a>
          ))}
        </nav>
        <div className="ld-top-actions">
          <div className="ld-search">⌕ <span>지수·노선·항만 검색</span></div>
          <span className="ld-icon-btn">☆ 관심</span>
          <span className="ld-avatar">LS</span>
        </div>
      </header>

      <div className="ld-ticker">
        {tickerItems.map(([name, value, pct]) => (
          <div className="ld-ticker-item" key={name}><span>{name}</span><strong>{value}</strong><span className="ld-up">{pct}</span></div>
        ))}
      </div>

      <section className="ld-hero">
        <div className="ld-hero-inner">
          <h1>종합 <span>Control Tower</span></h1>
          <p>글로벌 해상 운임, 무역, 정책, 유라시아 리스크를 통합 분석하여 의사결정을 돕는 통합 인텔리전스 플랫폼</p>
          <div className="ld-status-chips">
            <span className="ld-chip">▣ 2026-06-07 (일)</span>
            <span className="ld-chip red">⚠ 경보 1건 · 경고 0건 · 주의 1건</span>
            <span className="ld-chip amber">KCCI WoW <b>+8.0%</b></span>
            <span className="ld-chip green">⌂ 유라시아 상태 정상</span>
            <span className="ld-chip blue">▣ 기준일 2026-06-01</span>
          </div>
        </div>
      </section>

      <main className="ld-container">
        <section className="ld-kpis">
          <article className="ld-kpi-card alert"><div className="ld-kpi-icon">⌁</div><div><div className="ld-kpi-label">오늘의 경보</div><div className="ld-kpi-value"><span className="ld-pct-neg">1</span>건</div><div className="ld-kpi-sub">자세히 보기 ›</div></div></article>
          <article className="ld-kpi-card warning"><div className="ld-kpi-icon">⌚</div><div><div className="ld-kpi-label">운임 압력 <span className="ld-muted">(WCI_SHA_RTM)</span></div><div className="ld-kpi-value" style={{color: '#f59e0b'}}>보통</div><div className="ld-kpi-sub">5 / 10</div></div><div className="ld-kpi-spark"><Sparkline color="gray" /></div></article>
          <article className="ld-kpi-card warning"><div className="ld-kpi-icon">ϟ</div><div><div className="ld-kpi-label">AI 종합 판단</div><div className="ld-kpi-value" style={{color: '#f59e0b'}}>보통 상승</div><div className="ld-kpi-sub">+1.4% ~ +2.6%</div></div><div className="ld-kpi-spark"><Sparkline color="gray" /></div></article>
          <article className="ld-kpi-card"><div className="ld-kpi-icon">▣</div><div><div className="ld-kpi-label">주요 노선</div><div className="ld-kpi-value" style={{color: '#2e86ff'}}>5</div><div className="ld-kpi-sub">개 모니터링</div></div></article>
          <article className="ld-kpi-card"><div className="ld-kpi-icon">◎</div><div><div className="ld-kpi-label">글로벌 주요 지수</div><div className="ld-kpi-value" style={{color: '#2e86ff'}}>5</div><div className="ld-kpi-sub">개 추적 중</div></div></article>
        </section>

        <section className="ld-grid">
          <aside className="ld-left-stack">
            <div className="ld-card ld-panel">
              <h3 className="ld-section-title">오늘의 핵심 변화 <span className="ld-badge red">경고</span></h3>
              <div className="ld-warning-card">
                <span className="ld-badge red">⚠ 경고</span>
                <div className="ld-alert-title">한국발 해상 운임 압력</div>
                <div className="ld-alert-desc">KCCI 등 주요 지수 상승. WCI 단기 +1.4% ~ +2.6% 전망</div>
                <div className="ld-impact-row">
                  <div>KCCI<strong>+8.0%</strong></div>
                  <div>WCI<strong>+2.4%</strong></div>
                  <div>SCFI<strong>+6.0%</strong></div>
                </div>
                <button className="ld-outline-btn">분석 요약 보기 ›</button>
              </div>
            </div>
            <div className="ld-card ld-panel">
              <h3 className="ld-section-title">데이터 기준</h3>
              <ul className="ld-criteria-list">
                <li><span>기준일</span><span>2026-06-01</span></li>
                <li><span>데이터 수집</span><span>2026-06-07 07:00 KST</span></li>
                <li><span>수집 소스</span><span>12개</span></li>
                <li><span>커버리지</span><span>글로벌 95%</span></li>
                <li><span>모델 버전</span><span>Logisight AI v2.6</span></li>
              </ul>
              <button className="ld-outline-btn">데이터 기준 상세 보기 ›</button>
            </div>
          </aside>

          <section className="ld-main-stack">
            <article className="ld-card ld-judgment">
              <div className="ld-panel-head">
                <div>
                  <h2>오늘의 종합 판단</h2>
                  <div className="ld-head-meta">
                    <span className="ld-badge blue">운임 ▬ 보합권</span>
                    <span className="ld-badge gray">확신도 낮음</span>
                    <span className="ld-badge green">AI 초안 · 에디터 검수</span>
                  </div>
                </div>
                <div className="ld-head-actions"><span className="ld-badge blue">AI 분석</span><span className="ld-badge gray">에디터 검수</span></div>
              </div>
              <div className="ld-chart-grid">
                <div>
                  <div className="ld-chart-title">WCI_SHA_RTM 추이 <span style={{color:'#7b8ca2'}}>(종합 운임 지수)</span></div>
                  <MainChart />
                </div>
                <div className="ld-summary-list">
                  <h3>핵심 요약</h3>
                  {[
                    ["WCI_SHA_RTM", "3,579", "+2.6%"], ["WCI", "3,833", "+2.4%"], ["SCFI", "2,726", "+6.0%"], ["KCCI", "2,675", "+8.0%"],
                  ].map(([name, value, pct]) => <div className="row" key={name}><span className="name">{name}</span><span className="value">{value}</span><span className="pct">{pct}</span></div>)}
                </div>
                <div className="ld-factor-panel">
                  <h3>요인별 기여도</h3>
                  <FactorBar label="수요" value="+0.61" width={86} />
                  <FactorBar label="운임선" value="+0.39" width={66} />
                  <FactorBar label="유가" value="+0.18" width={48} color="#72a8ff" />
                  <FactorBar label="환율" value="-0.07" width={28} color="#8597aa" />
                  <FactorBar label="항만" value="-0.11" width={22} color="#8597aa" />
                  <FactorBar label="계절성" value="-0.20" width={18} color="#8597aa" />
                </div>
              </div>
              <div className="ld-insight-and-scenarios">
                <div className="ld-insight-box">
                  <h3>종합 인사이트</h3>
                  <p>아시아발 주요 항로의 수요 증가와 북미 수요 선주 임박 효과로 단기 운임 상승 압력이 지속될 전망입니다. KCCI의 큰 폭 상승이 WCI 단기 상승을 견인하고 있으며, 선복 및 계약 전략을 유연하게 운영하는 것이 권장됩니다.</p>
                </div>
                <div>
                  <div className="ld-chart-title" style={{marginBottom: 8}}>시나리오 전망 (WCI 변화율)</div>
                  <div className="ld-scenarios">
                    <div className="ld-scenario red"><strong>상승 시나리오</strong><div className="big">+2.6% ~ +3.7%</div><p>확률 30% · 선복 부족 심화</p></div>
                    <div className="ld-scenario blue"><strong>기준 시나리오</strong><div className="big">+1.4% ~ +2.6%</div><p>확률 50% · 공급 제한 지속</p></div>
                    <div className="ld-scenario green"><strong>하락 시나리오</strong><div className="big">-0.5% ~ +0.5%</div><p>확률 20% · 수요 둔화</p></div>
                  </div>
                </div>
              </div>
            </article>

            <section className="ld-mini-indexes">
              {miniIndexes.map((item) => <MiniIndexCard item={item} key={item.name} />)}
            </section>

            <section className="ld-card ld-lanes">
              <h3 className="ld-section-title">주요 노선 현황 <span className="ld-badge gray">한국발</span></h3>
              <div className="ld-lane-grid">
                {lanes.map((lane) => <LaneCard lane={lane} key={lane.route} />)}
              </div>
            </section>
          </section>

          <aside className="ld-right-stack">
            <div className="ld-card ld-panel">
              <h3 className="ld-section-title">글로벌 지수 스냅샷 <a className="ld-small-link">전체 보기 ›</a></h3>
              <div className="ld-index-table">
                {globalIndexes.map((row) => <div className="ld-index-row" key={row.symbol}><span className="ld-index-symbol">{row.symbol.slice(0,2)}</span><span>{row.symbol}</span><span className="ld-index-value">{row.value}</span><span className={row.negative ? 'ld-pct-neg' : 'ld-pct-pos'}>{row.pct}</span></div>)}
              </div>
            </div>
            <div className="ld-card ld-panel">
              <h3 className="ld-section-title">가장 크게 상승한 한국발 운임 <a className="ld-small-link">전체 보기 ›</a></h3>
              <div className="ld-mover-list">
                {[
                  ["부산 → 테헤란 (위험)", "+150.0%"], ["인천 → 두샨베 (중앙)", "+144.4%"], ["인천 → 도쿄 (중앙)", "+142.2%"],
                ].map(([route, pct], i) => <div className="ld-mover" key={route}><span className="ld-rank">{i + 1}</span><span>{route}</span><span className="ld-pct-neg">{pct}</span></div>)}
              </div>
            </div>
            <div className="ld-card ld-panel ld-map-card">
              <h3 className="ld-section-title">유라시아 활성 장애 <a className="ld-small-link">전체 보기 ›</a></h3>
              <div className="ld-eurasia-status">● 특정 장애 없음</div>
              <div className="ld-map-graphic">
                <svg viewBox="0 0 320 130" aria-hidden="true">
                  <path d="M38 77 C75 45, 112 55, 145 62 S214 88, 280 46" fill="none" stroke="#12a66a" strokeWidth="4" strokeLinecap="round" />
                  {[38, 95, 160, 222, 280].map((x, i) => <circle key={x} cx={x} cy={i === 0 ? 77 : i === 1 ? 53 : i === 2 ? 66 : i === 3 ? 83 : 46} r="6" fill="#fff" stroke="#12a66a" strokeWidth="3" />)}
                  <path d="M72 96 L99 88 L133 94 L165 84 L199 97 L242 88" fill="none" stroke="#ced9e7" strokeWidth="2" strokeDasharray="5 6" />
                </svg>
              </div>
              <div className="ld-map-legend"><span><i className="ld-dot" style={{background:'#12a66a'}} />정상</span><span><i className="ld-dot" style={{background:'#f59e0b'}} />경고</span><span><i className="ld-dot" style={{background:'#ef4444'}} />장애</span><span><i className="ld-dot" style={{background:'#95a6ba'}} />데이터 수집 중</span></div>
            </div>
          </aside>
        </section>

        <section className="ld-process">
          <div className="ld-process-title">데이터 → 인사이트 → 브리핑 프로세스</div>
          {[
            ["1", "데이터 수집", "12개 소스 실시간 수집"], ["2", "이상 탐지", "AI 이상 패턴 탐지"], ["3", "AI 종합 판단", "지수 · 요인 분석 · 전망"], ["4", "에디터 검수", "전문가 검토 및 보정"], ["5", "브리핑 발행", "데일리 리포트 발행"],
          ].map(([num, title, desc]) => <div className="ld-process-step" key={num}><span className="ld-step-icon">{num}</span><div><strong>{title}</strong><span>{desc}</span></div></div>)}
        </section>
      </main>

      <footer className="ld-footer">
        <div className="ld-footer-inner">
          <div className="ld-footer-grid">
            <div><h3>Logisight</h3><p>MTL Shipping Agency가 운영하는 해상·무역·물류 인텔리전스 플랫폼</p><div className="ld-footer-buttons"><button>회사 소개</button><button>이용 약관</button></div></div>
            <div><h4>서비스</h4><a>운임 대시보드</a><a>유라시아 모니터링</a><a>산업별 리포트</a></div>
            <div><h4>뉴스</h4><a>해상 뉴스</a><a>항공 뉴스</a><a>경제·정책</a><a>물류 브리핑</a></div>
            <div><h4>MTL</h4><a>회사 소개</a><a>뉴스레터 구독</a><a>영업 문의</a></div>
            <div className="ld-newsletter"><h4>매주 한 번의 물류 브리핑</h4><p>운임, 시황, 정책, 대외 동향을 한눈에 정리해 드립니다.</p><div className="ld-newsletter-row"><input placeholder="you@email.com" /><button>구독하기</button></div></div>
          </div>
          <div className="ld-footer-bottom"><span>© 2026 MTL Shipping Agency · 상호명 (주)엠티엘 · 서울특별시 강남구 테헤란로 123</span><span>데이터 기준 2026-06-01 · 업데이트 2026-06-07 07:00 KST</span></div>
        </div>
      </footer>
    </div>
  );
}
