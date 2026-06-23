# 홈 리디자인 — 샘플(LogisightHome) 통합 설계

작성일: 2026-06-22

## 목표

사용자가 제공한 샘플 디자인 코드(`LogisightHome.tsx`)를 메인페이지(`/`)에 적용한다.
샘플의 더미 배열을 **기존 Supabase/API query options**(실데이터)에 연결하고, 샘플의
`href="#"` 링크를 실제 라우트에 연결한다.

### 사용자 제약(이번 작업 한정)
- 샘플의 **header / footer / 메뉴·카드의 문장(카피)** 은 변경하지 않는다.
- 인사이트 하위 메뉴(SUB_GNB)는 샘플에 없으므로 **기존대로 별도 구성**해 홈 Nav에 살린다.
- 헤더/푸터는 **홈(`/`)에서만 샘플 것을 사용**한다(사이트 전체 교체 아님).
- 데이터 없는 카드(항공 적재율, 항만 혼잡도)는 **실데이터로 대체**한다.

### CLAUDE.md 하드 제약(우선)
- 더미·임의 수치로 실데이터 행세 금지 → 데이터 없으면 "데이터 수집 중".
- 항공 운임 USD 단독 표기 금지(4요소). 단, **MoM(%)는 변동률 표기**라 4요소 대상 아님.
- `shipment_legs` 원본 노출 금지(이번 작업과 무관, 집계만 사용).

> **카피 보존 vs 하드 제약 충돌 해석(확정)**: "문장 변경 금지"는 **디자인 카피(라벨·섹션 제목·
> 상록성 설명·푸터 문구)** 에만 적용한다. 샘플의 **카드 풋노트/브리프 불릿 등 narrative 문장**
> (예: "아시아태평양 수요 +10.5%", "상하이·롱비치 대기 선박 증가", `BRIEF_BULLETS`)은
> **AI 생성물**이어야 하며 **하드코딩 금지**. 소스는 AI가 만든 `latestRatesBrief`
> (`prose_json`/`signals_json`)·계산된 시그널(ocean/global/airModal)·`latestBriefing` points에서
> 가져온다. 해당 AI 산출물이 없으면 **"데이터 수집 중"** 표시(고정 더미 문장 금지). 하드 제약이 우선이다.

## 아키텍처

### 라우팅/레이아웃
- `src/routes/__root.tsx`의 `SiteShell`을 수정: `pathname === "/"` 이면 글로벌
  `<Navigation/>`·`<Footer/>`·`theme-light` 래퍼를 건너뛰고 `<main>{children}</main>`만 렌더.
  → 홈에서 헤더/푸터 2중 렌더 방지. **다른 라우트는 영향 없음**(surgical).
- `src/routes/index.tsx`: Route 정의(loader에서 모든 쿼리 prefetch + head meta) 후 `<LogisightHome/>` 렌더.

### 컴포넌트 파일 구성
- `src/components/home/LogisightHome.tsx` — 샘플 셸 전체(Nav, Ticker, Hero, light sheet, LivePanel,
  Body, Insight, Footer) 조립. 프레젠테이션은 샘플 그대로, 데이터는 `useSuspenseQuery`로 주입.
- 파일이 커지면 `HomeNav.tsx` / `HomeFooter.tsx`로 분리(인사이트 드롭다운·모바일 메뉴 포함).
- 샘플의 `<style>{STYLE}</style>`(lsg-* 애니메이션/클래스)와 색상 arbitrary value는 그대로 사용.
- 데이터 가공 로직은 신규 발명하지 않고 기존 `index.tsx`의 시그널/항공 MoM 계산을 재사용.

### 데이터 흐름
`index.tsx` loader에서 prefetch(`ensureQueryData`):
`indexStatsQueryOptions`, `freightIndicesHistoryQueryOptions`, `latestRatesBriefQueryOptions`,
`alertCandidatesQueryOptions`, `kitaAirRatesQueryOptions`, `riskSnapshotQueryOptions`(신규 추가),
`latestNewsQueryOptions({lang:"ko",limit:12})`, `latestBriefingQueryOptions`.
컴포넌트는 `useSuspenseQuery`로 동일 옵션 구독.

> **트레이드오프**: `riskSnapshotQueryOptions`는 외부 econdb를 호출(현재 `/policy`에서 사용 중).
> 홈이 외부 소스에 의존하게 됨 → 느리거나 비면 항만 카드는 "데이터 수집 중"으로 폴백.

## 더미 → 실데이터 매핑

