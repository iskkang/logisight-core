alter table exchange_rates
  add column if not exists eur_krw numeric(10, 2),
  add column if not exists cny_krw numeric(10, 2),
  add column if not exists source_url text;
