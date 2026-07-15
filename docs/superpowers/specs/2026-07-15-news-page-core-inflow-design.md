# 뉴스 페이지 — 핵심 유입 페이지 개편 (설계)

- 날짜: 2026-07-15
- 범위: **프론트 표시부만** (logisight-core 저장소)
- 접근법: A안(가산적/외과적) — 기존 편집 레이아웃 유지, 정보 요소만 추가

## 목표

뉴스 페이지(`/news`)를 사이트의 핵심 유입 페이지로 만든다. 두 가지:
1. 상단에 사이트 역할을 설명하는 한 줄 추가.
2. 뉴스 카드가 표준 정보 세트를 갖추도록 **읽는 시간**과 **주요 배지**를 추가.

기존 5요소(카테고리·한국어 제목·요약·출처·발행일)는 이미 표시 중이므로, 이번 작업은 나머지 2요소를 **추가**하는 것이 핵심이다. 전면 재설계 아님.

## 비목표 (이 저장소 범위 밖)

아래는 뉴스 생성·선별 **파이프라인 저장소**(`iskkang/logisight`, `C:\Users\DELL\Documents\logisight`) 몫이며, 이번 프론트 작업에서 구현하지 않는다. 파이프라인 작업 시 참고용으로만 기록한다.

- **기사 선별 기준 강화** — 아래 유형을 축소하고 하루 10–20개 중요 뉴스 엄선:
  - 현지 업체의 단순 인사 뉴스
  - 수상·홍보성 보도자료
  - 한국 독자에게 영향 없는 소규모 서비스 출시
  - 같은 사건을 반복하는 기사
  - 물류와 직접 관련 없는 일반 경제 뉴스
- **전용 `shipper_impact` 필드** — "한국 화주 영향"을 정밀 판정하려면 파이프라인에서 플래그를 채워야 함(백로그). 프론트에서 임의 판정은 CLAUDE.md 하드 제약 위반이므로 금지.

## 현재 상태 (근거)

- 라우트: `src/routes/news.tsx` — lead / secondary / opinion(기획·심층) / grid(더 많은 보도) / wire(실시간 와이어) 편집 레이아웃. 공유 헬퍼 `Byline`(출처·발행일), `KickerCat`(카테고리).
- 상단: `src/components/news-page/LogisightNewsTop.tsx` — 데스크 헤더("마켓 데스크 · 날짜") + 기간 세그먼트 + 카테고리 탭 + "이번 주 주목" 자동 선정 픽. 자체 포함 스타일(`.lsgn-root`).
- 데이터: `src/lib/api/news.ts`의 `NewsItem`, `src/lib/api/news.functions.ts`의 `getLatestNews` 서버 함수. `maritime_news` 테이블 컬럼: `category, title, summary, url, source, image_url, published_at, tags[], is_hero, agent_type, content` 등.
  - `content`는 SELECT에 포함되나 클라이언트 전송 직전 삭제됨(외부 봇차단 소스 필터 용도).
  - `is_hero`(불리언)는 뉴스 페이지에서 현재 미사용.
  - 저장된 읽는 시간 필드 없음.
  - 내부/외부 판별: `isInternalNewsItem(item)` = `slug` 있고 `agent_type !== 'external'`. 내부는 `/article/$slug`로, 외부는 원문 `url`(새 탭)로 연결.

## 설계

### 1. 상단 설명

`LogisightNewsTop`에 옵셔널 `intro?: string` prop 추가. 데스크 헤더 아래 한 줄로 렌더(전체 폭, 본문색 ~13–14px). `news.tsx`에서 다음 문구 전달:

> 글로벌 물류·해운·항공·철도·무역 뉴스를 선별해 한국어로 전달합니다.

`.lsgn-root` 스타일에 최소 규칙 추가(예: `.intro`). prop 미전달 시 렌더 안 함(기존 사용처 무영향).

### 2. 읽는 시간 (내부 기사만)

- `NewsItem`에 `read_minutes: number | null` 추가.
- `getLatestNews` 핸들러에서 `content` 삭제 **직전** 계산:
  - 내부 기사(`isInternalNewsItem`)이고 `content`가 있으면: 마크업/HTML 제거 후 글자수 기준 분 계산 → `Math.max(1, Math.round(len / CHARS_PER_MIN))`. 상수는 한국어 기준 합리값(예: 500자/분).
  - 외부 기사 또는 content 없음: `null`.
- 공유 `Byline`에서 `read_minutes != null`일 때만 `· {n}분` 추가.
- 데이터 없으면 표기 생략(더미 금지 — CLAUDE.md).

CHARS_PER_MIN 상수 및 마크업 제거 방식은 구현 계획에서 확정. `read_minutes`는 옵셔널이 아닌 `number | null`(항상 존재)로 두어 타입 일관성 유지. 홈(`LogisightHome`)도 같은 쿼리를 쓰지만 값 미사용 → 무영향.

### 3. 주요 배지

- `is_hero === true`일 때만 표시하는 소형 `주요` 배지 컴포넌트 신설(navy/cyan 계열, 기존 카드 톤과 조화).
- 배치: lead · secondary · grid 카드의 kicker(카테고리) 옆.
- wire(컴팩트 리스트)·opinion strip에는 미표시 — "중요 기사에만".

### 4. 카드 정보 세트 (변경 후)

카테고리 · 한국어 제목 · 요약 · `By 출처 · 발행일 [· N분]` · [주요 배지]

- 5요소는 기존 유지. 신규는 읽는 시간(내부)·주요 배지 2개.
- 요약은 카드별 기존 clamp 유지(모든 카드에 상세를 많이 넣지 않는다는 지시 준수).

## 파일 영향 범위

- `src/components/news-page/LogisightNewsTop.tsx` — `intro` prop + 스타일 한 줄.
- `src/routes/news.tsx` — `intro` 전달, `Byline`에 읽는 시간, `주요` 배지 컴포넌트 추가·배치.
- `src/lib/api/news.ts` — `NewsItem.read_minutes` 추가.
- `src/lib/api/news.functions.ts` — 서버측 `read_minutes` 계산.

## 성공 기준

- `/news` 상단에 설명 문구가 보인다.
- 내부 기사 카드 byline에 `· N분`이 붙고, 외부 기사엔 붙지 않는다.
- `is_hero` 기사에만 `주요` 배지가 lead/secondary/grid에 보인다.
- 기존 `/news`, `/article`, 홈 뉴스 섹션 회귀 없음(타입체크 통과, 렌더 정상).
- 더미/임의 수치 없음 — 읽는 시간·배지 모두 실데이터 근거.

## 제약 준수 (CLAUDE.md)

- 더미·임의 수치 금지 → 읽는 시간은 실 content 계산, 없으면 생략. 배지는 실 `is_hero`.
- 외과적 변경 → 기존 레이아웃/카드 변형 유지, 요소만 추가.
- 기존 `/news`·`/article` 기능 회귀 금지.
- 개인화 없음 → 사용자별 상태 도입 안 함.
