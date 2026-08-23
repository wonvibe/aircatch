import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TravelpayoutsCalendarResponse,
  TravelpayoutsCalendarOffer,
} from './travelpayouts.types';

const BASE_URL = 'https://api.travelpayouts.com';
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;

export interface TravelpayoutsUsageStats {
  /** Process start time — counts reset on restart, they are not persisted. */
  startedAt: string;
  calendarCalls: number;
}

/**
 * Thin client for the Travelpayouts (Aviasales) Data API — the price data
 * provider as of 2026-08, replacing Amadeus Self-Service (decommissioned
 * 2026-07-17, no self-service signup remains). Token auth only, no OAuth —
 * much simpler than the Amadeus client it replaces.
 *
 * Note on data freshness: this is cached data from real Aviasales searches,
 * refreshed roughly every 7 days per Travelpayouts' own docs — not a live
 * GDS quote. Fine for a "has the price dropped lately" tracker; not a
 * substitute for a real-time fare check at booking time (hence the
 * in-app price-disclaimer banner).
 */
@Injectable()
export class TravelpayoutsService {
  private readonly logger = new Logger(TravelpayoutsService.name);
  private readonly startedAt = new Date().toISOString();
  private calendarCalls = 0;

  constructor(private readonly config: ConfigService) {}

  /** In-process call count since this instance started — Travelpayouts has
   * no monthly quota (unlike Amadeus's free tier), only a 10 req/s rate
   * limit, so this is ops visibility rather than a "running out" warning. */
  getUsageStats(): TravelpayoutsUsageStats {
    return { startedAt: this.startedAt, calendarCalls: this.calendarCalls };
  }

  private get token(): string {
    const token = this.config.get<string>('TRAVELPAYOUTS_TOKEN');
    if (!token) {
      throw new Error('TRAVELPAYOUTS_TOKEN must be set (see .env.example).');
    }
    return token;
  }

  /** One calendar month of cheapest fares for a route, keyed by departure date. */
  async getMonthCalendar(
    origin: string,
    destination: string,
    month: string, // YYYY-MM
    currency: string,
  ): Promise<Record<string, TravelpayoutsCalendarOffer>> {
    const params = new URLSearchParams({
      origin,
      destination,
      depart_date: month,
      calendar_type: 'departure_date',
      currency,
    });

    const response = await this.request<TravelpayoutsCalendarResponse>(
      `/v1/prices/calendar?${params.toString()}`,
    );
    this.calendarCalls += 1;

    if (!response.success || Array.isArray(response.data)) {
      return {};
    }
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
