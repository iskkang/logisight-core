create table if not exists alert_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  source_table text not null,
  source_id text not null,
  severity text not null check (severity in ('high', 'medium', 'low', 'info')),
  category text not null,
  title_ko text not null,
  detail_ko text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (snapshot_date, source_table, source_id)
);

grant select on alert_snapshots to anon, authenticated;
grant all on alert_snapshots to service_role;
alter table alert_snapshots enable row level security;
create policy "alert_snapshots_public_read" on alert_snapshots for select using (true);
