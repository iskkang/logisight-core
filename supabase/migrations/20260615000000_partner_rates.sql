-- 실측 FCL 운임(파트너 견적) — 업로드 시트 + 행
create table if not exists public.rate_sheets (
  id uuid primary key default gen_random_uuid(),
  source text,
  title text,
  valid_from date,
  valid_until date,
  image_path text,
  notes text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table if not exists public.partner_rates (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.rate_sheets(id) on delete cascade,
  pol text,
  pod text,
  country text,
  kita_dest text,
  rate_20 numeric,
  rate_40 numeric,
  transit_min int,
  transit_max int,
  route_type text check (route_type in ('DIRECT','T_S') or route_type is null),
  via_port text,
  carrier text,
  remark text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists partner_rates_sheet_id_idx on public.partner_rates (sheet_id);
create index if not exists partner_rates_kita_dest_idx on public.partner_rates (kita_dest);
create index if not exists rate_sheets_status_valid_idx on public.rate_sheets (status, valid_until);

alter table public.rate_sheets enable row level security;
alter table public.partner_rates enable row level security;
