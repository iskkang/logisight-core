alter table exchange_rates
  add column if not exists jpy_krw numeric(10, 2);
