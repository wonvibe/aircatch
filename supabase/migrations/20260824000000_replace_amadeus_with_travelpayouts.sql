-- Amadeus's free Self-Service API was decommissioned (2026-07-17); the price
-- data provider is now the Travelpayouts Data API. The cache table's purpose
-- is unchanged (shared cache of "cheapest fares for a route"), so it's
-- renamed rather than dropped/recreated. price_history.source's allowed
-- values change to match the new provider's naming.

alter table public.amadeus_price_cache rename to price_cache;

alter table public.price_history
  drop constraint if exists price_history_source_check;
alter table public.price_history
  add constraint price_history_source_check
  check (source in ('travelpayouts_calendar', 'travelpayouts_multi_city_sum'));

alter table public.price_history
  alter column source set default 'travelpayouts_calendar';

-- airports.source also names its provider; add the new one (old 'amadeus'
-- rows, if any, are harmless history — left in the allowed set rather than
-- rewritten).
alter table public.airports
  drop constraint if exists airports_source_check;
alter table public.airports
  add constraint airports_source_check
  check (source in ('seed', 'amadeus', 'travelpayouts'));
