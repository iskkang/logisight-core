# 지역 경보 → 물류 영향 분석 — 설계 문서

> **날짜:** 2026-06-30
> **대상 화면:** `/climate` (세계 기후 예측)
> **관련 레포:** 프론트 = `logisight-core`(이 레포, 표시·검수·게이트), 생성 = `iskkang/logisight`(데이터·AI 파이프라인)
> **선행 문서:** `docs/superpowers/specs/2026-06-23-climate-impact-pipeline-spec.md` (이 설계는 그 문서의 갭 #1·#3·#5를 구체화. #2 이벤트→asset_risk 점수 전파는 **제외**)

## 1. 동기 / 문제

`/climate`에 미국 홍수 같은 지역 경보가 뜨면, 사용자는 **"이게 미국 철도 등 물류와 연관이 있나?"**를 궁금해한다. 현재는:

- 이벤트(`events`)와 물류 자산(`assets`)이 독립 — 경보가 물류 영향으로 연결되지 않음.
- **미 내륙 철도/트럭 거점 자산이 아예 없음** (rail 자산은 전부 유라시아 TCR) → 미 홍수가 붙을 곳이 없음.
- "연관 없음"조차 표시되지 않아, 사용자의 궁금증("이 홍수는 물류와 상관없나?")에 답을 못 함.

**목표:** 새 경보가 뜬 지역이 물류와 연관 있는지 AI가 파악해 사이트에 서술하되, **연관 없을 때("영향 제한적")도 정량으로 답한다.**

## 2. 골격 결정 (승인됨)

- **연결 판단 = 하이브리드(접근 C):** 결정론적 게이트가 후보를 판정 → 통과분만 AI가 3단 서술(draft→검수) → 비통과는 코드가 "영향 제한적" 배지 자동 표시.
- **자산 범위:** 글로벌 내륙 거점 — 큐레이션된 핵심 시드(~12–15개) + 확장 가능 스키마.
- **트리거:** 이벤트 트리거 + 일일 배치.
- **표시:** 이벤트 타임라인 배지(전 이벤트) + 전용 "지역 경보 → 물류 영향" 섹션(연관 이벤트 상세).
- **제외(YAGNI):** 이벤트→`asset_risk` 점수 전파(지구본 색·점수 체계 변경)는 별개 항목으로 남김. 이 기능은 "근접 게이트 + 서술"만 사용.

## 3. 데이터 모델

기존 `assets` 테이블 재사용. **스키마 변경 없음** (assets는 느슨한 타입, CHECK 제약 없음 → 데이터 insert만).

- 새 `type='inland'` 값 추가 (내륙 intermodal/트럭 허브). 기존 `rail`(유라시아 TCR 국경 회랑)과 의미가 달라 분리.
- 컬럼은 기존대로: `id, name, type, lon, lat, freeze_prone`.
- **시드(글로벌 핵심, 검증 좌표, 확장 가능):**
  - 북미: Chicago · Memphis · Dallas · Kansas City · Atlanta · NJ/NY 내륙
  - 유럽: Duisburg · Milan · Madrid 내륙터미널
  - 아시아: Zhengzhou · Delhi 등
- **route 연결 없음(v1).** 내륙 자산은 독립 좌표점. post-port 내륙 구간·노선 귀속은 후속.

**프론트 코드 변경(이 레포):**
- `AssetType`에 `"inland"` 추가 — `src/lib/api/climate.ts`
- `RiskGlobe`의 `TYPE_KO` + 마커 모양에 inland 케이스 (항만 원/초크 마름모/철도 사각 → 내륙 삼각형)

**부수효과 가드:** `forecastQuality.expectedRows = assets.length`. 내륙 자산 추가 후 risk 잡이 그 자산의 `asset_risk` 행을 만들기 전까지는 "일부 자산 누락(warn)"으로 강등됨.
- 정본 해결: **risk 파이프라인이 내륙 자산도 채점**(precip/temp/wind. 파고는 `maritimeIds`가 port·choke만이라 자동 제외).
- 한시 가드(프론트, 회귀 방지): risk 행이 없는 `inland` 자산은 `expectedRows`에서 제외 — `src/lib/climate-quality.ts`.

## 4. 게이트 계약 (결정론 · 프론트·파이프라인 공유 정본)

프론트(배지)와 파이프라인(AI 생성 여부)이 **동일 규칙**을 써야 한다. 두 레포가 모듈을 공유할 수 없으므로 이 절이 정본이며, 프론트는 `src/lib/climate-gate.ts` 한 곳에 집약하고 파이프라인은 이 절을 그대로 구현한다.

**입력:** 이벤트(`lon, lat, severity, kind, source`) · 전체 자산 · 노선 waypoint 좌표

**반경 파라미터:**
- `ASSET_RADIUS_KM = 200` — 점 자산(inland/port/choke/rail) 직접 영향권. (기존 `NEAR_KM=1000`은 내륙 점 자산엔 과도하므로 별도 타이트값)
- `ROUTE_RADIUS_KM = 1000` — 해상 노선 waypoint(태풍 광역 도달, 기존값 재사용)

**severity 처리 — 함정 주의:** 기존 `severityTier()`는 hko/gdacs/meteoalarm만 처리하고 **NWS는 INFO 반환** → 그대로 쓰면 NWS 미국 홍수가 게이트를 통과 못 한다. **게이트는 `severityTier`를 쓰지 않고 이벤트 원본 `severity`('r'/'a')를 사용한다.**

**판정 티어:**

| 티어 | 조건 | 배지 | AI 서술 |
|---|---|---|---|
| `LINKED_HIGH` | `severity='r'` AND 자산(≤200km) 또는 노선(≤1000km) 반경 내 | 🔴 물류 연관 — {자산} 외 N곳 | ✅ 이벤트 트리거 생성 |
| `LINKED_WATCH` | `severity='a'` AND 반경 내 | 🟠 연관 가능 — {자산} | 일일 배치만(여력 시) |
| `LIMITED` | 반경 밖 또는 severity 없음 | ⚪ 영향 제한적 — 최근접 {자산} ~Nkm | ❌ |

**반환값:** `GateVerdict = { tier, nearestAsset, nearestKm, linkedAssets[], linkedRouteIds[] }`. `LIMITED`일 때도 **최근접 자산+거리를 반환**(왜 제한적인지 정량 응답).

**라벨 폴백:** 배지/카드의 "{자산}"은 `linkedAssets[0].name`. 점 자산 없이 노선만 연관된 경우(예: 해상 태풍)는 `linkedRouteIds[0]`의 노선명으로 폴백 표기("{노선} 항로 인근").

**페어링 키:** AI 서술은 이벤트 중심 → `metric_ref = 'climate:event:<event_id>'` (기존 노선 중심 `climate:<route>:<event>:<via>`와 구분). 프론트가 이 키로 배지↔서술 매칭.

## 5. 파이프라인 (logisight 레포 — 설계만, 이 레포 미구현)

CLAUDE.md: AI 생성은 logisight 레포 소관. 이 레포 구현 계획엔 "logisight 후속"으로 표기.

**선행(데이터, 파이프라인/SQL):**
1. 내륙 자산 시드 insert (§3)
2. risk 잡이 내륙 자산도 채점 (precip/temp/wind, 파고 제외)

**트리거 둘:**
- **이벤트 트리거:** events 인제스트 직후 신규 이벤트에 게이트(§4) 적용 → `LINKED_HIGH`이고 forecast 없으면 AI 서술 생성.
- **일일 배치:** 활성 이벤트 전수 게이트 → `LINKED_HIGH` 누락분 + `LINKED_WATCH`(여력 시) 생성.
- **중복 방지:** `metric_ref='climate:event:<id>'` 존재 시 skip.
- **비용 가드:** 1회 실행당 생성 상한 N(예: 20) — 초과분은 **로그로 명시 드롭**(silent cap 금지).

**AI 생성(Claude API, 최신 모델):**
- 입력: 이벤트(제목·종류·severity·지역·좌표·track) + 게이트의 연관 자산(이름·타입·거리)·노선.
- 출력 = Phase-6 **3단 변환**, 기존 프론트 파서 호환:
  - `statement`: `[기상 리스크 변화]\n…\n\n[영향]\n…` (① 기상 변화 → ② FEU/리드타임·항만·내륙 거점 적체 영향)
  - `impact_note`: `[권장 행동] …` (③ 권장 행동 1개)
  - `basis`: `["연관 거점: Chicago 내륙 · 120km", "강도: …", …]`
- **확률 표현 강제, 인과 단정 금지(정합/추정/상관), 더미 수치 금지.**
- `status='draft'` → `/admin/forecasts` 에디터 검수 → published. **프론트는 published만 노출.**

**적중률/판정:** `horizon_date ≈ 이벤트 종료+버퍼`, 에디터 사후 resolve. published 전수 기준(Phase-6). v1 경량 — 자동 채점은 후속.

## 6. 프론트 표시 (이 레포 구현)

백엔드 쿼리 변경 없음 (`getClimateRisk`가 이미 forecasts 반환). 파이프라인 데이터 도착 전 graceful degrade.

### 6.1 게이트 모듈 — `src/lib/climate-gate.ts` (순수 함수)
- 상수 `ASSET_RADIUS_KM`, `ROUTE_RADIUS_KM` 정본.
- `gateEvent(event, assets, routes, nodes): GateVerdict`.
- 자체 haversine 보유. 기존 `nearbyEvents`/`minDistToRoutes`(route 중심·별개 관심사)는 **건드리지 않음**.
- **TDD:** 경계값(199/201km), severity r/a/없음, NWS 케이스, 노선 vs 자산 반경, `LIMITED` 최근접 반환 — 구현 전 테스트 작성.

### 6.2 타임라인 배지 — 전 이벤트 판정
- 기존 `Timeline`(`현재 관측/경보 이벤트`) 각 행에 물류 연관 배지: 🔴 물류 연관 / 🟠 연관 가능 / ⚪ 영향 제한적(— 최근접 {자산} ~Nkm).
- `useMemo`로 events×assets 1회 계산. `LIMITED`도 실제 최근접 거리 정량 표기(더미 없음).

### 6.3 새 섹션 `RegionImpact` — "지역 경보 → 물류 영향"
- 전 이벤트 게이트 → `LINKED_HIGH/WATCH`만 카드화(HIGH 우선, 근접순). `LIMITED`은 타임라인 배지가 담당하므로 섹션 제외.
- published 이벤트 forecast 페어링: `metric_ref` 접두 `climate:event:`로 `fcByEvent` 구성.
- 카드: 이벤트 헤더(이름·severity·지역) + 연관 자산 칩(이름·거리) + AI 3단 서술(있으면 기존 `RouteForecast` 확장 패턴 재사용 — `fcSections`/`fcAction` 파서 그대로) / 없으면 결정론 연결만("영향 분석 검수 중", 더미 금지).
- LINKED 0건이면 섹션 숨김(또는 "물류 거점 인근 활성 경보 없음").
- **배치 위치:** `Impact`(예보 리스크→영향 노선) 바로 뒤 — 두 "→ 영향" 분석 인접.

### 6.4 graceful degrade
내륙 자산·이벤트 forecast가 없으면 → 배지는 기존 자산만으로 계산(대부분 영향 제한적), 섹션 숨김. 파이프라인 데이터 도착 즉시 자동 활성.

## 7. 범위 / 비범위

**이 레포 구현 범위:**
- `AssetType`에 `inland` 추가 + `RiskGlobe` 마커
- `climate-quality.ts` inland expectedRows 가드
- `src/lib/climate-gate.ts` (게이트 + 테스트)
- `Timeline` 배지
- `RegionImpact` 섹션

**logisight 레포(후속, 이 계획 밖):** 내륙 자산 시드, risk 잡 내륙 채점, 이벤트 트리거/일일 배치 AI 생성 스크립트.

**비범위(YAGNI):** 이벤트→`asset_risk` 점수 전파(#2), 내륙 자산의 노선 귀속·post-port 구간, AI 적중률 자동 채점.

## 8. CLAUDE.md 준수 체크
- `shipment_legs` 미사용. 더미 수치 없음 — 데이터 없으면 숨김/검수 중 표기.
- AI 산출물 draft→검수→published, 발행 후 수정·삭제 불가, "AI 초안·에디터 검수" 표기.
- 3단 변환·확률 표현·인과 단정 금지.
- 생성 파이프라인은 logisight 레포. 프론트는 표시·검수만.
- 기존 `/climate` 기능(지구본·RouteMonitor·Impact·Straits·Timeline) 회귀 금지.
