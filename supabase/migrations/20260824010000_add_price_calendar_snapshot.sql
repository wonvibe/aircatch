-- price_history stays "one row per check" (its checked_at column is the
-- price-trend chart's x-axis — GET /watches/:id/price-history), so it can't
-- also hold a full multi-date calendar without smearing that chart with
-- dozens of same-instant points every check. The "목표가 이하 추천 일정"
-- feature needs exactly that multi-date breakdown, so it gets its own
-- single-row-per-watch snapshot instead, refreshed each check and never
-- accumulating history.
create table public.price_calendar_snapshot (
  watch_id uuid primary key references public.watches (id) on delete cascade,
  captured_at timestamptz not null default now(),
  -- [{ "date": "2026-09-07", "price": 312000 }, ...] — outbound-leg cheapest
  -- price per date, straight from the Travelpayouts calendar already fetched
  -- for this watch's check (see FareFinderService.findSimpleFare).
  entries jsonb not null default '[]'::jsonb
);

alter table public.price_calendar_snapshot enable row level security;

create policy "price_calendar_snapshot_select_own" on public.price_calendar_snapshot
  for select using (
    exists (select 1 from public.watches w where w.id = watch_id and w.user_id = auth.uid())
  );

-- No insert/update/delete policy on purpose, same as amadeus_price_cache —
-- only the service-role key (backend) ever writes this table.
