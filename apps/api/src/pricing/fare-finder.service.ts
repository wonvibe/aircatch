import { Injectable } from '@nestjs/common';
import { PriceCacheService } from '../travelpayouts/price-cache.service';
import { TravelpayoutsCalendarOffer } from '../travelpayouts/travelpayouts.types';
import {
  FoundFare,
  MultiCityFareQuery,
  SimpleFareQuery,
} from './fare-finder.types';

interface DatedOffer {
  date: string;
  offer: TravelpayoutsCalendarOffer;
}

/**
 * Turns a watch's route/date-range into "the cheapest fare Travelpayouts
 * currently has cached for it". Used both by WatchesService (one-shot
 * capture on watch creation) and PriceMonitorService (the recurring cron
 * check) — the two calling contexts differ, but "how do we ask the
 * provider for a price" doesn't.
 *
 * Travelpayouts' calendar endpoint has no round-trip or multi-city concept
 * (unlike the Amadeus APIs this replaced) — it only prices a single
 * origin→destination leg per call. Round-trip and multi-city fares here are
 * therefore a sum of the cheapest fare found per leg, not a single combined
 * quote. That's a real accuracy tradeoff (real itineraries aren't always
 * priced as the sum of their legs), documented rather than hidden — see the
 * in-app price-disclaimer banner.
 */
@Injectable()
export class FareFinderService {
  constructor(private readonly priceCache: PriceCacheService) {}

  async findSimpleFare(query: SimpleFareQuery): Promise<FoundFare | null> {
    const outbound = await this.cheapestInRange(
      query.origin,
      query.destination,
      query.dateFrom,
      query.dateTo,
      query.currency,
    );
    if (!outbound) return null;

    if (query.returnDateFrom && query.returnDateTo) {
      const inbound = await this.cheapestInRange(
        query.destination,
        query.origin,
        query.returnDateFrom,
        query.returnDateTo,
        query.currency,
      );
      if (inbound) {
        return {
          departDate: outbound.date,
          returnDate: inbound.date,
          price: outbound.offer.price + inbound.offer.price,
          currency: query.currency,
          carrierCode: outbound.offer.airline,
          rawOffer: { outbound: outbound.offer, inbound: inbound.offer },
          source: 'travelpayouts_calendar',
        };
      }
      // No return-leg price found — fall through to outbound-only below
      // rather than failing the whole lookup.
    }

    return {
      departDate: outbound.date,
      returnDate: null,
      price: outbound.offer.price,
      currency: query.currency,
      carrierCode: outbound.offer.airline,
      rawOffer: outbound.offer,
      source: 'travelpayouts_calendar',
    };
  }

  async findMultiCityFare(
    query: MultiCityFareQuery,
  ): Promise<FoundFare | null> {
    if (query.legs.length < 2) return null;

    const sortedLegs = query.legs
      .slice()
      .sort((a, b) => a.sequenceNo - b.sequenceNo);
    const legResults: DatedOffer[] = [];

    for (const leg of sortedLegs) {
      // MVP prices each leg on its exact departure date (a single-day
      // "range") rather than scanning a window — keeps this to one call
      // per leg instead of one per leg per candidate date.
      const found = await this.cheapestInRange(
        leg.originIata,
        leg.destinationIata,
        leg.dateFrom,
        leg.dateFrom,
        query.currency,
      );
      if (!found) return null; // can't price the itinerary if any leg has no data
      legResults.push(found);
    }

    return {
      departDate: legResults[0].date,
      returnDate: null,
      price: legResults.reduce((sum, r) => sum + r.offer.price, 0),
      currency: query.currency,
      carrierCode: legResults[0].offer.airline,
      rawOffer: { legs: legResults },
      source: 'travelpayouts_multi_city_sum',
    };
  }

  /** Cheapest fare for origin→destination within [dateFrom, dateTo], fetching
   * one cached month-calendar per calendar month the range touches. */
  private async cheapestInRange(
    origin: string,
    destination: string,
    dateFrom: string,
    dateTo: string,
    currency: string,
  ): Promise<DatedOffer | null> {
    const months = this.monthsBetween(dateFrom, dateTo);
    const entries: DatedOffer[] = [];

    for (const month of months) {
      const calendar = await this.priceCache.getMonthCalendar(
        origin,
        destination,
        month,
        currency,
      );
      for (const [date, offer] of Object.entries(calendar)) {
        entries.push({ date, offer });
      }
    }

    const inRange = entries.filter(
      (entry) => entry.date >= dateFrom && entry.date <= dateTo,
    );
    if (inRange.length === 0) return null;

    return inRange.reduce((min, cur) =>
      cur.offer.price < min.offer.price ? cur : min,
    );
  }

  /** Every "YYYY-MM" the [dateFrom, dateTo] range touches. */
  private monthsBetween(dateFrom: string, dateTo: string): string[] {
    const months: string[] = [];
    const start = new Date(`${dateFrom}T00:00:00Z`);
    const end = new Date(`${dateTo}T00:00:00Z`);
    const cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
    );

    while (cursor <= end) {
      months.push(
        `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
  }
}