| 샘플 더미 | 실데이터 | 비고 |
|---|---|---|
| `INDICES` (티커) | `orderedTickerStats(indexStats)` → code/value/changePct | 방향색 up/down/flat, 마퀴 2회 복제 |
| 카드① 운임 FREIGHT | 값=`indexStats(KCCI)` latest_value/change_pct/pct_52w(+history 3주 변화). **풋노트=ocean 시그널 등 AI/계산 narrative** | 라벨만 유지·풋노트 AI/계산, 미가용 "데이터 수집 중" |
| 카드② 항만 PORT | 값=`riskSnapshot.ports[].congestion` 집계. **풋노트=상위 혼잡 항만(실데이터)** | 미가용 시 "데이터 수집 중" |
| 카드③ 리스크 RISK | 값=`alertCandidates.length`. **풋노트=실제 경보 라벨/지역** | 미가용 시 "데이터 수집 중" |
| 카드④ 항공 AIR | 값=`kitaAirRates`→`latestByRoute`+`computeMoM`(kg300, USD MoM%). **풋노트=airModal 시그널 narrative** | 적재율→MoM%로 의미 치환, 4요소 대상 아님 |
| `Brief`/`BRIEF_BULLETS` | **`latestRatesBrief.prose_json`/`signals_json`(AI 생성)** (fresh일 때) | 비fresh 시 "데이터 수집 중"(샘플 더미 불릿 사용 금지) |
| 히어로 칩 | 기준일=KCCI week_date, 활성 리스크=alerts.length | 샘플과 동일 2칩 유지(추가 안 함) |
| 뉴스 featured+그리드+탭 | `latestNews(ko)` + `category` 필터 | 탭=["전체","해상","항공","철도·CIS","물류","무역"] |
| 사이드바 주간 브리핑 | `latestBriefing` points(시황/기업/글로벌) | |
| 뉴스레터 입력 | 기존 `NewsletterForm`(실제 구독 작동) | 샘플 카피 유지, 마크업만 교체 |
| `INSIGHTS` 3카드 | 정적 카피 유지 | 링크만 연결 |
| Footer 컬럼 | 정적(샘플 카피) | 링크만 연결 |

> **스파크라인**: 더미 좌표 대신 실제 시계열에서 그린다(운임=KCCI history, 항공=kg300 series).
> 시계열 없는 카드(항만/리스크)는 스파크 숨김 — 가짜 데이터처럼 보이는 것 방지(하드 제약).

## 링크 매핑 (`href="#"` → 라우트)

| 위치 | → 라우트 |
|---|---|
| Nav 홈/뉴스 | `/` · `/news` |
| Nav 인사이트 | **드롭다운**: SUB_GNB(종합 `/dashboard`, 전망 `/forecasts`, 운임 `/rates`, 유라시아 `/eurasia`, 포트 `/policy`, 무역 `/trade`, 산업 `/industries`, 기후예측 `/climate`) |
| Hero "이번 주 분석 보기" | `/forecasts` (search `{dir:[],series:[]}`) |
| Hero "운임 대시보드 →" | `/rates` |
| "운임 인텔리전스" / Brief 상세 | `/rates` |
| 뉴스 전체 보기 / featured·카드 | `/news` · `/article/$slug`(`articleParam(item)`) |
| 사이드바 브리핑 / 전체 분석 | `/briefing` |
| INSIGHTS 3카드 | 무역 `/trade` · 산업 `/industries` · 리스크 `/policy` (전체 보기 `/industries`) |
| Footer 서비스 | 운임 대시보드 `/rates` · 유라시아 `/eurasia` · 산업별 교역 `/industries` |
| Footer 뉴스 | `/news?cat=해상/항공/철도/무역` |
| Footer MTL | 회사소개 `https://mtlship.com` · 뉴스레터 `#newsletter` · 영업 `mailto:sales@mtlship.com` |

## 인사이트 하위 메뉴(기존대로)
홈 Nav의 "인사이트"는 **드롭다운/모바일 메뉴**로 SUB_GNB 8항목을 노출(기존 Navigation의
`SUB_GNB` 그대로). 라벨·라우트는 `Navigation.tsx`와 동일하게 유지. 데스크톱은 호버/클릭 드롭다운,
모바일은 햄버거 메뉴 안에 인사이트 섹션으로.

## 비목표(out of scope)
- 글로벌 `Navigation.tsx`/`Footer.tsx` 사이트 전체 교체.
- `/news`,`/article`,`/industries` 등 기존 페이지 동작 변경.
- 새 데이터 소스/마이그레이션 추가(기존 query options만 사용).
- 다국어(KOR·ENG) 실제 토글 — 샘플의 정적 표기만 유지.

## 검증 기준
1. `bun run build` 통과(타입/라우트 에러 없음).
2. 홈에서 헤더/푸터가 **1회만** 렌더(2중 아님).
3. 4개 마켓 카드·티커·히어로 칩이 실데이터로 채워지거나 "데이터 수집 중" 표시(고정 더미 없음).
4. 모든 링크가 실제 라우트로 이동(404 없음), 인사이트 드롭다운 8항목 동작.
5. 다른 페이지(`/news`,`/rates`,`/dashboard` 등) 외형·동작 회귀 없음.
