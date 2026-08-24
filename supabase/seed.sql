-- Curated Korean-language airport names for the routes this app's users
-- actually search for. Travelpayouts' bulk reference data
-- (apps/api/scripts/import-airports.mjs) covers every airport worldwide,
-- but its `name` field isn't reliably localized — e.g. ICN comes back as
-- "Seoul Incheon International" (romanized, no Hangul), so a user typing
-- "인천" never matches it. This file is meant to run AFTER that import
-- (`on conflict do update`, not `do nothing`) so these ~20 well-known
-- entries keep real Korean names while everything else falls back to the
-- bulk data. Safe to run standalone too, for local dev without the import.
--
-- FLR/FLO is a real bug this caught: the bulk import had Florence, Italy
-- (FLR) labeled with the romanized "플로렌스" while Florence Regional
-- Airport, South Carolina (FLO) — a tiny US regional airport nobody
-- searching Korean actually wants — had somehow ended up with "피렌체",
-- the name Koreans actually search for the Italian city. A user typing
-- "피렌체" silently got routed to South Carolina instead of Italy (and a
-- LIS→FLO watch predictably had zero fare data). Both rows below correct
-- this — not just an addition, so FLO must stay listed even though it's
-- not otherwise a "well-known" airport.
insert into public.airports (iata_code, name, city, country, latitude, longitude, source)
values
  ('ICN', '인천국제공항', '서울', '대한민국', 37.4602, 126.4407, 'seed'),
  ('FLR', '피렌체 페레톨라 공항', '피렌체', '이탈리아', 43.8100, 11.2051, 'seed'),
  ('FLO', '플로렌스 리저널 공항', '플로렌스(미국)', '미국', 34.1854, -79.7239, 'seed'),
  ('GMP', '김포국제공항', '서울', '대한민국', 37.5583, 126.7906, 'seed'),
  ('PUS', '김해국제공항', '부산', '대한민국', 35.1795, 128.9382, 'seed'),
  ('CJU', '제주국제공항', '제주', '대한민국', 33.5113, 126.4930, 'seed'),
  ('BKK', '수완나품 국제공항', '방콕', '태국', 13.6900, 100.7501, 'seed'),
  ('DMK', '돈므앙 국제공항', '방콕', '태국', 13.9126, 100.6068, 'seed'),
  ('DPS', '응우라라이 국제공항', '발리(덴파사르)', '인도네시아', -8.7482, 115.1672, 'seed'),
  ('NRT', '나리타국제공항', '도쿄', '일본', 35.7647, 140.3864, 'seed'),
  ('HND', '하네다공항', '도쿄', '일본', 35.5494, 139.7798, 'seed'),
  ('KIX', '간사이국제공항', '오사카', '일본', 34.4347, 135.2441, 'seed'),
  ('SIN', '창이공항', '싱가포르', '싱가포르', 1.3644, 103.9915, 'seed'),
  ('HKG', '홍콩국제공항', '홍콩', '홍콩', 22.3080, 113.9185, 'seed'),
  ('TPE', '타오위안국제공항', '타이베이', '대만', 25.0777, 121.2328, 'seed'),
  ('MNL', '니노이아키노국제공항', '마닐라', '필리핀', 14.5086, 121.0198, 'seed'),
  ('CEB', '막탄세부국제공항', '세부', '필리핀', 10.3075, 123.9789, 'seed'),
  ('DAD', '다낭국제공항', '다낭', '베트남', 16.0439, 108.1994, 'seed'),
  ('SGN', '떤선녓국제공항', '호치민', '베트남', 10.8188, 106.6520, 'seed'),
  ('CDG', '샤를드골공항', '파리', '프랑스', 49.0097, 2.5479, 'seed'),
  ('LHR', '히드로공항', '런던', '영국', 51.4700, -0.4543, 'seed'),
  ('LAX', '로스앤젤레스국제공항', '로스앤젤레스', '미국', 33.9416, -118.4085, 'seed'),
  ('JFK', '존에프케네디국제공항', '뉴욕', '미국', 40.6413, -73.7781, 'seed')
on conflict (iata_code) do update set
  name = excluded.name,
  city = excluded.city,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  source = excluded.source,
  updated_at = now();
