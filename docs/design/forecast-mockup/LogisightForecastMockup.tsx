import React from "react";
import "./LogisightForecastMockup.css";

type Tone = "up" | "flat" | "hot";

type Forecast = {
  name: string;
  badge: string;
  tone: Tone;
  evidence: string;
  next: string;
  thesis: string;
  points: string;
  selected?: boolean;
};

const forecasts: Forecast[] = [
  {
    name: "WCI_SHA_RTM",
    badge: "상승 +1~4%",
    tone: "up",
    evidence: "근거 · 3 / 5",
    next: "다음 확인 · 6/11 (수)",
    thesis: "단기 수요 회복과 운항 안정이 가격 하방 압력 완화",
    points: "0,31 18,30 36,30 54,18 72,27 90,17 108,23 126,10 144,19 162,18 180,25 198,15 216,20",
    selected: true,
  },
  {
    name: "WCI",
    badge: "보합권 0~2%",
    tone: "flat",
    evidence: "근거 · 3 / 5",
    next: "다음 확인 · 6/11 (수)",
    thesis: "운임 박스권 지속, 성수기 전 제한적 반등",
    points: "0,25 18,20 36,18 54,29 72,19 90,24 108,16 126,18 144,25 162,21 180,13 198,16 216,8",
  },
  {
    name: "SCFI",
    badge: "상승 +3~7%",
    tone: "hot",
    evidence: "근거 · 4 / 5",
    next: "다음 확인 · 6/11 (수)",
    thesis: "아시아 수출 수요 개선과 선사 GRI 영향",
    points: "0,32 18,20 36,26 54,18 72,28 90,15 108,23 126,13 144,21 162,16 180,20 198,11 216,5",
  },
  {
    name: "KCCI",
    badge: "상승 +2~6%",
    tone: "up",
    evidence: "근거 · 3 / 5",
    next: "다음 확인 · 6/11 (수)",
    thesis: "내수 부진 완화, 컨선 수급 타이트 지속",
    points: "0,34 18,24 36,18 54,29 72,23 90,16 108,22 126,12 144,18 162,25 180,17 198,21 216,11",
  },
  {
    name: "부산 → 뉴욕",
    badge: "상승 +4~8%",
    tone: "hot",
    evidence: "근거 · 4 / 5",
    next: "다음 확인 · 6/12 (목)",
    thesis: "북미 수요 강세 및 일정 차질로 운임 상승",
    points: "0,34 18,28 36,24 54,14 72,20 90,16 108,19 126,12 144,18 162,12 180,15 198,9 216,13",
  },
  {
    name: "부산 → 로테르담",
    badge: "보합권 0~3%",
    tone: "flat",
    evidence: "근거 · 2 / 5",
    next: "다음 확인 · 6/12 (목)",
    thesis: "수요 보합, 운항 안정으로 제한적 변동",
    points: "0,24 18,18 36,25 54,22 72,29 90,21 108,24 126,17 144,26 162,20 180,24 198,17 216,14",
  },
];

const toneColor: Record<Tone, string> = {
  up: "#16a365",
  flat: "#f59e0b",
  hot: "#ef4444",
};

function ForecastCard({ item }: { item: Forecast }) {
  return (
    <article className={`forecast-card ${item.selected ? "selected" : ""}`}>
      <div className="forecast-top">
        <div className="forecast-name">{item.name}</div>
        <span className={`badge ${item.tone}`}>{item.badge}</span>
      </div>
      <div className="evidence">{item.evidence}</div>
      <svg className="sparkline" viewBox="0 0 220 42">
        <polyline
          points={item.points}
          fill="none"
          stroke={toneColor[item.tone]}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <div className="next">{item.next}</div>
      <div className="thesis">{item.thesis}</div>
    </article>
  );
}

