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
  // null until the Phase 2 Amadeus integration captures the first price.
  baselinePrice: number | null;
  baselineCapturedAt: string | null;
  lastNotifiedPrice: number | null;
  lastNotifiedAt: string | null;
  status: WatchStatus;
  createdAt: string;
  updatedAt: string;
  segments?: WatchSegmentResponse[];
}
