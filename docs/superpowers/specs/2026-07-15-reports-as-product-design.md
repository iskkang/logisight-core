# 주간 레포트 독립 상품화 (설계)

- 날짜: 2026-07-15
- 범위: 프론트 라우팅·표시(logisight-core). 데이터는 기존 테이블 read만, 파이프라인 변경 없음.

## 목표

가변 단일 `/briefing` 대신, 발행물마다 영구 URL을 갖는 레포트 상품으로 전환.

- `/reports/weekly/{week_of}` — 주간 발행물별 영구 페이지 (예: `/reports/weekly/2026-07-13`)
- `/reports/monthly/{YYYY-MM}` — 월간 발행물별 페이지 (예: `/reports/monthly/2026-07`)
- `/reports` — 전체 레포트 목록

## 근거 (탐색 결과)

- `weekly_briefings` 테이블: 주간 브리핑 **웹 기사 본문**(title·subtitle·week_of·content) + `weekly_briefing_points`(시황·기업·글로벌 3포인트). **이력 보존됨**(7주치: week_of 07-13, 07-06, 06-29 …). 현재 `/briefing`이 최신 1건만 렌더.
- `reports` 테이블: **PDF 카탈로그**(type=weekly/weekly-region/monthly, 전부 web_url=null → PDF만). 월간(2026년 7월호) 포함. 현재 `/reports`가 표지 카드+아카이브로 렌더.
- 사용자 예시 주간 날짜가 `weekly_briefings.week_of`와 일치 → 주간 상품 = weekly_briefings(웹 기사).
- 월간은 웹 본문 없음 → PDF 랜딩으로 처리.
- 라우팅: TanStack Start 파일 라우팅. `reports.tsx`(목록)를 건드리지 않도록 언더스코어 un-nest(`reports_.weekly.$week.tsx`) 사용, routeTree 생성으로 검증.

## 설계

### 1. 주간 영구 페이지 — `/reports/weekly/$week`

- 파일: `src/routes/reports_.weekly.$week.tsx`.
- loader: `week` 파라미터로 `weekly_briefings` 행 + points 조회. 없으면 `notFound()`.
- 렌더: `briefing.tsx`의 기사 매핑 로직을 공유 컴포넌트 `WeeklyBriefingView`로 추출해 재사용(LogisightArticle). breadcrumb: 홈 › 리포트 › 주간.
- SEO: 제목·설명은 해당 주차 기준.

### 2. 월간 영구 페이지 — `/reports/monthly/$month`

- 파일: `src/routes/reports_.monthly.$month.tsx`.
- loader: `month`(YYYY-MM)로 `reports` 테이블 type=monthly, period_start 해당 월 범위 조회. 없으면 `notFound()`.
- 렌더: **PDF 랜딩** — 표지(cover_url)·제목(period_label)·요약·발행일 + "PDF 다운로드"(pdf_url) 버튼. 웹 본문 없음(정직하게 PDF 중심). HomeNav/HomeFooter 포함.

### 3. `/briefing` 리다이렉트

- `beforeLoad`에서 최신 `weekly_briefings.week_of` 조회 → `/reports/weekly/{latest}`로 redirect. 최신 없으면 `/reports`로.
- 기존 유입 링크·SEO 보존(302).

### 4. `/reports` 목록 — 주간 발행물 섹션 추가

- 기존 PDF 카탈로그(LogisightReports) 유지.
- `weekly_briefings` 발행물 목록을 영구링크(`/reports/weekly/{week}`)로 나열하는 "주간 브리핑 아카이브" 섹션 추가(LogisightReports prop 또는 reports.tsx 섹션).
- reports.tsx loader에 주간 목록 쿼리 추가.

### 5. 기사 하단 CTA 재연결

- `LogisightArticle`의 레포트 CTA 링크 `/reports` → `/briefing`(최신 별칭 → 최신 주간 영구링크로 리다이렉트). 기사마다 별도 쿼리 없이 항상 최신 주간 연결.
- 홈 히어로 "이번 주 레포트 보기"(→/reports 목록)는 이번 범위에서 변경 안 함.

### 6. 데이터 배선 (기존 테이블 read)

- `briefing.functions.ts`: `getBriefingByWeek(week)`, `listBriefingWeeks()` 추가.
- `briefing.ts`: `briefingByWeekQueryOptions(week)`, `briefingWeeksQueryOptions()` + 목록 타입.
- `reports.functions.ts`: `getMonthlyReport(month)` 추가.
- `reports.ts`: `monthlyReportQueryOptions(month)`.

## 파일 영향 범위

- 신규: `src/routes/reports_.weekly.$week.tsx`, `src/routes/reports_.monthly.$month.tsx`, `src/components/*`(WeeklyBriefingView 추출 위치).
- 수정: `src/routes/briefing.tsx`(리다이렉트), `src/routes/reports.tsx`(목록 섹션+loader), `src/lib/api/briefing.ts`·`briefing.functions.ts`, `src/lib/api/reports.ts`·`reports.functions.ts`, `src/components/article-page/LogisightArticle.tsx`(CTA 링크).

## 성공 기준

- `/reports/weekly/2026-07-13` 등 각 주차가 고유 URL로 기사형 렌더. 없는 주차는 404.
- `/reports/monthly/2026-07`이 PDF 랜딩(표지·요약·PDF 버튼)으로 렌더. 없으면 404.
- `/briefing` → 최신 주간 영구링크로 302.
- `/reports` 목록에 주간 발행물이 영구링크로 노출. 기존 PDF 카탈로그 유지.
- 기사 하단 CTA가 최신 주간 레포트로 연결.
- 타입체크·기존 테스트 통과, 각 라우트 SSR 정상.

## 제약 준수 (CLAUDE.md)

- 더미 금지 → 전부 실 테이블 read, 없으면 404/미표기.
- 외과적/회귀 방지 → reports 목록·PDF 카탈로그·briefing 렌더 로직 보존(공유 추출).
- 개인화 없음 → URL만으로 화면 결정(발행물별 URL). SSR 캐시 가능.
- 발행물 생성·월간 웹 본문 = 파이프라인 범위(이 작업 밖).
