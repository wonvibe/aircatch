import { Watch } from '../api/types';

/**
 * We don't have a booking partner integration, so "예매처 이동" (PRD 6절)
 * opens a Google Flights search for the watch's route/date instead of a
 * dead end. Multi-city watches (no single origin/destination on the watch
 * itself) fall back to the plain search page.
 */
export function buildBookingSearchUrl(watch: Watch): string {
  if (watch.tripType === 'multi_city' || !watch.originIata || !watch.destinationIata) {
    return 'https://www.google.com/travel/flights';
  }
  const query = `Flights from ${watch.originIata} to ${watch.destinationIata} on ${watch.departDateFrom}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
