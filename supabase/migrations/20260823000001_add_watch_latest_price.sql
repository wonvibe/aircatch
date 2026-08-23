-- The dashboard needs "기준가 대비 현재가" (baseline vs. current price) side by
-- side (PRD 6절). baseline_price only ratchets down on notify-worthy drops,
-- so it can't stand in for "latest observed price" once the market price
-- has risen again. Track the latest check separately instead.
alter table public.watches
  add column latest_price numeric(10, 0),
  add column latest_checked_at timestamptz;
