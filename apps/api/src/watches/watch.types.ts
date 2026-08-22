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
  // null when baseline capture fails (e.g. Amadeus unreachable/misconfigured,
  // or no fares found) — watch creation still succeeds either way.
  baselinePrice: number | null;
  baselineCapturedAt: string | null;
  lastNotifiedPrice: number | null;
  lastNotifiedAt: string | null;
  status: WatchStatus;
  createdAt: string;
  updatedAt: string;
  segments?: WatchSegmentResponse[];
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
}
