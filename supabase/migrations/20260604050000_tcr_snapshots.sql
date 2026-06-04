create table if not exists tcr_snapshots (
  snapshot_date date primary key,
  total integer,
  in_transit integer,
  arrived integer,
  alert_count integer,
  by_destination jsonb,
  by_segment jsonb,
  fetched_at timestamptz not null default now()
);

grant select on tcr_snapshots to anon, authenticated;
grant all on tcr_snapshots to service_role;
alter table tcr_snapshots enable row level security;
create policy "tcr_snapshots_public_read" on tcr_snapshots for select using (true);
