create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  title_ko text not null,
  title_en text,
  country_code text,
  region text,
  policy_type text not null,
  effective_date date,
  expiry_date date,
  severity text not null check (severity in ('high', 'medium', 'low', 'info')),
  status text not null default 'active' check (status in ('active', 'expired', 'draft')),
  summary_ko text,
  summary_en text,
  affected_hs_chapters text[],
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on policies to anon, authenticated;
grant all on policies to service_role;
alter table policies enable row level security;
create policy "policies_public_read" on policies for select using (true);
create policy "policies_admin_write" on policies
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
