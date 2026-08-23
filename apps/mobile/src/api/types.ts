// Mirrors apps/api's response shapes (camelCase). Kept as plain types here
// rather than a shared package for now — see packages/shared-types, which
// this can move into once the API's DTOs stop changing as often.

export type TripType = 'one_way' | 'round_trip' | 'multi_city';
export type WatchStatus = 'active' | 'paused' | 'archived';

export interface WatchSegment {
  id: string;
  sequenceNo: number;
  originIata: string;
  destinationIata: string;
  dateFrom: string;
  dateTo: string;
}

export interface Watch {
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
  baselinePrice: number | null;
  baselineCapturedAt: string | null;
  latestPrice: number | null;
  latestCheckedAt: string | null;
  lastNotifiedPrice: number | null;
  lastNotifiedAt: string | null;
  status: WatchStatus;
  createdAt: string;
  updatedAt: string;
  segments?: WatchSegment[];
}

export interface CreateWatchInput {
  tripType: TripType;
  originIata?: string;
  destinationIata?: string;
  departDateFrom: string;
  departDateTo: string;
  returnDateFrom?: string;
  returnDateTo?: string;
  adults?: number;
  targetPrice: number;
  currency?: string;
  segments?: {
    sequenceNo: number;
    originIata: string;
    destinationIata: string;
    dateFrom: string;
    dateTo: string;
  }[];
}

export interface UpdateWatchInput {
  targetPrice?: number;
  status?: WatchStatus;
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

export interface Airport {
  iataCode: string;
  name: string;
  city: string;
  country: string;
}

export interface NotificationLogEntry {
  id: string;
  watchId: string;
  previousPrice: number;
  newPrice: number;
  dropAmount: number;
  dropPercent: number;
  message: string;
  status: 'sent' | 'failed';
  sentAt: string;
}

export interface NotificationsPage {
  items: NotificationLogEntry[];
  nextCursor: string | null;
}

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
}
