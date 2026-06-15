# 실측 FCL 운임(파트너 견적) 업로드·표시 — 설계

작성일: 2026-06-15
대상 레포: `logisight-core` · 데이터: 신규 Supabase 테이블 + Storage 버킷

## 1. 목표·범위

관리자(단독)가 거래처로부터 **이메일로 받는 FCL 운임표 캡처 이미지**를 업로드하면, Claude 비전으로 행을 추출하고 **검수·보정 후 저장**하여, `/rates`에서 **실측 운임을 우선** 표시(없으면 KITA 샘플 폴백)한다.

- 입력: **이미지 캡처만**(엑셀 없음). 해상 **FCL만**. 관리자 1인.
- 표시: 실측 우선 + KITA 폴백(통합). 미매핑 행은 별도 "실측 운임" 목록 조회.

## 2. 핵심 결정

- **항만명 불일치**: KITA는 한글(만사니요), 견적표는 영문(MANZANILLO). 자동 병합 불가 → **검수 단계에서 POD를 KITA 항만(dest)에 매핑**(드롭다운). 매핑된 행만 `/rates` 노선 뷰에 병합.
- **검수 게이트 필수**: 비전 추출값은 `draft`로 보관 → 관리자가 확인·보정 → `published`만 노출. (닝보 carry-forward 교훈)
- **유효기간**: 시트별 `valid_until`. 만료분 자동 숨김/만료 표시.
- **추출은 서버함수**(TanStack `createServerFn`)에서만 — `ANTHROPIC_API_KEY`가 클라이언트로 노출되지 않음.

## 3. 데이터 모델 (신규 마이그레이션: `logisight-core/supabase/migrations`)

`rate_sheets` (업로드 1건 = 1행):
- `id uuid pk default gen_random_uuid()`
- `source text` (예 "JH Logistics")
- `title text` (예 "KOREA to MEXICO, MX & LATIN FCL")
- `valid_from date null`, `valid_until date null`
- `image_path text` (Storage 경로)
- `notes text null` (각주: AMS·freetime·국내부대비·할증)
- `status text not null default 'draft' check (status in ('draft','published'))`
- `created_at timestamptz default now()`

`partner_rates` (행):
- `id uuid pk default gen_random_uuid()`
- `sheet_id uuid not null references rate_sheets(id) on delete cascade`
- `pol text` (예 "부산" 또는 "부산/인천/광양/평택")
- `pod text` (영문 원문, 예 "MANZANILLO, MEXICO")
- `country text null`
- `kita_dest text null` (매핑된 KITA `kita_sea_rates.dest` 한글명 — 병합 키)
- `rate_20 numeric null` (USD), `rate_40 numeric null` (USD, 40'/40HQ)
- `transit_min int null`, `transit_max int null`
- `route_type text null` ('DIRECT' | 'T_S'), `via_port text null`
- `carrier text null`, `remark text null`
- `sort_order int default 0`, `created_at timestamptz default now()`

인덱스: `partner_rates(kita_dest)`, `partner_rates(sheet_id)`, `rate_sheets(status, valid_until)`.

RLS/접근: 다른 테이블 패턴대로 **읽기·쓰기 모두 서버함수**(`supabasePublicServer`/service)에서 처리. 공개 노출용 읽기 서버함수는 `status='published' AND (valid_until IS NULL OR valid_until >= current_date)`만 반환. anon 직접 접근은 RLS deny.

Storage: 버킷 `rate-sheets`(비공개). 이미지 업로드/서명 URL은 서버함수로.

## 4. 비전 추출 서버함수

`src/lib/api/partner-rates.functions.ts` → `extractRateSheet({ imageBase64, mediaType })`:
- `@anthropic-ai/sdk` 사용(레포에 미설치면 추가). 키: `process.env.ANTHROPIC_API_KEY`(서버 전용).
- `client.messages.create({ model: "claude-opus-4-8", max_tokens: 16000, thinking: { type: "adaptive" }, output_config: { format: { type: "json_schema", schema } }, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type, data: imageBase64 }}, { type: "text", text: <추출 지시> }] }] })`.
- `schema`(structured output)로 검증된 JSON 보장:
  ```
  { sheet: { source, title, valid_until, notes },
    rows: [{ pol, pod, country, rate_20, rate_40, transit_min, transit_max, route_type, via_port, carrier, remark }] }
  ```
- **저장하지 않음** — 추출 결과만 반환(검수용). 저장은 별도 `saveRateSheet` 서버함수(검수 후 호출).
- 지시문: "이 FCL 운임표 이미지를 행 단위로 추출. 숫자는 통화기호·콤마 제거한 숫자만. transit 'a~b'는 min/max로, 단일값은 동일. DIRECT/T·S 구분. 불명확하면 null. 추정 금지."

## 5. 관리자 업로드·검수 UI

`src/routes/admin.partner-rates.tsx` (기존 `admin.login` 인증 게이트 재사용):
1. 이미지 드롭 → Storage 업로드(서버함수) → `extractRateSheet` 호출.
2. 추출 결과를 **편집 가능한 테이블**로 표시. 각 행에 **POD→KITA dest 매핑 드롭다운**(`kita_sea_rates`의 distinct dest 목록). 시트 메타(source·title·valid_until·notes)도 편집.
3. [저장] → `saveRateSheet`(rate_sheets + partner_rates, status='draft'). [발행] → status='published'.
4. 기존 시트 목록·재발행·만료 표시.

## 6. /rates 표시 (실측 우선 + KITA 폴백)

- 신규 읽기 서버함수 `getPublishedPartnerRates()` → published·미만료 행(+sheet 메타).
- 쿼리옵션 `partnerRatesQueryOptions()` 추가, `/rates` loader에서 prefetch.
- 결과 테이블(`RateResultTable`)에서 노선의 `dest`에 대해 **매핑된 실측 행(kita_dest=dest)이 있으면 실측 우선 표시**: rate_20/rate_40·transit·route·carrier + **배지(출처·valid_until·"실측")**. 없으면 기존 KITA 값.
- 미매핑/타권역 실측은 별도 "실측 운임" 패널(검색 권역의 published 시트 행을 영문 POD 기준으로 표).

## 7. 단계(한 스펙, 순차 구현)

- **Phase 1**: 마이그레이션 + Storage + extract/save 서버함수 + admin 업로드·검수 UI + 독립 "실측 운임" 조회. (핵심 가치 즉시)
- **Phase 2**: `/rates` 결과 테이블에 실측 우선 병합(kita_dest 사용) + 배지.

## 8. 테스트

- 순수 헬퍼(vitest): 추출 JSON → DB 행 정규화(통화/콤마 제거, transit 파싱, route_type 정규화), 만료 필터, dest 매핑 병합 선택(실측 우선) 로직.
- 추출 서버함수는 실제 API 호출이라 단위테스트 제외(헬퍼만). 수동 스모크로 검증.

## 9. 비목표

- 엑셀/PDF 입력(이미지만). 항공·LCL. 다중 관리자. 자동(무검수) 발행. 부대비/할증의 구조화(우선 notes 텍스트).

## 10. 리스크·전제

- `ANTHROPIC_API_KEY` 존재 확인됨. `@anthropic-ai/sdk` 미설치 시 추가 필요.
- 비전 추출 정확도는 **검수 게이트로 보증**(직노출 금지).
- 항만 매핑은 검수 시 1회성 수작업이나 단독 관리자·소량이라 감내. 매핑 사전은 점진 축적.
- Supabase Storage 최초 사용 — 버킷·정책 신규.
