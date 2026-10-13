-- 조회 경로 구분. "제품 설명 → AI 분류" 와 "HS 코드 직접 조회" 중 사람들이
-- 실제로 무엇을 쓰는지 알아야 다음 작업 우선순위를 정할 수 있다.
-- 기존 행은 전부 설명 경로였으므로 기본값을 그쪽으로 둔다.
alter table public.hs_classification_queries
  add column if not exists mode text not null default 'describe';

comment on column public.hs_classification_queries.mode is
  'describe = 제품 설명으로 AI 분류 / code = HS 코드 직접 조회';
