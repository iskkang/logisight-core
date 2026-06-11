insert into public.lanes (
  id,
  name_en,
  name_ko,
  transit_min,
  transit_max,
  border_points,
  is_featured,
  display_order
)
values
  (
    'KR-VLADIVOSTOK-CHUKURSAY',
    'FESCO Korea -> Vladivostok -> Chukursay',
    'FESCO 한국 -> 블라디보스토크 -> 추쿠르사이',
    25,
    40,
    array['Busan', 'Vladivostok', 'Chukursay'],
    true,
    20
  ),
  (
    'KR-VLADIVOSTOK-SILIKATNAJA',
    'FESCO Korea -> Vladivostok -> Silikatnaja',
    'FESCO 한국 -> 블라디보스토크 -> 실리카트나야',
    20,
    35,
    array['Busan', 'Vladivostok', 'Silikatnaja'],
    true,
    21
  ),
  (
    'KR-VLADIVOSTOK-MOSCOW',
    'FESCO Korea -> Vladivostok -> Moscow',
    'FESCO 한국 -> 블라디보스토크 -> 모스크바',
    20,
    35,
    array['Busan', 'Vladivostok', 'Moscow'],
    true,
    22
  )
on conflict (id) do update
set
  name_en = excluded.name_en,
  name_ko = excluded.name_ko,
  transit_min = excluded.transit_min,
  transit_max = excluded.transit_max,
  border_points = excluded.border_points,
  is_featured = excluded.is_featured,
  display_order = excluded.display_order;
