import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmadeusFlightDateOffer,
  AmadeusFlightOffer,
  AmadeusLocation,
  AmadeusOriginDestination,
  AmadeusTokenResponse,
} from './amadeus.types';

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;
// Refresh a bit before the token actually expires to avoid a request racing
// against expiry mid-flight.
const TOKEN_REFRESH_SLACK_MS = 5_000;

type EndpointCategory = 'flight-dates' | 'flight-offers' | 'locations';

// Amadeus's free Self-Service tier meters each API separately (order of
// ~1-2k calls/month depending on the endpoint) — these are rough
// checkpoints to get a log line before a batch run silently exhausts the
// month's quota, not an exact reading of the real limit.
const USAGE_WARN_THRESHOLDS = [500, 1000, 1500, 1900];

export interface AmadeusUsageStats {
  /** Process start time — counts reset on restart, they are not persisted. */
  startedAt: string;
  callsByEndpoint: Record<EndpointCategory, number>;
  totalCalls: number;
}

/**
 * Thin client for the Amadeus Self-Service API (OAuth2 client-credentials,
 * cheapest-date search, flight-offers search, and airport/city locations).
 *
 * Deliberately has no knowledge of Supabase or watches — callers own caching
 * (see PriceCacheService) and persistence. Every failure is a thrown Error;
 * callers decide whether that's fatal (e.g. best-effort baseline capture
 * swallows it) or not.
 */
@Injectable()
export class AmadeusService {
  private readonly logger = new Logger(AmadeusService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private readonly startedAt = new Date().toISOString();
  private readonly usage: Record<EndpointCategory, number> = {
    'flight-dates': 0,
    'flight-offers': 0,
    locations: 0,
  };

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('AMADEUS_ENV') === 'production'
      ? 'https://api.amadeus.com'
      : 'https://test.api.amadeus.com';
  }

  getUsageStats(): AmadeusUsageStats {
    const totalCalls = Object.values(this.usage).reduce((sum, n) => sum + n, 0);
    return {
      startedAt: this.startedAt,
      callsByEndpoint: { ...this.usage },
      totalCalls,
    };
  }

  async searchCheapestDates(
    origin: string,
    destination: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AmadeusFlightDateOffer[]> {
    const params = new URLSearchParams({
      origin,
      destination,
      departureDate: `${dateFrom},${dateTo}`,
    });
    const response = await this.request<{ data: AmadeusFlightDateOffer[] }>(
      `/v1/shopping/flight-dates?${params.toString()}`,
      undefined,
      'flight-dates',
    );
    return response.data ?? [];
  }

  async searchLocations(keyword: string): Promise<AmadeusLocation[]> {
    const params = new URLSearchParams({
      subType: 'AIRPORT,CITY',
      keyword,
      'page[limit]': '10',
    });
    const response = await this.request<{ data: AmadeusLocation[] }>(
      `/v1/reference-data/locations?${params.toString()}`,
      undefined,
      'locations',
    );
    return response.data ?? [];
  }

  async searchFlightOffers(
    originDestinations: AmadeusOriginDestination[],
    adults: number,
  ): Promise<AmadeusFlightOffer[]> {
    const response = await this.request<{ data: AmadeusFlightOffer[] }>(
      '/v2/shopping/flight-offers',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyCode: 'KRW',
          originDestinations,
          travelers: Array.from({ length: Math.max(adults, 1) }, (_, i) => ({
            id: String(i + 1),
            travelerType: 'ADULT',
          })),
          sources: ['GDS'],
          searchCriteria: { maxFlightOffers: 5 },
        }),
      },
      'flight-offers',
    );
    return response.data ?? [];
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.tokenCache &&
      this.tokenCache.expiresAt > now + TOKEN_REFRESH_SLACK_MS
    ) {
      return this.tokenCache.token;
    }

    const clientId = this.config.get<string>('AMADEUS_CLIENT_ID');
    const clientSecret = this.config.get<string>('AMADEUS_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error(
        'AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET must be set (see .env.example).',
      );
    }

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/v1/security/oauth2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Amadeus OAuth failed: ${response.status} ${await response.text()}`,
      );
    }

    const data = (await response.json()) as AmadeusTokenResponse;
    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private async request<T>(
    path: string,
    init: RequestInit | undefined,
    category: EndpointCategory,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.getAccessToken();
      const response = await this.fetchWithTimeout(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        this.recordUsage(category);
        return (await response.json()) as T;
      }

      // 429/5xx are worth a retry (rate limit or transient upstream issue);
      // anything else (400/401/404...) won't fix itself on retry.
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        const body = await response.text();
        throw new Error(`Amadeus request failed: ${response.status} ${body}`);
      }

      this.logger.warn(
        `Amadeus ${path} returned ${response.status}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await this.sleep(BACKOFF_BASE_MS * 2 ** attempt);
    }

    // Unreachable — the loop above always returns or throws — but keeps TS happy.
    throw new Error('Amadeus request failed after retries');
  }

  private recordUsage(category: EndpointCategory): void {
    this.usage[category] += 1;
    const total = Object.values(this.usage).reduce((sum, n) => sum + n, 0);
    if (USAGE_WARN_THRESHOLDS.includes(total)) {
      this.logger.warn(
        `Amadeus API usage has reached ${total} calls since ${this.startedAt} (${JSON.stringify(this.usage)}) — check free-tier quota.`,
      );
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
