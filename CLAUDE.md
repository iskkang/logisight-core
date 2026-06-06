# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Logisight Hard Constraints (작업 지시문 v1.0)

These override any default behavior. Violations are deployment blockers.

**Data safety**
- `shipment_legs` 원본 노출 금지 — 화면·API·로그 전부. 집계(delay_index_weekly) 표시만 허용.
- 더미·임의 수치로 실데이터 행세 금지 — 데이터 없으면 "데이터 수집 중" 표시.

**Unit & display rules**
- 항공 운임 USD 단독 표기 금지 — 표기 4요소 필수: `USD/kg값 + KRW환산 + 적용환율 + 환율기준일`.
- `kita_air_rates`의 `kg100/300/500`은 USD/kg 원본 (KITA 발표 원본, 변환값 아님). 정렬·백분위·MoM은 USD 기준.
- `chg100/300/500`, `teu_chg/feu_chg`는 MoM 변동률(%). `±X%` 형식으로 표시.
- Ocean(해상)과 Air(항공)는 절대 단일 정렬 테이블에 혼합 금지 — mode-group 분리 필수.

**Methodology constraints**
- SCFI 선행·후행 표시 금지 (방법론 미확정). 상관/정합/추정 표현만 허용.
- 인과 단정 문구 금지 (`~때문에` 불가 → `~와 정합`, `~추정`, `~상관` 표현 사용).

**Infrastructure**
- `data.go.kr` 계열 API 키: Encoding 키 그대로 사용, `encodeURIComponent` 추가 금지.
- GitHub Actions 워크플로 파일 병합 금지 — 책임별 1파일 유지.

**Personalization (개인화 제거 — v1.1)**
- 사용자별 상태 없음. Watchlist·저장된 화면·`WatchlistStore`·필터 `localStorage` 전부 금지. 화면 상태는 URL 쿼리만으로 결정.
- `/dashboard` 주요 노선은 코드 상수 `KEY_LANES`(MTL 선정, 전체 방문자 공통). 범위 토글 없음, admin 편집은 백로그.
- 경보 영향 노선 수는 `경보 영향 노선 ∩ KEY_LANES`로 계산("영향 주요 노선 수").
- 모든 방문자가 동일 화면 → 대시보드 라우트는 사용자 무관 SSR 캐싱 가능(캐시 전략에 반영).

**Scope**
- 이 작업 지시문 범위 밖 리팩터링·라이브러리 교체·페이지 삭제 금지.
- 기존 `/news`, `/article`, `/industries` 기능 회귀 금지.
