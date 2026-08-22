import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AirportRow } from './airport.entities';

@Injectable()
export class AirportsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Cache-only search for now: matches against the seeded/previously-upserted
   * `airports` table. Phase 2 adds the Amadeus Locations fallback on a
   * cache miss (upserting results here with source='amadeus').
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
}
