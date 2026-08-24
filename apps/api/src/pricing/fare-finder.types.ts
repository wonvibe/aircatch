export interface FoundFare {
  departDate: string;
  returnDate: string | null;
  price: number;
  currency: string;
  carrierCode: string | null;
  rawOffer: unknown;
  source:
    | 'travelpayouts_latest_oneway'
    | 'travelpayouts_latest_roundtrip'
    | 'travelpayouts_multi_city_sum';
}

export interface CalendarDateEntry {
  date: string;
  price: number;
}

export interface SimpleFareResult {
  /** The single fare used for baseline/notify decisions — a genuine
   * one-way fare, or a genuine combined round-trip fare for round_trip
   * (GET /v2/prices/latest returns real depart+return pairs, not a
   * sum-of-two-one-ways). Null if no fare was found. */
  best: FoundFare | null;
  /** Every distinct depart date pulled from the cached prices within
   * [dateFrom, dateTo] (cheapest per date) — for round_trip these are
   * combined round-trip prices keyed by their outbound date, not
   * outbound-only. Powers the recommended-date-ranges list, not the
   * price-trend chart (see price_calendar_snapshot). */
  dailyEntries: CalendarDateEntry[];
}

export interface SimpleFareQuery {
  origin: string;
  destination: string;
  dateFrom: string;
  dateTo: string;
  // Only used when both are present (round_trip watches don't require
  // return dates — see CreateWatchDto). When present, prefers a cached
  // entry whose return_date also falls in [returnDateFrom, returnDateTo],
  // falling back to depart-date-only matches if none do (return windows
  // are sparse in the cache).
  returnDateFrom?: string;
  returnDateTo?: string;
  currency: string;
}

export interface MultiCityLeg {
  sequenceNo: number;
  originIata: string;
  destinationIata: string;
  dateFrom: string;
}

export interface MultiCityFareQuery {
  legs: MultiCityLeg[];
  currency: string;
}

/** One leg's contribution to a multi_city FoundFare.price — stored in
 * FoundFare.rawOffer as `{ legs: MultiCityLegResult[] }`. `foundDate` is
 * the date the price actually came from (within ±3 days of `requestedDate`,
 * see findMultiCityFare's date-tolerance note) — callers that need "which
 * exact date should I search on the booking site" must use this, not the
 * watch segment's original date, since they can differ. */
export interface MultiCityLegResult {
  sequenceNo: number;
  originIata: string;
  destinationIata: string;
  requestedDate: string;
  foundDate: string;
  price: number;
}
