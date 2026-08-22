import { Injectable, Logger } from '@nestjs/common';
import { AmadeusService } from '../amadeus/amadeus.service';
import type { AmadeusLocation } from '../amadeus/amadeus.types';
import { SupabaseService } from '../supabase/supabase.service';
import { AirportRow } from './airport.entities';

@Injectable()
export class AirportsService {
  private readonly logger = new Logger(AirportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly amadeus: AmadeusService,
  ) {}

  /**
   * Matches against the seeded/previously-upserted `airports` table first;
   * on a miss, falls back to the Amadeus Locations API and caches whatever
   * it finds (source='amadeus') so the next search for the same term is
   * local again.
   */
  async search(query: string): Promise<AirportRow[]> {
    // Strip characters that are syntactically meaningful in a PostgREST
    // `.or()` filter string (`,`, `(`, `)`) so user input can't reshape the
    // query — the table only holds public airport data, but a malformed
    // filter would otherwise surface as a confusing 400 to the client.
    const term = query.trim().replace(/[,()]/g, '');
    if (term.length < 2) {
      return [];
    }

    const local = await this.searchLocal(term);
    if (local.length > 0) {
      return local;
    }

    return this.searchAmadeusAndCache(term);
  }

  private async searchLocal(term: string): Promise<AirportRow[]> {
    const result = await this.supabase
      .getClient()
      .from('airports')
      .select('iata_code, name, city, country')
      .or(`name.ilike.%${term}%,city.ilike.%${term}%,iata_code.ilike.${term}%`)
      .order('iata_code', { ascending: true })
      .limit(20);

    if (result.error) {
      throw result.error;
    }
    return result.data ?? [];
  }

  private async searchAmadeusAndCache(term: string): Promise<AirportRow[]> {
    let locations: AmadeusLocation[];
    try {
      locations = await this.amadeus.searchLocations(term);
    } catch (err) {
      // Amadeus unreachable/misconfigured — degrade to "no results" rather
      // than 500ing the whole search request.
      this.logger.warn(
        `Amadeus location search failed for "${term}": ${(err as Error).message}`,
      );
      return [];
    }

    const rows: AirportRow[] = locations
      .filter((location) => location.iataCode)
      .map((location) => ({
        iata_code: location.iataCode,
        name: location.name,
        city: location.address?.cityName ?? location.name,
        country: location.address?.countryName ?? '',
      }));

    if (rows.length === 0) {
      return [];
    }

    const upserted = await this.supabase
      .getClient()
      .from('airports')
      .upsert(
        rows.map((row) => ({ ...row, source: 'amadeus' as const })),
        { onConflict: 'iata_code' },
      )
      .select('iata_code, name, city, country');

    if (upserted.error) {
      // Caching is an optimization, not correctness-critical — still return
      // what Amadeus gave us even if the upsert failed.
      this.logger.warn(
        `Failed to cache Amadeus airports: ${upserted.error.message}`,
      );
      return rows;
    }
    return upserted.data ?? rows;
  }
}
