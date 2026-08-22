import { Injectable } from '@nestjs/common';
import { AmadeusService } from '../amadeus/amadeus.service';
import { PriceCacheService } from '../amadeus/price-cache.service';
import type { AmadeusOriginDestination } from '../amadeus/amadeus.types';
import {
  FoundFare,
  MultiCityFareQuery,
  SimpleFareQuery,
} from './fare-finder.types';

/**
 * Turns a watch's route/date-range into "the cheapest fare Amadeus currently
 * has for it". Used both by WatchesService (one-shot capture on watch
 * creation) and PriceMonitorService (the recurring cron check) — the two
 * calling contexts differ, but "how do we ask Amadeus for a price" doesn't.
 */
@Injectable()
export class FareFinderService {
  constructor(
    private readonly amadeus: AmadeusService,
    private readonly priceCache: PriceCacheService,
  ) {}

  async findSimpleFare(query: SimpleFareQuery): Promise<FoundFare | null> {
    const offers = await this.priceCache.getCheapestDates(
      query.origin,
      query.destination,
      query.dateFrom,
      query.dateTo,
    );
    const cheapest = this.cheapest(offers, (offer) =>
      Number(offer.price.total),
    );
    if (!cheapest) return null;

    return {
      departDate: cheapest.departureDate,
      returnDate: cheapest.returnDate ?? null,
      price: Number(cheapest.price.total),
      currency: query.currency,
      carrierCode: null,
      rawOffer: cheapest,
      source: 'amadeus_flight_dates',
    };
  }

  async findMultiCityFare(
    query: MultiCityFareQuery,
  ): Promise<FoundFare | null> {
    if (query.legs.length < 2) return null;

    // MVP samples a single representative date per leg (the start of its
    // window) rather than scanning the whole range — flight-offers only
    // accepts one date per request and multi-city itineraries are expensive
    // to query. The cron sweep (PriceMonitorService) runs this on a slower,
    // lower-volume cadence to keep the call count sane.
    const originDestinations: AmadeusOriginDestination[] = query.legs
      .slice()
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((leg, index) => ({
        id: String(index + 1),
        originLocationCode: leg.originIata,
        destinationLocationCode: leg.destinationIata,
        departureDateTimeRange: { date: leg.dateFrom },
      }));

    const offers = await this.amadeus.searchFlightOffers(
      originDestinations,
      query.adults,
    );
    const cheapest = this.cheapest(offers, (offer) =>
      Number(offer.price.total),
    );
    if (!cheapest) return null;

    const firstLeg = cheapest.itineraries[0]?.segments[0];

    return {
      departDate: firstLeg?.departure.at.slice(0, 10) ?? query.legs[0].dateFrom,
      returnDate: null,
      price: Number(cheapest.price.total),
      currency: cheapest.price.currency,
      carrierCode: firstLeg?.carrierCode ?? null,
      rawOffer: cheapest,
      source: 'amadeus_flight_offers',
    };
  }

  private cheapest<T>(items: T[], priceOf: (item: T) => number): T | null {
    return items.reduce<T | null>(
      (min, item) => (!min || priceOf(item) < priceOf(min) ? item : min),
      null,
    );
  }
}
