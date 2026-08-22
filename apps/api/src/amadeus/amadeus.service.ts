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

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('AMADEUS_ENV') === 'production'
      ? 'https://api.amadeus.com'
      : 'https://test.api.amadeus.com';
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

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.getAccessToken();
      const response = await this.fetchWithTimeout(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
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
