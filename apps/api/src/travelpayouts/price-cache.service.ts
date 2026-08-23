import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TravelpayoutsService } from './travelpayouts.service';
import { TravelpayoutsCalendarOffer } from './travelpayouts.types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour, matches the plan's batch interval

/**
 * Wraps TravelpayoutsService.getMonthCalendar with the shared `price_cache`
 * table so many watches on the same route+month cost one upstream call per
 * hour, not one per watch. Caching is an optimization only — a cache
 * read/write failure never blocks the caller from getting a live result.
 */
@Injectable()
export class PriceCacheService {
  private readonly logger = new Logger(PriceCacheService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly travelpayouts: TravelpayoutsService,
  ) {}

  async getMonthCalendar(
    origin: string,
    destination: string,
    month: string,
    currency: string,
  ): Promise<Record<string, TravelpayoutsCalendarOffer>> {
    const cacheKey = `calendar_${origin}_${destination}_${month}_${currency}`;

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const calendar = await this.travelpayouts.getMonthCalendar(
      origin,
      destination,
      month,
      currency,
    );
    await this.writeCache(cacheKey, origin, destination, calendar);
    return calendar;
  }

  private async readCache(
    cacheKey: string,
  ): Promise<Record<string, TravelpayoutsCalendarOffer> | null> {
    const result = await this.supabase
      .getClient()
      .from('price_cache')
      .select('payload, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (result.error || !result.data) return null;
    if (new Date(result.data.expires_at).getTime() < Date.now()) return null;
    return result.data.payload as Record<string, TravelpayoutsCalendarOffer>;
  }

  private async writeCache(
    cacheKey: string,
    origin: string,
    destination: string,
    payload: Record<string, TravelpayoutsCalendarOffer>,
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
