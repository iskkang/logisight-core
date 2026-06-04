create table if not exists eurasia_disruptions (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid references lanes(id),
  segment text not null,
  title text not null,
  severity text not null check (severity in ('high', 'medium', 'low')),
  delay_contribution_days numeric(5, 1),
  status text not null default 'active' check (status in ('active', 'resolved')),
  started_at date,
  resolved_at date,
  source text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now()
);

grant select on eurasia_disruptions to anon, authenticated;
grant all on eurasia_disruptions to service_role;
alter table eurasia_disruptions enable row level security;
create policy "eurasia_disruptions_public_read" on eurasia_disruptions for select using (true);
create policy "eurasia_disruptions_admin_write" on eurasia_disruptions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