export default function LogisightForecastMockup() {
  return (
    <div className="logisight-page">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />Logisight</div>
        <nav className="nav">
          <a>홈</a><a>뉴스</a><a className="active">전망</a><a>산업별⌄</a>
        </nav>
        <div className="top-actions">
          <div className="command"><span>⌕</span><span>검색 또는 명령어 입력 (예: WCI 전망)</span><span className="kbd">⌘K</span></div>
          <div className="icon-text">☆ 즐겨찾기</div>
          <div className="icon-text">⌂</div>
          <div className="avatar">LS</div>
        </div>
      </header>

      <div className="tabs">
        {["종합", "운임", "무역", "정책", "유라시아"].map((tab, i) => <span key={tab} className={`tab ${i === 0 ? "active" : ""}`}>{tab}</span>)}
      </div>

      <section className="hero">
        <div className="ship"><div className="containers">{Array.from({ length: 16 }).map((_, i) => <span key={i} className="container-box" />)}</div><div className="hull" /></div>
        <div className="hero-content">
          <h1>물류 시장 전망</h1>
          <p>정량 모델(팩터 스코어)과 에디터 검토를 결합해 향후 2–4주간의 시장 방향성을 제시합니다.</p>
          <div className="updated-chip"><strong>▣ 최종 업데이트</strong><span>2025. 05. 28 (수) 09:00 KST</span></div>
        </div>
      </section>

      <main className="content">
        <section className="kpi-strip">
          {[
            ["적중률", "76%", "(34/45)", "최근 12주 · 방향 정확도", "◎"],
            ["Published", "24", "건", "이번 주 발간 전망", "▤"],
            ["판정 대기", "8", "건", "확인 대기 중인 전망", "⌛"],
            ["평균 리드타임", "16.2", "일", "모델 신호 → 발간", "◷"],
            ["신뢰도 (Avg.)", "3.4", "/ 5", "전체 전망 평균 근거", "♢"],
          ].map(([label, value, suffix, caption, icon]) => (
            <div className="kpi" key={label}>
              <div><div className="kpi-label">{label}</div><div className="kpi-value">{value} <small>{suffix}</small></div><div className="kpi-caption">{caption}</div></div><div className="kpi-icon">{icon}</div>
            </div>
          ))}
        </section>

        <section className="main-grid">
          <aside className="panel filter-panel">
            <h3 className="panel-title">필터</h3>
            <div className="filter-group"><div className="filter-label">기간</div><div className="segmented"><span className="active">주간</span><span>월간</span></div></div>
            <div className="filter-group"><div className="filter-label">상태</div><div className="status-row"><span className="status-ico up">↗</span>상승</div><div className="status-row"><span className="status-ico flat">→</span>보합</div><div className="status-row"><span className="status-ico down">↘</span>하락</div></div>
            <div className="filter-group"><div className="filter-label">출처</div>{[["관세청", "12"], ["Drewry", "12"], ["상하이해운거래소", "10"], ["Clarksons", "8"], ["기타", "6"]].map(([name, count]) => <div className="source-row" key={name}><span className="checkbox" /><span>{name}</span><span className="count">{count}</span></div>)}</div>
            <div className="reset">⟳ 필터 초기화</div>
          </aside>

          <section>
            <div className="center-head"><h2>전망 카드</h2><button className="sort-btn">정렬: 중요도 순⌄</button></div>
            <div className="card-grid">{forecasts.map((item) => <ForecastCard key={item.name} item={item} />)}</div>
            <article className="analysis-card">
              <div><div className="verdict-title">WCI · 주간</div><div className="verdict-badge">보합권<span>0~2%</span></div><div className="mini-meta">근거 · 3 / 5<br />● ● ● ○ ○<br />▣ 다음 확인 · 6/11 (수)</div></div>
              <div className="chart-wrap"><div className="chart-legend"><span><i className="legend-line" />실제</span><span><i className="legend-dash" />모델 전망</span><span><i className="legend-band" />예측 범위</span></div><svg className="big-chart" viewBox="0 0 360 150" preserveAspectRatio="none"><path d="M244,84 L272,71 L304,54 L334,67 L356,62 L356,101 L334,106 L304,93 L272,104 L244,113 Z" fill="#dbeafe" opacity=".95" /><polyline points="0,95 32,87 60,92 91,77 122,63 152,48 183,59 214,78 244,84" fill="none" stroke="#0b2b51" strokeWidth="3" /><polyline points="244,84 272,71 304,54 334,67 356,62" fill="none" stroke="#2f80ed" strokeWidth="3" strokeDasharray="7 6" /><line x1="244" y1="8" x2="244" y2="144" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" /><text x="250" y="136" fill="#64748b" fontSize="10">전망 구간</text><text x="0" y="146" fill="#64748b" fontSize="10">Nov ’24</text><text x="75" y="146" fill="#64748b" fontSize="10">Jan ’25</text><text x="150" y="146" fill="#64748b" fontSize="10">Mar ’25</text><text x="225" y="146" fill="#64748b" fontSize="10">May ’25</text><text x="304" y="146" fill="#64748b" fontSize="10">Jun ’25(E)</text></svg></div>
              <div className="insights"><h3>핵심 인사이트</h3><ol><li>아시아–유럽/미주 수요 회복 조짐이나 운항 안정으로 운임 박스권 지속.</li><li>선복량은 전주 대비 소폭 증가로 공급 부담 완화.</li><li>BAF 하향 안정 및 연료가격 하락으로 비용 압력 완화.</li></ol><h3>시나리오 코멘트</h3><div className="scenario-row"><span className="dot red" /><span>상승 시나리오 35%: 성수기 앞둔 수요 가속, GRI 확대</span></div><div className="scenario-row"><span className="dot amber" /><span>보합 시나리오 45%: 수급 균형 유지, 범위 내 등락</span></div><div className="scenario-row"><span className="dot green" /><span>하락 시나리오 20%: 공급 과잉 확대, 수요 둔화 지속</span></div></div>
              <div className="calendar"><h3>이벤트 캘린더</h3><div className="event"><strong>6/11 (수)</strong>관세청<br />수출입 동향 (5월)</div><div className="event"><strong>6/12 (목)</strong>Drewry<br />주간 운임 보고서</div><a>전체 캘린더 보기 →</a></div>
            </article>
          </section>

          <aside className="panel analyst-panel">
            <h3 className="panel-title">분석자 패널</h3>
            <div className="panel-tabs"><span className="active">모델 인사이트</span><span>에디터 코멘트</span></div>
            <div className="subhead"><span>팩터 스코어 (WCI)</span><span>근거 · 3 / 5</span></div>
            {[["모멘텀", "pos", "22%", "+0.6"], ["공급 (선복)", "neg", "9%", "-0.2"], ["수요", "pos", "30%", "+0.7"], ["비용", "pos", "7%", "+0.1"], ["가격", "neg", "14%", "-0.3"]].map(([name, sign, width, value]) => <div className="factor-row" key={name}><span>{name}</span><div className="factor-track"><span className={`factor-fill ${sign}`} style={{ width }} /></div><span className={`value ${sign}`}>{value}</span></div>)}
            <div className="scale"><span>-2</span><span>-1</span><span>0</span><span>+1</span><span>+2</span></div>
            <div className="subhead"><span>시나리오 확률 (2~4주)</span></div>
            <div className="donut-row"><div className="donut" /><div><div className="legend-row"><span className="dot red" /><span>상승</span><strong>35%</strong></div><div className="legend-row"><span className="dot amber" /><span>보합</span><strong>45%</strong></div><div className="legend-row"><span className="dot green" /><span>하락</span><strong>20%</strong></div></div></div>
            <div className="subhead"><span>주요 데이터 출처</span></div>
            <div className="source-badges"><div className="source-badge"><strong>관세청</strong>업데이트 5/28</div><div className="source-badge"><strong>Drewry</strong>업데이트 5/27</div><div className="source-badge"><strong>상하이해운거래소</strong>업데이트 5/28</div></div>
            <div className="more">더보기 →</div>
            <div className="risk"><div className="risk-title">리스크 노트</div><div className="risk-note">⚠ 미중 관세 협상 변동성, 홍해/파나마 운항 차질 재발, 연료가격 급등 시 방향성 왜곡 가능.</div></div>
          </aside>
        </section>

        <section className="method-card">
          <div><div className="method-title">모델 방법론</div><div className="method-desc">5개 핵심 팩터를 표준화하여 가중 합산한 스코어와 시나리오 분석을 통해 2–4주간의 방향성을 산출합니다.</div></div>
          <div className="steps"><div className="step"><div className="step-icon">⚙</div>데이터 수집<br /><span className="muted">50+ 지표</span></div><div className="step"><div className="step-icon">⌕</div>팩터 변환<br /><span className="muted">Z-Score</span></div><div className="step"><div className="step-icon">◔</div>가중 스코어링<br /><span className="muted">-2 ~ +2</span></div><div className="step"><div className="step-icon">▱</div>시나리오 분석<br /><span className="muted">확률 산출</span></div><div className="step"><div className="step-icon">✓</div>에디터 검토<br /><span className="muted">최종 발간</span></div></div>
          <div><div className="method-title">가중치 안내 (WCI 기준)</div><div className="weight-list"><span><span className="dot amber" /> 모멘텀 · 25%</span><span><span className="dot red" /> 비용 · 15%</span><span><span className="dot green" /> 공급 · 20%</span><span><span className="dot" /> 가격 · 15%</span><span><span className="dot amber" /> 수요 · 25%</span></div></div>
        </section>
        <div className="disclaimer">본 전망은 정보 제공을 목적으로 하며, 투자 권유가 아닙니다. 실제 시장은 다양한 요인에 의해 달라질 수 있습니다.</div>
      </main>
    </div>
  );
}
