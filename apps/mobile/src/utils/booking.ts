import { PriceHistoryEntry, Watch } from '../api/types';

/**
 * We don't have a booking partner integration, so "예매처에서 확인하기"
 * (PRD 6절) opens a Google Flights search instead of a dead end. Deep-links
 * to the specific date(s) currently shown as 현재가 — `latest`, the most
 * recent price_history entry — rather than just the watch's whole search
 * window, so the user lands on (close to) the fare this screen is showing
 * instead of a blank multi-week search. Falls back to the search window
 * only when no check has landed yet (still "조회 중").
 *
 * The exact phrasing below was verified live against google.com/travel/flights
 * — Google's `q=` natural-language parser is picky and silently falls back
 * to its blank homepage on anything it can't parse, rather than erroring:
 *   - "Flights from X to Y on DATE" (no return date) → defaults to a
 *     ROUND TRIP with an arbitrary auto-picked return date, not one-way.
 *     "One way flights from X to Y on DATE" is what actually forces one-way.
 *   - "...on DATE1 returning DATE2" → unparsed, blank homepage.
 *     "...from DATE1 to DATE2" is what actually parses as a round trip.
 *   - "X to Y on D1, then A to B on D2" (multi-city phrasing) → unparsed,
 *     blank homepage, regardless of connector wording tried. There's no
 *     working multi-city phrasing, hence buildMultiLegSearchInfo below.
 */
export function buildBookingSearchUrl(watch: Watch, latest?: PriceHistoryEntry | null): string {
  if (watch.tripType === 'multi_city' || !watch.originIata || !watch.destinationIata) {
    return 'https://www.google.com/travel/flights';
  }

  const departDate = latest?.departDate ?? watch.departDateFrom;

  if (watch.tripType === 'round_trip') {
    const returnDate = latest?.returnDate ?? watch.returnDateFrom;
    if (returnDate) {
      const query = `Flights from ${watch.originIata} to ${watch.destinationIata} from ${departDate} to ${returnDate}`;
      return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
    }
  }

  return buildOneWayLegUrl(watch.originIata, watch.destinationIata, departDate);
}

function buildOneWayLegUrl(originIata: string, destinationIata: string, date: string): string {
  const query = `One way flights from ${originIata} to ${destinationIata} on ${date}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

export interface MultiLegSearchInfo {
  originIata: string;
  destinationIata: string;
  /** The date the leg's price actually came from — NOT necessarily the
   * watch's requested segment date (findMultiCityFare searches a ±3-day
   * window, so they can differ). Always prefer this over the segment's own
   * date so the booking-site search matches what 현재가 is showing. */
  departDate: string;
  /** Only present once a check has landed (from the latest price_history
   * entry's per-leg breakdown) — null while still "조회 중". */
  price: number | null;
  url: string;
}

/**
 * multi_city has no working combined-search phrasing (see note above), so
 * this returns one one-way search per leg instead of a single URL — fitting
 * given our own multi_city price is already a sum of separately-priced
 * one-way legs (see FareFinderService), not a single combined fare.
 *
 * Prefers `latest.legs` (the actual dates/prices the current 현재가 sums
 * to) over the watch's own segments, since those can disagree — falls back
 * to segments only when no check has landed yet.
 */
export function buildMultiLegSearchInfo(
  watch: Watch,
  latest?: PriceHistoryEntry | null,
): MultiLegSearchInfo[] {
  if (latest?.legs && latest.legs.length > 0) {
    return latest.legs
      .slice()
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((leg) => ({
        originIata: leg.originIata,
        destinationIata: leg.destinationIata,
        departDate: leg.departDate,
        price: leg.price,
        url: buildOneWayLegUrl(leg.originIata, leg.destinationIata, leg.departDate),
      }));
  }

  const segments = watch.segments ?? [];
  return segments
    .slice()
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((segment) => ({
      originIata: segment.originIata,
      destinationIata: segment.destinationIata,
      departDate: segment.dateFrom,
      price: null,
      url: buildOneWayLegUrl(segment.originIata, segment.destinationIata, segment.dateFrom),
    }));
}
