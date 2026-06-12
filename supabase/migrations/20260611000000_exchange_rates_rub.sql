alter table exchange_rates
  add column if not exists rub_krw numeric(10, 2);
