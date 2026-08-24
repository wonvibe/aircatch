import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AirportRow } from './airport.entities';
import { AirportResponse } from './airport.types';

@Injectable()
export class AirportsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Matches against the `airports` table only. There used to be a live
   * external fallback here (Amadeus Locations, then a candidate
   * Travelpayouts equivalent) — dropped in favor of importing
   * Travelpayouts' full public airports/cities/countries reference data
   * into this table once (see scripts/import-airports.ts), which covers
   * every commercial airport without a per-keystroke external call. Run
   * that script if a search comes up empty for a real airport.
   */
  async search(query: string): Promise<AirportResponse[]> {
    // Strip characters that are syntactically meaningful in a PostgREST
    // `.or()` filter string (`,`, `(`, `)`) so user input can't reshape the
    // query — the table only holds public airport data, but a malformed
    // filter would otherwise surface as a confusing 400 to the client.
    const term = query.trim().replace(/[,()]/g, '');
    if (term.length < 2) {
      return [];
    }

    const rows = await this.searchLocal(term);
    return rows.map((row) => this.toResponse(row));
  }

  // Used by the mobile edit-watch screen to hydrate an AirportSearchInput's
  // initial value from a watch's stored IATA code — watches only persist
  // the code, not the city/name display text search needs.
  async getByCode(iataCode: string): Promise<AirportResponse> {
    const result = await this.supabase
      .getClient()
      .from('airports')
      .select('iata_code, name, city, country')
      .eq('iata_code', iataCode.toUpperCase())
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) throw new NotFoundException('Airport not found');
    return this.toResponse(result.data);
  }

  private toResponse(row: AirportRow): AirportResponse {
    return {
      iataCode: row.iata_code,
      name: row.name,
      city: row.city,
      country: row.country,
    };
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
}
