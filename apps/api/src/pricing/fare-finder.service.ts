import { Injectable } from '@nestjs/common';
import { PriceCacheService } from '../travelpayouts/price-cache.service';
import { TravelpayoutsLatestPriceEntry } from '../travelpayouts/travelpayouts.types';
import {
  CalendarDateEntry,
  FoundFare,
  MultiCityFareQuery,
  MultiCityLegResult,
  SimpleFareQuery,
  SimpleFareResult,
} from './fare-finder.types';

// See findMultiCityFare: Travelpayouts' cache is sparse (most individual
// dates have nothing cached), so an exact-date match would leave most
// multi-city itineraries permanently unpriced. This is how many days on
// either side of the requested date a leg lookup will accept a cached fare
// from instead.
const MULTI_CITY_LEG_DATE_TOLERANCE_DAYS = 3;

/**
 * Turns a watch's route/date-range into "the cheapest fare Travelpayouts
 * currently has cached for it". Used both by WatchesService (one-shot
 * capture on watch creation) and PriceMonitorService (the recurring cron
 * check) — the two calling contexts differ, but "how do we ask the
 * provider for a price" doesn't.
 *
 * Travelpayouts has no multi-city fare endpoint — GET /v2/prices/latest
 * only prices a single origin→destination pair (one-way or round-trip) per
 * call. Multi-city fares here are therefore a sum of the cheapest one-way
 * fare found per leg, not a single combined quote — a real accuracy
 * tradeoff (real itineraries aren't always priced as the sum of their
 * legs), documented rather than hidden — see the in-app price-disclaimer
 * banner. one_way and round_trip watches, by contrast, get a genuine fare
 * for the itinerary as actually searched (see findOneWayFare /
 * findRoundTripFare).
 */
@Injectable()
export class FareFinderService {
  constructor(private readonly priceCache: PriceCacheService) {}

  async findSimpleFare(query: SimpleFareQuery): Promise<SimpleFareResult> {
    if (query.returnDateFrom && query.returnDateTo) {
      return this.findRoundTripFare(
        query,
        query.returnDateFrom,
        query.returnDateTo,
      );
    }
    return this.findOneWayFare(query);
  }

  private async findOneWayFare(
    query: SimpleFareQuery,
  ): Promise<SimpleFareResult> {
    const entries = await this.priceCache.getLatestPrices(
      query.origin,
      query.destination,
      query.currency,
      true,
    );
    const inWindow = entries.filter(
      (e) => e.depart_date >= query.dateFrom && e.depart_date <= query.dateTo,
    );
    const dailyEntries = dedupeCheapestPerDate(inWindow);

    const cheapest = cheapestEntry(inWindow);
    if (!cheapest) return { best: null, dailyEntries };

    return {
      best: {
        departDate: cheapest.depart_date,
        returnDate: null,
        price: cheapest.value,
        currency: query.currency,
        carrierCode: null,
        rawOffer: cheapest,
        source: 'travelpayouts_latest_oneway',
      },
      dailyEntries,
    };
  }

  private async findRoundTripFare(
    query: SimpleFareQuery,
    returnDateFrom: string,
    returnDateTo: string,
  ): Promise<SimpleFareResult> {
    const entries = await this.priceCache.getLatestPrices(
      query.origin,
      query.destination,
      query.currency,
      false,
    );
    const inWindow = entries.filter(
      (e) => e.depart_date >= query.dateFrom && e.depart_date <= query.dateTo,
    );
    const dailyEntries = dedupeCheapestPerDate(inWindow);

    // Prefer a combined fare whose return date also lands in the return
    // window; the cache is sparse enough that requiring both often finds
    // nothing, so fall back to depart-date-only matches rather than fail.
    const returnMatched = inWindow.filter(
      (e) =>
        e.return_date &&
        e.return_date >= returnDateFrom &&
        e.return_date <= returnDateTo,
    );
    const cheapest = cheapestEntry(
      returnMatched.length > 0 ? returnMatched : inWindow,
    );
    if (!cheapest) return { best: null, dailyEntries };

    return {
      best: {
        departDate: cheapest.depart_date,
        returnDate: cheapest.return_date || null,
        price: cheapest.value,
        currency: query.currency,
        carrierCode: null,
        rawOffer: cheapest,
        source: 'travelpayouts_latest_roundtrip',
      },
      dailyEntries,
    };
  }

  async findMultiCityFare(
    query: MultiCityFareQuery,
  ): Promise<FoundFare | null> {
    if (query.legs.length < 2) return null;

    const sortedLegs = query.legs
      .slice()
      .sort((a, b) => a.sequenceNo - b.sequenceNo);
    const legResults: MultiCityLegResult[] = [];

    for (const leg of sortedLegs) {
      const entries = await this.priceCache.getLatestPrices(
        leg.originIata,
        leg.destinationIata,
        query.currency,
        true,
      );
      const windowFrom = shiftDate(
        leg.dateFrom,
        -MULTI_CITY_LEG_DATE_TOLERANCE_DAYS,
      );
      const windowTo = shiftDate(
        leg.dateFrom,
        MULTI_CITY_LEG_DATE_TOLERANCE_DAYS,
      );
      const inWindow = entries.filter(
        (e) => e.depart_date >= windowFrom && e.depart_date <= windowTo,
      );
      const found = cheapestEntry(inWindow);
      if (!found) return null; // can't price the itinerary if any leg has no data
      // found.depart_date can differ from leg.dateFrom by up to the
      // tolerance above — keep both so callers (the booking-link builder,
      // in particular) know which date the price actually came from.
      legResults.push({
        sequenceNo: leg.sequenceNo,
        originIata: leg.originIata,
        destinationIata: leg.destinationIata,
        requestedDate: leg.dateFrom,
        foundDate: found.depart_date,
        price: found.value,
      });
    }

    return {
      departDate: legResults[0].foundDate,
      returnDate: null,
      price: legResults.reduce((sum, r) => sum + r.price, 0),
      currency: query.currency,
      carrierCode: null,
      rawOffer: { legs: legResults },
      source: 'travelpayouts_multi_city_sum',
    };
  }
}

function cheapestEntry(
  entries: TravelpayoutsLatestPriceEntry[],
): TravelpayoutsLatestPriceEntry | null {
  if (entries.length === 0) return null;
  return entries.reduce((min, cur) => (cur.value < min.value ? cur : min));
}

/** Cheapest fare per distinct depart_date, sorted ascending by date. */
function dedupeCheapestPerDate(
  entries: TravelpayoutsLatestPriceEntry[],
): CalendarDateEntry[] {
  const cheapestByDate = new Map<string, number>();
  for (const entry of entries) {
    const existing = cheapestByDate.get(entry.depart_date);
    if (existing === undefined || entry.value < existing) {
      cheapestByDate.set(entry.depart_date, entry.value);
    }
  }
  return Array.from(cheapestByDate.entries())
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** dateStr ± days, both as 'YYYY-MM-DD'. */
function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
