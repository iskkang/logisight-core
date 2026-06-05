create table if not exists risk_snapshots (
  id text primary key,
  snapshot jsonb not null,
  source text not null default 'render-risk-collector',
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists risk_snapshots_collected_at_idx on risk_snapshots (collected_at desc);

grant select on risk_snapshots to anon, authenticated;
grant all on risk_snapshots to service_role;

alter table risk_snapshots enable row level security;

drop policy if exists "risk_snapshots_public_read" on risk_snapshots;
create policy "risk_snapshots_public_read" on risk_snapshots for select using (true);
