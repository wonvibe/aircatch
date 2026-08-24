import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TravelpayoutsLatestPricesResponse,
  TravelpayoutsLatestPriceEntry,
} from './travelpayouts.types';

const BASE_URL = 'https://api.travelpayouts.com';
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;
// Max allowed by the endpoint. One call this size, cached, comfortably
// covers a route/one_way combo for every watch checking it for the cache's
// TTL — see price-cache.service.ts.
const LATEST_PRICES_LIMIT = 1000;

export interface TravelpayoutsUsageStats {
  /** Process start time — counts reset on restart, they are not persisted. */
  startedAt: string;
  latestPriceCalls: number;
}

/**
 * Thin client for the Travelpayouts (Aviasales) Data API — the price data
 * provider as of 2026-08, replacing Amadeus Self-Service (decommissioned
 * 2026-07-17, no self-service signup remains). Token auth only, no OAuth —
 * much simpler than the Amadeus client it replaces.
 *
 * Uses GET /v2/prices/latest, not the /v1/prices/calendar this originally
 * shipped with — that endpoint's docs claim omitting return_date returns
 * one-way fares, but live testing showed it always returns round-trip
 * prices (every entry carried a return_at with a realistic trip-length
 * gap, one_way params were silently ignored). /v2/prices/latest has a
 * `one_way` parameter that actually works (verified: one_way=true returns
 * entries with an empty return_date at roughly a third of the
 * one_way=false price for the same route/dates).
 *
 * Note on data freshness: like the old calendar endpoint, this is cached
 * data from real Aviasales searches (`found_at` in each entry), not a live
 * GDS quote — fine for a "has the price dropped lately" tracker, not a
 * substitute for a real-time fare check at booking time (hence the in-app
 * price-disclaimer banner).
 */
@Injectable()
export class TravelpayoutsService {
  private readonly logger = new Logger(TravelpayoutsService.name);
  private readonly startedAt = new Date().toISOString();
  private latestPriceCalls = 0;

  constructor(private readonly config: ConfigService) {}

  /** In-process call count since this instance started — Travelpayouts has
   * no monthly quota (unlike Amadeus's free tier), only a 10 req/s rate
   * limit, so this is ops visibility rather than a "running out" warning. */
  getUsageStats(): TravelpayoutsUsageStats {
    return {
      startedAt: this.startedAt,
      latestPriceCalls: this.latestPriceCalls,
    };
  }

  private get token(): string {
    const token = this.config.get<string>('TRAVELPAYOUTS_TOKEN');
    if (!token) {
      throw new Error('TRAVELPAYOUTS_TOKEN must be set (see .env.example).');
    }
    return token;
  }

  /** Cached fares for a route, one-way or round-trip depending on `oneWay`.
   * `period_type=year` pulls the whole cached year in one call regardless
   * of which specific dates a caller ultimately wants — cheaper than
   * per-month calls and matches how PriceCacheService caches this (one
   * entry per origin/destination/oneWay/currency, not per month). */
  async getLatestPrices(
    origin: string,
    destination: string,
    currency: string,
    oneWay: boolean,
  ): Promise<TravelpayoutsLatestPriceEntry[]> {
    const params = new URLSearchParams({
      origin,
      destination,
      currency,
      one_way: String(oneWay),
      period_type: 'year',
      beginning_of_period: new Date().toISOString().slice(0, 10),
      sorting: 'price',
      limit: String(LATEST_PRICES_LIMIT),
      show_to_affiliates: 'true',
    });

    const response = await this.request<TravelpayoutsLatestPricesResponse>(
      `/v2/prices/latest?${params.toString()}`,
    );
    this.latestPriceCalls += 1;

    if (!response.success) return [];
    return response.data;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await this.fetchWithTimeout(url);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // 429/5xx are worth a retry (rate limit or transient upstream issue);
      // anything else (400/401/404...) won't fix itself on retry.
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        const body = await response.text();
        throw new Error(
          `Travelpayouts request failed: ${response.status} ${body}`,
        );
      }

      this.logger.warn(
        `Travelpayouts ${path} returned ${response.status}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await this.sleep(BACKOFF_BASE_MS * 2 ** attempt);
    }

    throw new Error('Travelpayouts request failed after retries');
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        headers: { 'x-access-token': this.token },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
