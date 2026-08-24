-- GET /v1/prices/calendar (the endpoint price_history.source's old values
-- named) turned out to silently ignore one-way requests: live testing
-- showed every entry carries a return_at with a realistic trip-length gap
-- regardless of whether return_date was passed, i.e. it always returns
-- round-trip prices despite its own docs. That inflated every fare this
-- app ever showed (worst for multi_city, which summed two of these
-- mislabeled round-trip prices per itinerary). Replaced with
-- GET /v2/prices/latest, which has a genuine `one_way` parameter (verified
-- live: one_way=true returns entries with an empty return_date at roughly
-- a third of the one_way=false price for the same route).
alter table public.price_history
  drop constraint if exists price_history_source_check;
alter table public.price_history
  add constraint price_history_source_check
  check (source in (
    'travelpayouts_latest_oneway',
    'travelpayouts_latest_roundtrip',
    'travelpayouts_multi_city_sum',
    -- old values kept in the allowed set so existing rows stay valid; no
    -- new rows use them going forward.
    'travelpayouts_calendar'
  ));

alter table public.price_history
  alter column source set default 'travelpayouts_latest_oneway';
