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
 *     blank homepage — the `q=` natural-language endpoint just has no
 *     multi-city phrasing. multi_city instead uses the `tfs=` endpoint, see
 *     buildMultiCityGoogleFlightsUrl below.
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
}

/**
 * Per-leg breakdown for display (route/date/price under each "구간 N" row
 * in PriceDetailScreen) — see buildMultiCityBookingUrl and
 * buildMultiCityGoogleFlightsUrl below for the two combined search links
 * shown under this breakdown.
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
    }));
}

/**
 * Skyscanner, unlike Google Flights' `q=` endpoint, has a working
 * human-readable multi-city deep link: repeated origin/date/destination
 * path triples under /transport/d/ — verified live (2026-09) against
 * skyscanner.co.kr, e.g.
 *   /transport/d/icn/2026-10-01/nrt/nrt/2026-10-05/hnd
 * for ICN→NRT on 10/1 then NRT→HND on 10/5. Genuine multi-city search,
 * shown alongside buildMultiCityGoogleFlightsUrl so the user can compare.
 *
 * Falls back to the Skyscanner homepage if there aren't at least 2 legs
 * to search (shouldn't happen for a real multi_city watch).
 */
export function buildMultiCityBookingUrl(watch: Watch, latest?: PriceHistoryEntry | null): string {
  const legs = buildMultiLegSearchInfo(watch, latest);
  if (legs.length < 2) {
    return 'https://www.skyscanner.co.kr/';
  }

  const path = legs
    .map((leg) => `${leg.originIata.toLowerCase()}/${leg.departDate}/${leg.destinationIata.toLowerCase()}`)
    .join('/');

  return `https://www.skyscanner.co.kr/transport/d/${path}?adultsv2=1&cabinclass=economy&childrenv2=&ref=aircatch`;
}

// --- Google Flights multi-city (reverse-engineered `tfs=` protobuf) ---
//
// Google Flights DOES have a real multi-city search (the "다구간" trip-type
// option in its own UI) — it's only the `q=` natural-language endpoint used
// above that can't express it. The UI instead drives a `tfs=` query param:
// a base64url-encoded protobuf blob with no public schema.
//
// Decoded by diffing captured `tfs` values while building a multi-city
// search leg by leg in the live UI (2026-09, google.com/travel/flights) —
// every field below was observed to change (or not) in exactly one place
// as one input changed, and the resulting hand-built URL was verified to
// return real flight results. The wire format (top-level message, byte
// offsets in hex):
//   08 1c            field 1, varint = 28        (constant across every
//                                                  capture — unknown
//                                                  purpose, always send it)
//   10 02            field 2, varint = 2          (1 = still editing on the
//                                                  homepage, 2 = "search
//                                                  submitted" — 2 is what
//                                                  jumps straight to results)
//   [repeated] field 3, length-delimited — one per leg, each containing:
//     12 0a <10 bytes>   field 2 = departure date, "YYYY-MM-DD"
//     6a <len>           field 13 = origin, itself a submessage:
//       08 01              field 1, varint = 1    (1 = specific airport;
//                                                  Google's own UI uses 2
//                                                  for a whole-city/metro
//                                                  origin like "서울(모두)",
//                                                  encoded as a Knowledge
//                                                  Graph id, e.g. /m/0hsqf
//                                                  — not used here since
//                                                  every watch stores a
//                                                  specific IATA code)
//       12 03 <3 bytes>    field 2 = IATA code, e.g. "ICN"
//     72 <len>           field 14 = destination, same shape as origin
//   40 01 48 01 70 01 82 01 0b 08 ff ff ff ff ff ff ff ff ff 01 98 01 03
//                     trailer, byte-for-byte identical across every
//                     capture regardless of trip type, leg count, dates,
//                     or airports — cabin class / passenger count /
//                     unknown flags, all left at their defaults.
//
// This is an undocumented internal format, not a stable public API — if
// Google changes it, this silently starts producing a dead or wrong link
// with no error on our end. buildMultiCityBookingUrl (Skyscanner) is the
// resilient alternative shown alongside it for that reason; if this one
// breaks, drop it rather than trying to patch the byte layout blind.

const TFS_TRAILER = [
  0x40, 0x01, 0x48, 0x01, 0x70, 0x01, 0x82, 0x01, 0x0b, 0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0x01, 0x98, 0x01, 0x03,
];

/** IATA codes and ISO dates are plain ASCII, so char code === byte value. */
function asciiBytes(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 1) bytes.push(s.charCodeAt(i));
  return bytes;
}

function encodeAirportField(fieldTag: number, iataCode: string): number[] {
  const inner = [0x08, 0x01, 0x12, 0x03, ...asciiBytes(iataCode)];
  return [fieldTag, inner.length, ...inner];
}

function encodeLeg(originIata: string, destinationIata: string, departDate: string): number[] {
  const dateField = [0x12, 0x0a, ...asciiBytes(departDate)];
  const originField = encodeAirportField(0x6a, originIata);
  const destinationField = encodeAirportField(0x72, destinationIata);
  const leg = [...dateField, ...originField, ...destinationField];
  return [0x1a, leg.length, ...leg];
}

const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** No padding — matches what Google's own UI produces. */
function base64UrlEncode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += BASE64URL_CHARS[(chunk >> 18) & 0x3f];
    out += BASE64URL_CHARS[(chunk >> 12) & 0x3f];
    out += b1 !== undefined ? BASE64URL_CHARS[(chunk >> 6) & 0x3f] : '';
    out += b2 !== undefined ? BASE64URL_CHARS[chunk & 0x3f] : '';
  }
  return out;
}

/**
 * Combined multi-city Google Flights search — see the format notes above.
 * Falls back to the Google Flights homepage if there aren't at least 2 legs
 * to search (shouldn't happen for a real multi_city watch).
 */
export function buildMultiCityGoogleFlightsUrl(watch: Watch, latest?: PriceHistoryEntry | null): string {
  const legs = buildMultiLegSearchInfo(watch, latest);
  if (legs.length < 2) {
    return 'https://www.google.com/travel/flights';
  }

  const bytes = [
    0x08,
    0x1c,
    0x10,
    0x02,
    ...legs.flatMap((leg) => encodeLeg(leg.originIata, leg.destinationIata, leg.departDate)),
    ...TFS_TRAILER,
  ];

  return `https://www.google.com/travel/flights/search?tfs=${base64UrlEncode(bytes)}`;
}
