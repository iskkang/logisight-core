-- customs_nomenclature 는 market 열을 갖고 있으면서도 체크 제약이 'EU' 하나로
-- 못 박혀 있었다. 미국(HTS)을 넣으려면 풀어야 한다.
--
-- 제약을 없애지 않고 허용 목록을 넓히기만 한다 —— 오타난 market 이 그냥 들어가면
-- 조회가 조용히 비게 된다. 시장을 늘릴 때마다 여기도 같이 늘린다.
alter table public.customs_nomenclature drop constraint if exists customs_nomenclature_market_check;
alter table public.customs_nomenclature
  add constraint customs_nomenclature_market_check check (market in ('EU', 'US'));

alter table public.customs_nomenclature drop constraint if exists customs_nomenclature_nomenclature_check;
alter table public.customs_nomenclature
  add constraint customs_nomenclature_nomenclature_check
  check (nomenclature in ('HS', 'CN', 'TARIC', 'HTS'));
