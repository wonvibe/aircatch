-- Local development seed data.
-- A small, real starter set so /airports/search has something to return
-- before the Amadeus Locations API is wired up in Phase 2 (which will
-- upsert into this same table on cache misses, source='amadeus').

insert into public.airports (iata_code, name, city, country, latitude, longitude, source)
values
  ('ICN', 'Incheon International Airport', '서울', '대한민국', 37.4602, 126.4407, 'seed'),
  ('GMP', 'Gimpo International Airport', '서울', '대한민국', 37.5583, 126.7906, 'seed'),
  ('PUS', 'Gimhae International Airport', '부산', '대한민국', 35.1795, 128.9382, 'seed'),
  ('BKK', 'Suvarnabhumi Airport', '방콕', '태국', 13.6900, 100.7501, 'seed'),
  ('DMK', 'Don Mueang International Airport', '방콕', '태국', 13.9126, 100.6068, 'seed'),
  ('DPS', 'Ngurah Rai International Airport', '발리(덴파사르)', '인도네시아', -8.7482, 115.1672, 'seed'),
  ('NRT', 'Narita International Airport', '도쿄', '일본', 35.7647, 140.3864, 'seed'),
  ('HND', 'Haneda Airport', '도쿄', '일본', 35.5494, 139.7798, 'seed'),
  ('KIX', 'Kansai International Airport', '오사카', '일본', 34.4347, 135.2441, 'seed'),
  ('SIN', 'Singapore Changi Airport', '싱가포르', '싱가포르', 1.3644, 103.9915, 'seed'),
  ('HKG', 'Hong Kong International Airport', '홍콩', '홍콩', 22.3080, 113.9185, 'seed'),
  ('TPE', 'Taiwan Taoyuan International Airport', '타이베이', '대만', 25.0777, 121.2328, 'seed'),
  ('MNL', 'Ninoy Aquino International Airport', '마닐라', '필리핀', 14.5086, 121.0198, 'seed'),
  ('CEB', 'Mactan-Cebu International Airport', '세부', '필리핀', 10.3075, 123.9789, 'seed'),
  ('DAD', 'Da Nang International Airport', '다낭', '베트남', 16.0439, 108.1994, 'seed'),
  ('SGN', 'Tan Son Nhat International Airport', '호치민', '베트남', 10.8188, 106.6520, 'seed'),
  ('CDG', 'Charles de Gaulle Airport', '파리', '프랑스', 49.0097, 2.5479, 'seed'),
  ('LHR', 'Heathrow Airport', '런던', '영국', 51.4700, -0.4543, 'seed'),
  ('LAX', 'Los Angeles International Airport', '로스앤젤레스', '미국', 33.9416, -118.4085, 'seed'),
  ('JFK', 'John F. Kennedy International Airport', '뉴욕', '미국', 40.6413, -73.7781, 'seed')
on conflict (iata_code) do nothing;
