-- 전망 분석자 패널의 "리스크 노트" — 주간 단위 거시 리스크 코멘트(에디터 입력).
-- 공개 페이지에 최신 1건 노출, 없으면 섹션 숨김(더미 금지).
create table if not exists risk_notes (
  id uuid primary key default gen_random_uuid(),
  note text not null,
  week_start date,
  created_at timestamptz not null default now()
);

create index if not exists risk_notes_created_idx on risk_notes (created_at desc);

grant select on risk_notes to anon, authenticated;
grant all on risk_notes to service_role;
alter table risk_notes enable row level security;

-- 공개 읽기(전 방문자 동일), 입력·수정은 admin만.
create policy "risk_notes_public_read" on risk_notes for select using (true);
create policy "risk_notes_admin_all" on risk_notes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
