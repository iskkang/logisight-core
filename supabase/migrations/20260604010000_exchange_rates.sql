create table if not exists exchange_rates (
  rate_date date primary key,
  usd_krw numeric(10, 2) not null,
  source text not null default 'koreaexim',
  fetched_at timestamptz not null default now()
);

grant select on exchange_rates to anon, authenticated;
grant all on exchange_rates to service_role;
alter table exchange_rates enable row level security;
create policy "exchange_rates_public_read" on exchange_rates for select using (true);
