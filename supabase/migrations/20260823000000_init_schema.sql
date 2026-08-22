-- Phase 1: core schema for AirCatch (profiles, watches, price history, notifications).
-- The API server connects with the service-role key and enforces ownership in
-- application code; RLS below is a second line of defense for any future
-- direct client access (e.g. Supabase Realtime subscriptions).

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new Supabase Auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Generic updated_at helper, reused by watches below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- device_tokens
-- ---------------------------------------------------------------------------
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  device_info jsonb,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index device_tokens_user_id_idx on public.device_tokens (user_id);

-- ---------------------------------------------------------------------------
-- airports
-- ---------------------------------------------------------------------------
create table public.airports (
  iata_code char(3) primary key,
  name text not null,
  city text not null,
  country text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  source text not null default 'seed' check (source in ('seed', 'amadeus')),
  updated_at timestamptz not null default now()
);
create index airports_name_trgm_idx on public.airports using gin (name gin_trgm_ops);
create index airports_city_trgm_idx on public.airports using gin (city gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- watches (registered journeys / price alerts)
-- ---------------------------------------------------------------------------
create table public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_type text not null check (trip_type in ('one_way', 'round_trip', 'multi_city')),
  -- multi_city journeys store their legs in watch_segments instead.
  origin_iata char(3) references public.airports (iata_code),
  destination_iata char(3) references public.airports (iata_code),
  depart_date_from date not null,
  depart_date_to date not null,
  return_date_from date,
  return_date_to date,
  adults integer not null default 1 check (adults >= 1),
  target_price numeric(10, 0) not null check (target_price > 0),
  currency text not null default 'KRW',
  -- Filled in by the Phase 2 Amadeus integration when the watch is created.
  baseline_price numeric(10, 0),
  baseline_captured_at timestamptz,
  baseline_offer_snapshot jsonb,
  last_notified_price numeric(10, 0),
  last_notified_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watches_route_matches_trip_type check (
    (trip_type = 'multi_city' and origin_iata is null and destination_iata is null)
    or (trip_type in ('one_way', 'round_trip') and origin_iata is not null and destination_iata is not null)
  ),
  constraint watches_depart_range_valid check (depart_date_from <= depart_date_to),
  constraint watches_return_range_valid check (
    return_date_from is null or return_date_to is null or return_date_from <= return_date_to
  )
);
create index watches_user_id_idx on public.watches (user_id);
create index watches_status_idx on public.watches (status);

create trigger watches_set_updated_at
  before update on public.watches
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- watch_segments (multi_city legs only)
-- ---------------------------------------------------------------------------
create table public.watch_segments (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.watches (id) on delete cascade,
  sequence_no integer not null check (sequence_no >= 0),
  origin_iata char(3) not null references public.airports (iata_code),
  destination_iata char(3) not null references public.airports (iata_code),
  date_from date not null,
  date_to date not null,
  constraint watch_segments_date_range_valid check (date_from <= date_to),
  unique (watch_id, sequence_no)
);
create index watch_segments_watch_id_idx on public.watch_segments (watch_id);

-- ---------------------------------------------------------------------------
-- price_history
-- ---------------------------------------------------------------------------
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.watches (id) on delete cascade,
  checked_at timestamptz not null default now(),
  depart_date date not null,
  return_date date,
  price numeric(10, 0) not null check (price > 0),
  currency text not null default 'KRW',
  carrier_code text,
  raw_offer jsonb,
  source text not null default 'amadeus_flight_dates'
    check (source in ('amadeus_flight_dates', 'amadeus_flight_offers'))
);
create index price_history_watch_checked_idx on public.price_history (watch_id, checked_at desc);
create index price_history_watch_depart_idx on public.price_history (watch_id, depart_date);

-- ---------------------------------------------------------------------------
-- amadeus_price_cache (shared cache to cut down duplicate Amadeus calls)
-- ---------------------------------------------------------------------------
create table public.amadeus_price_cache (
  cache_key text primary key,
  origin_iata char(3) not null,
  destination_iata char(3) not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index amadeus_price_cache_expires_idx on public.amadeus_price_cache (expires_at);

-- ---------------------------------------------------------------------------
-- notification_logs
-- ---------------------------------------------------------------------------
create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.watches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  price_history_id uuid references public.price_history (id) on delete set null,
  previous_price numeric(10, 0) not null,
  new_price numeric(10, 0) not null,
  drop_amount numeric(10, 0) not null,
  drop_percent numeric(5, 2) not null,
  message text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  expo_ticket_id text,
  sent_at timestamptz not null default now()
);
create index notification_logs_user_id_idx on public.notification_logs (user_id);
create index notification_logs_watch_id_idx on public.notification_logs (watch_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.device_tokens enable row level security;
alter table public.airports enable row level security;
alter table public.watches enable row level security;
alter table public.watch_segments enable row level security;
alter table public.price_history enable row level security;
alter table public.amadeus_price_cache enable row level security;
alter table public.notification_logs enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "device_tokens_all_own" on public.device_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "airports_select_all" on public.airports
  for select using (true);

create policy "watches_all_own" on public.watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watch_segments_all_own" on public.watch_segments
  for all using (
    exists (select 1 from public.watches w where w.id = watch_id and w.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.watches w where w.id = watch_id and w.user_id = auth.uid())
  );

create policy "price_history_select_own" on public.price_history
  for select using (
    exists (select 1 from public.watches w where w.id = watch_id and w.user_id = auth.uid())
  );

create policy "notification_logs_select_own" on public.notification_logs
  for select using (auth.uid() = user_id);

-- amadeus_price_cache: no policy defined on purpose — RLS is enabled with no
-- grant, so it is unreachable from the client (anon/authenticated) roles.
-- Only the service-role key (which bypasses RLS) may read or write it.
