// Raw `watches` / `watch_segments` row shapes (snake_case, as Postgres/PostgREST
// returns them). Kept separate from watch.types.ts, which describes the
// camelCase shape the API returns to clients.
import { TripType, WatchStatus } from './watch-constants';

export interface WatchRow {
  id: string;
  user_id: string;
  trip_type: TripType;
  origin_iata: string | null;
  destination_iata: string | null;
  depart_date_from: string;
  depart_date_to: string;
  return_date_from: string | null;
  return_date_to: string | null;
  adults: number;
  target_price: number;
  currency: string;
  baseline_price: number | null;
  baseline_captured_at: string | null;
  baseline_offer_snapshot: unknown;
  last_notified_price: number | null;
  last_notified_at: string | null;
  status: WatchStatus;
  created_at: string;
  updated_at: string;
}

export interface WatchSegmentRow {
  id: string;
  watch_id: string;
  sequence_no: number;
  origin_iata: string;
  destination_iata: string;
  date_from: string;
  date_to: string;
}

export type WatchRowWithSegments = WatchRow & {
  watch_segments: WatchSegmentRow[];
};
