-- 전망 카드 분석자 패널의 "에디터 코멘트" — 발행 후에도 수정 가능한 주석.
-- 본문 불변 트리거(forecasts_guard_published)는 module/statement/basis/impact_note/horizon_date/
-- confidence/invalidation_condition/metric_ref 8개만 보호하므로, editor_note는 자동으로 보호 대상
-- 밖이다(발행 후 수정 허용). 본문(statement)과 달리 주석 성격임을 명시.
alter table forecasts add column if not exists editor_note text;
comment on column forecasts.editor_note is '에디터 코멘트(주석) — 발행 후 수정 가능. 본문 불변 대상 아님.';
