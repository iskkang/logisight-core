create table if not exists macro_index_history (
  id bigint generated always as identity primary key,
  indicator text not null,
  as_of date not null,
  value numeric not null,
  change_rate text,
  created_at timestamptz not null default now(),
  unique (indicator, as_of)
);

create index if not exists macro_index_history_indicator_as_of_idx
  on macro_index_history (indicator, as_of desc);

grant select on macro_index_history to anon, authenticated;
grant all on macro_index_history to service_role;

alter table macro_index_history enable row level security;

drop policy if exists "macro_index_history_public_read" on macro_index_history;
create policy "macro_index_history_public_read" on macro_index_history for select using (true);
