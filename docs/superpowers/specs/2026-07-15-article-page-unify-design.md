# 뉴스 기사 페이지 통일 (설계)

- 날짜: 2026-07-15
- 범위: 뉴스 기사 상세(`/article/$slug`)만. `LogisightArticle` 컴포넌트는 브리핑도 재사용하므로 **prop opt-in**으로 뉴스에만 적용(브리핑 무영향).

## 목표

모든 뉴스 기사 상세를 동일 형식으로 통일한다.

- **기사 상단**: 카테고리 + 한국어 제목 + Logisight 등록일
- **기사 하단**: 동일한 레포트 유도 CTA(뉴스레터 안내 대신 레포트로 직접 연결)

## 근거 (탐색 결과)

- `LogisightArticle`은 `article.$slug.tsx`와 `briefing.tsx`(2곳)에서 재사용. 브리핑 회귀 방지를 위해 새 동작은 prop으로만 켠다.
- 내부 기사(slug 있음)는 `maritime_news.published_at`이 **NULL**, `fetched_at`만 실값. 현재 기사 상단 날짜가 "—"로 표시됨 → "Logisight 등록일"은 `fetched_at`이 정확하며 이 변경이 날짜 누락도 해결.
- 현재 상단 `.meta`는 해외 출처 아바타+이름을 먼저 노출. 하단 `.sharebar`는 "매주 물류 브리핑 받아보세요"(뉴스레터성) 문구 + 공유 버튼.

## 설계

### 1. 상단 — Logisight 등록일 헤더

- `Article`에 `registered_at?: string | null` 추가(포맷된 날짜 문자열).
- `registered_at`이 있으면 상단 바이라인을 Logisight 브랜드로 전환:
  - 이름 `Logisight`, 날짜줄 `등록 {registered_at} · 읽는 시간 약 N분`, 아바타 `L`.
  - 해외 출처 아바타/이름은 상단에 표시하지 않음.
- 해외 원출처 귀속은 기존 본문 하단 `.srcblk`(출처 · origin · 원문 링크)에 그대로 유지.
- `registered_at` 미전달 시(브리핑) 기존 바이라인(source + published_at) 유지.

### 2. 하단 — 레포트 유도 CTA

- Props에 `reportCta?: { heading: string; body: string; buttonLabel: string }` 추가.
- 있으면 본문 하단(태그 다음, 공유바 앞)에 CTA 밴드 렌더:
  - heading: 이 뉴스가 운임과 공급망에 미치는 영향은?
  - body: 이번 주 Logisight 레포트에서 주요 노선 전망과 대응 포인트를 확인하세요.
  - 버튼: 이번 주 레포트 보기 → `/reports` (`<Link to="/reports">`, `.lsg-root` 스코프 스타일)
- `reportCta` 있으면 기존 `.sharebar`의 뉴스레터 문구 제거(공유 버튼은 유지, 라벨은 "이 기사 공유하기").
- `reportCta` 미전달 시(브리핑) 기존 공유바 유지.

### 3. 데이터 배선

- `article.functions.ts` SELECT에 `fetched_at` 추가.
- `article.ts`: `Article = NewsItem & { content: string | null; fetched_at?: string | null }`.
- `article.$slug.tsx`: `registered_at: formatPublishedAt(article.fetched_at)`, `reportCta`(위 문구) 전달. `source`는 해외 출처 그대로(하단 srcblk용).

## 파일 영향 범위

- `src/components/article-page/LogisightArticle.tsx` — Article.registered_at, Props.reportCta, 브랜드 바이라인, CTA 밴드 + STYLE, 공유바 문구 조건부.
- `src/routes/article.$slug.tsx` — registered_at·reportCta 전달.
- `src/lib/api/article.ts` — Article 타입에 fetched_at.
- `src/lib/api/article.functions.ts` — SELECT에 fetched_at.

## 성공 기준

- 뉴스 기사 상단: 카테고리·제목·`Logisight 등록 {날짜}`가 보이고, 내부 기사도 날짜가 "—"가 아니다.
- 뉴스 기사 하단: 지정 문구의 레포트 CTA + "이번 주 레포트 보기"(→/reports) 버튼. 뉴스레터 문구 없음.
- 브리핑 페이지 상단/하단 변화 없음(회귀 없음).
- 해외 원출처 귀속은 본문 하단 출처 블록에 유지.
- 타입체크·기존 테스트 통과, `/article/:slug` SSR 정상.

## 제약 준수 (CLAUDE.md)

- 더미 금지 → 등록일은 실 `fetched_at`, 없으면 미표기.
- 외과적/회귀 방지 → 새 동작은 prop opt-in, 브리핑 불변.
- 개인화 없음.
