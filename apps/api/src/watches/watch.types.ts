import { TripType, WatchStatus } from './watch-constants';

export interface WatchSegmentResponse {
  id: string;
  sequenceNo: number;
  originIata: string;
  destinationIata: string;
  dateFrom: string;
  dateTo: string;
}

export interface WatchResponse {
  id: string;
  tripType: TripType;
  originIata: string | null;
  destinationIata: string | null;
  departDateFrom: string;
  departDateTo: string;
  returnDateFrom: string | null;
  returnDateTo: string | null;
  adults: number;
  targetPrice: number;
  currency: string;
  // null when baseline capture fails (e.g. Travelpayouts unreachable/misconfigured,
  // or no fares found) — watch creation still succeeds either way.
  baselinePrice: number | null;
  baselineCapturedAt: string | null;
  // Most recent check, regardless of whether it moved the baseline — this is
  // "현재가" for the dashboard's 기준가 vs 현재가 comparison (PRD 6절).
  latestPrice: number | null;
  latestCheckedAt: string | null;
  lastNotifiedPrice: number | null;
  lastNotifiedAt: string | null;
  status: WatchStatus;
  createdAt: string;
  updatedAt: string;
  segments?: WatchSegmentResponse[];
}

export interface PriceHistoryLeg {
  sequenceNo: number;
  originIata: string;
  destinationIata: string;
  departDate: string;
  price: number;
}

export interface PriceHistoryEntry {
  id: string;
  checkedAt: string;
  departDate: string;
  returnDate: string | null;
  price: number;
  currency: string;
  carrierCode: string | null;
  source: string;
  // multi_city only — the actual per-leg dates/prices this entry's price
  // sums to. Segment dates on the watch itself are what the user asked
  // for; these are what was actually found (can differ by a few days, see
  // FareFinderService.findMultiCityFare), so the booking-link builder uses
  // these instead of the watch's segments.
  legs?: PriceHistoryLeg[];
}
