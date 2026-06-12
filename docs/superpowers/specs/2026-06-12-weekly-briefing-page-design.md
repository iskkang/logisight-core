# 주간 브리핑 전용 페이지 설계 (logisight-core)

**날짜:** 2026-06-12
**상태:** 승인됨 (2026-06-12)
**레포:** logisight-core (프론트엔드, TanStack Start + Vite)

## 목표

파이프라인이 매주 `weekly_briefings.content`(주간 분석 본문)와 헤드라인 3건을 생성·저장하는데,
현재 프론트엔드는 본문을 어디에도 렌더링하지 않고 홈 카드의 "전체 분석 읽기 →"는 `/news`로
연결된다. 전용 `/briefing` 페이지를 만들어 본문을 표시하고, 홈 카드 링크를 그 페이지로 바꾼다.

## 배경 (기존 자산, 변경 없음)

- 서버 함수 `getLatestBriefing` ([src/lib/api/briefing.functions.ts])은 이미 최신 1건의
  `weekly_briefings`(id,title,subtitle,week_of,content,published_at) + `weekly_briefing_points`
  (category,agent_type,headline,display_order)를 함께 반환한다.
- `latestBriefingQueryOptions()` ([src/lib/api/briefing.ts])로 react-query 캐싱.
- 홈 `WeeklyBriefingBlock` ([src/routes/index.tsx])이 이미 같은 데이터로 헤드라인 3개를 렌더링.
- `react-markdown`(^10) 의존성 존재. 기사 페이지([src/routes/article.$slug.tsx])가 `prose`
  클래스 + ReactMarkdown으로 본문을 렌더하는 패턴 보유.

→ **API/서버 함수 추가 없음.** 기존 쿼리를 재사용해 페이지만 추가한다.

## 데이터 흐름

```
weekly_briefings + weekly_briefing_points (DB)
  → getLatestBriefing() (기존 서버 함수)
  → /briefing 라우트 loader (ensureQueryData)
  → BriefingPage 렌더 (헤드라인 3개 + content 마크다운)
```

## 컴포넌트 설계

### 신규: `src/routes/briefing.tsx` (`/briefing`)

- `createFileRoute("/briefing")`.
- `loader`: `context.queryClient.ensureQueryData(latestBriefingQueryOptions())`.
- `head()`: SEO 메타 — title "주간 시장 브리핑 — Logisight", description = `briefing.subtitle`
  (없으면 title). canonical `https://logisight-core.lovable.app/briefing`.
- `component: BriefingPage` (article.$slug.tsx의 레이아웃 토큰 재사용, `mx-auto max-w-3xl px-4 py-10`).

페이지 구조:
1. **헤더** — "주간 인사이트" 배지(홈 카드와 동일 스타일: `bg navy-900 / color cyan`),
   `briefing.title`(없으면 "주간 시장 브리핑"), `briefing.subtitle`, `week_of`/`published_at`
   날짜(`formatBriefingDate`).
2. **헤드라인 요약 블록** — `["shipping","corp","brief"]` 순회, 각 슬롯에 대해
   `points.find(p => p.agent_type === cat) ?? points.find(p => p.category === cat)`로 매칭
   (홈 카드와 동일 로직). 라벨 맵 `{ shipping:"시황", corp:"기업", brief:"글로벌" }`.
   매칭 없으면 "수집 예정". 카드형 그리드.
3. **분석 본문** — `briefing.content`가 있으면 `<ReactMarkdown>`로 `prose` 렌더
   (기사 페이지와 동일: `lineHeight:1.8, wordBreak:keep-all`). 없으면
   "이번 주 분석은 준비 중입니다" 안내 박스.
4. **빈 상태** — `briefing`이 null이면 "이번 주 브리핑 준비 중 · 매주 월요일 발행" 안내.

라벨 맵은 홈 카드와 중복되나 작은 상수 1개라 공유 추출하지 않는다(YAGNI).

### 수정: `src/routes/index.tsx`

`WeeklyBriefingBlock`의 "전체 분석 읽기 →" 링크 한 곳:
- `<Link to="/news">` → `<Link to="/briefing">`.

## 스코프 밖

- 아카이브(주차 네비게이션 `/briefing/$week_of`) — 추후.
- points → 원문 기사 링크 — 스키마에 url 없음.
- weekly-newsletter.yml 현대화 — 별개.
- 라벨 맵 공유 컴포넌트 추출 — YAGNI.

## 검증 기준

1. `npm run build`(vite build) 통과, 타입 에러 없음.
2. `/briefing` 접속 시 헤더 + 헤드라인 3개 + 분석 본문(content)이 표시된다.
3. 홈의 "전체 분석 읽기 →"가 `/briefing`으로 이동한다.
4. content가 없는 주에는 본문 자리에 "준비 중" 안내가 뜨고 페이지가 깨지지 않는다.
5. briefing 자체가 없을 때 빈 상태 안내가 뜬다.
