import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AmadeusService } from './amadeus.service';
import { AmadeusFlightDateOffer } from './amadeus.types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour, matches the plan's batch interval

/**
 * Wraps AmadeusService.searchCheapestDates with the shared
 * `amadeus_price_cache` table so that many users watching the same popular
 * route (e.g. ICN→BKK) cost one Amadeus call per hour, not one per watch.
 * Caching is an optimization only — a cache read/write failure never blocks
 * the caller from getting a live Amadeus result.
 */
@Injectable()
export class PriceCacheService {
  private readonly logger = new Logger(PriceCacheService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly amadeus: AmadeusService,
  ) {}

  async getCheapestDates(
    origin: string,
    destination: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AmadeusFlightDateOffer[]> {
    const cacheKey = `flight_dates_${origin}_${destination}_${dateFrom}_${dateTo}`;

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const offers = await this.amadeus.searchCheapestDates(
      origin,
      destination,
      dateFrom,
      dateTo,
    );
    await this.writeCache(cacheKey, origin, destination, offers);
    return offers;
  }

  private async readCache(
    cacheKey: string,
  ): Promise<AmadeusFlightDateOffer[] | null> {
    const result = await this.supabase
      .getClient()
      .from('amadeus_price_cache')
      .select('payload, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (result.error || !result.data) return null;
    if (new Date(result.data.expires_at).getTime() < Date.now()) return null;
    return result.data.payload as AmadeusFlightDateOffer[];
  }

  private async writeCache(
    cacheKey: string,
    origin: string,
    destination: string,
    payload: AmadeusFlightDateOffer[],
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    const result = await this.supabase
      .getClient()
      .from('amadeus_price_cache')
      .upsert(
        {
          cache_key: cacheKey,
          origin_iata: origin,
          destination_iata: destination,
          payload,
          expires_at: expiresAt,
        },
        { onConflict: 'cache_key' },
      );

    if (result.error) {
      this.logger.warn(
        `Failed to write amadeus_price_cache[${cacheKey}]: ${result.error.message}`,
      );
    }
  }
}
