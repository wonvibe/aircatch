import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TravelpayoutsService } from './travelpayouts.service';
import { TravelpayoutsLatestPriceEntry } from './travelpayouts.types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour, matches the plan's batch interval

/**
 * Wraps TravelpayoutsService.getLatestPrices with the shared `price_cache`
 * table so many watches on the same route+one_way cost one upstream call
 * per hour, not one per watch. Caching is an optimization only — a cache
 * read/write failure never blocks the caller from getting a live result.
 */
@Injectable()
export class PriceCacheService {
  private readonly logger = new Logger(PriceCacheService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly travelpayouts: TravelpayoutsService,
  ) {}

  async getLatestPrices(
    origin: string,
    destination: string,
    currency: string,
    oneWay: boolean,
  ): Promise<TravelpayoutsLatestPriceEntry[]> {
    const cacheKey = `latest_${origin}_${destination}_${oneWay ? 'ow' : 'rt'}_${currency}`;

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const entries = await this.travelpayouts.getLatestPrices(
      origin,
      destination,
      currency,
      oneWay,
    );
    await this.writeCache(cacheKey, origin, destination, entries);
    return entries;
  }

  private async readCache(
    cacheKey: string,
  ): Promise<TravelpayoutsLatestPriceEntry[] | null> {
    const result = await this.supabase
      .getClient()
      .from('price_cache')
      .select('payload, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (result.error || !result.data) return null;
    if (new Date(result.data.expires_at).getTime() < Date.now()) return null;
    return result.data.payload as TravelpayoutsLatestPriceEntry[];
  }

  private async writeCache(
    cacheKey: string,
    origin: string,
    destination: string,
    payload: TravelpayoutsLatestPriceEntry[],
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    const result = await this.supabase.getClient().from('price_cache').upsert(
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
        `Failed to write price_cache[${cacheKey}]: ${result.error.message}`,
      );
    }
  }
}
