# Phase 6 — 인텔리전스 레이어 (지시문)

**상태:** 지시문 확정 · 단계별 구현 예정
**범위:** 두 저장소 — `logisight-core`(프론트·DB 마이그레이션) + `logisight`(생성 파이프라인·report-authoring-standard)

## 1. 데이터 모델 — `forecasts` 테이블
(마이그레이션: `supabase/migrations/20260606010000_forecasts.sql`)

| 컬럼 | 설명 |
|---|---|
| `module` | `rates`/`eurasia`/`trade`/`policy` |
| `statement` | 전망 본문 |
| `basis` jsonb | 근거 지표·수치 배열 |
| `impact_note` | 화주 영향 번역문(FEU/kg 비용·리드타임) |
| `horizon_date` | 판정 기준일 |
| `confidence` | high/medium/low |
| `invalidation_condition` | 무효 조건(예: 해협 재개방) |
| `status` | draft/published/resolved |
| `outcome` | hit/partial/miss |
| `outcome_note` | 복기 — miss·partial 시 필수 |
| `metric_ref` | 판정용 지표 참조 |
| `published_at` / `resolved_at` | |

발행 후 본문 수정·삭제 불가(무효 조건만 예외) — DB 트리거 `forecasts_guard`로 enforce.

## 2. 생성 파이프라인 (`logisight` 저장소)
- 주간 스크립트: 최신 지표 스냅샷 + `maritime_news` 최근 7일 + 활성 장애·임박 정책을 모아 **Claude API**로 브리프·전망 초안 생성.
- 표준 프롬프트: **현상 → 원인 → 배경 → 전망**. **단정 표현 금지·확률(확신도) 표현 강제**.
- 산출물은 전부 `status='draft'`.

## 3. Admin 검수 큐 (프론트)
- 에디터가 수정·승인해야만 `published`.
- 발행 후 본문 수정·삭제 불가(사전 명시한 무효 조건만 예외).
- 화면에 **"AI 초안 · 에디터 검수" 표기 필수**.

## 4. 판정
- `horizon_date` 도래 시 `metric_ref` 실측값으로 **1차 자동 판정** → admin 확정.
- **적중률은 published 전망 전수 기준**으로 계산 — 표본에서 빼는 것 금지.

## 5. 노출 (프론트)
- 종합 화면 **"오늘의 종합 판단"** + 각 대시보드 인텔리전스 브리프를 이 파이프라인 산출물로 채움.
- **전망 트래킹 모듈은 Rates·Eurasia에 우선 배치.**
- **적중률 요약은 종합 화면 푸터에도 표시.**

## 6. report-authoring-standard 추가 (독자 단위 번역 규칙)
모든 전망에 **3단 변환** 포함 필수:
**지수 변화 → FEU/kg당 비용·리드타임 영향 → 권장 행동 1개**

## 구현 순서(제안)
1. ✅ `forecasts` 마이그레이션 (이 저장소)
2. Admin 검수 큐 + RLS/auth (프론트) — 발행·판정 워크플로
3. 노출: 종합 "오늘의 종합 판단" + Rates/Eurasia 전망 트래킹 + 적중률 푸터 (프론트, published만)
4. 생성 파이프라인 주간 스크립트 + Claude API (`logisight` 저장소)
5. 자동 1차 판정 잡 + report-authoring-standard 3단 규칙 (`logisight` 저장소)
