import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { AmadeusService } from '../amadeus/amadeus.service';
import { PriceCacheService } from '../amadeus/price-cache.service';
import type { AmadeusOriginDestination } from '../amadeus/amadeus.types';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateWatchDto } from './dto/create-watch.dto';
import { UpdateWatchDto } from './dto/update-watch.dto';
import {
  PriceHistoryRow,
  WatchRow,
  WatchRowWithSegments,
  WatchSegmentRow,
} from './watch.entities';
import {
  PriceHistoryEntry,
  WatchResponse,
  WatchSegmentResponse,
} from './watch.types';

interface FoundFare {
  departDate: string;
  returnDate: string | null;
  price: number;
  currency: string;
  carrierCode: string | null;
  rawOffer: unknown;
  source: 'amadeus_flight_dates' | 'amadeus_flight_offers';
}

@Injectable()
export class WatchesService {
  private readonly logger = new Logger(WatchesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly amadeus: AmadeusService,
    private readonly priceCache: PriceCacheService,
  ) {}

  async create(userId: string, dto: CreateWatchDto): Promise<WatchResponse> {
    const client = this.supabase.getClient();

    const inserted = await client
      .from('watches')
      .insert(this.toWatchRow(userId, dto))
      .select()
      .single();

    if (inserted.error) this.handleDbError(inserted.error);
    let watch = inserted.data;

    let segments: WatchSegmentRow[] = [];
    if (dto.tripType === 'multi_city') {
      const segmentRows = (dto.segments ?? []).map((segment) => ({
        watch_id: watch.id,
        sequence_no: segment.sequenceNo,
        origin_iata: segment.originIata,
        destination_iata: segment.destinationIata,
        date_from: segment.dateFrom,
        date_to: segment.dateTo,
      }));

      const insertedSegments = await client
        .from('watch_segments')
        .insert(segmentRows)
        .select();

      if (insertedSegments.error) {
        // Best-effort rollback: Supabase JS has no cross-table transaction
        // here, so drop the orphaned parent row before surfacing the error.
        await client.from('watches').delete().eq('id', watch.id);
        this.handleDbError(insertedSegments.error);
      }

      segments = insertedSegments.data;
    }

    // Best-effort: a watch is still useful without a baseline (the user sees
    // it, Phase 3's cron will eventually populate baseline_price on its next
    // pass), so a failed/unconfigured Amadeus call never fails the request.
    watch = await this.captureBaseline(watch, segments);

    return this.toWatchResponse(watch, segments);
  }

  async findAllForUser(userId: string): Promise<WatchResponse[]> {
    const result = await this.supabase
      .getClient()
      .from('watches')
      .select('*, watch_segments(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (result.error) this.handleDbError(result.error);
    const rows = (result.data ?? []) as WatchRowWithSegments[];

    return rows.map((row) => this.toWatchResponse(row, row.watch_segments));
  }

  async findOneForUser(userId: string, id: string): Promise<WatchResponse> {
    const row = await this.getOwnedWatchRow(userId, id);
    return this.toWatchResponse(row, row.watch_segments);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateWatchDto,
  ): Promise<WatchResponse> {
    if (dto.targetPrice === undefined && dto.status === undefined) {
      return this.findOneForUser(userId, id);
    }

    const patch: Partial<Pick<WatchRow, 'target_price' | 'status'>> = {};
    if (dto.targetPrice !== undefined) patch.target_price = dto.targetPrice;
    if (dto.status !== undefined) patch.status = dto.status;

    const result = await this.supabase
      .getClient()
      .from('watches')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, watch_segments(*)')
      .maybeSingle();

    if (result.error) this.handleDbError(result.error);
    if (!result.data) throw new NotFoundException('Watch not found');

    const row = result.data as WatchRowWithSegments;
    return this.toWatchResponse(row, row.watch_segments);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.supabase
      .getClient()
      .from('watches')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (result.error) this.handleDbError(result.error);
    if (!result.data) throw new NotFoundException('Watch not found');
  }

  async getPriceHistory(
    userId: string,
    watchId: string,
    days: number,
  ): Promise<PriceHistoryEntry[]> {
    // Ownership check first — also turns "not yours"/"doesn't exist" into a
    // uniform 404 instead of leaking existence via an empty array.
    await this.getOwnedWatchRow(userId, watchId);

    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await this.supabase
      .getClient()
      .from('price_history')
      .select(
        'id, checked_at, depart_date, return_date, price, currency, carrier_code, source',
      )
      .eq('watch_id', watchId)
      .gte('checked_at', since)
      .order('checked_at', { ascending: true });

    if (result.error) this.handleDbError(result.error);
    const rows = (result.data ?? []) as PriceHistoryRow[];

    return rows.map((row) => ({
      id: row.id,
      checkedAt: row.checked_at,
      departDate: row.depart_date,
      returnDate: row.return_date,
      price: Number(row.price),
      currency: row.currency,
      carrierCode: row.carrier_code,
      source: row.source,
    }));
  }

  private async getOwnedWatchRow(
    userId: string,
    id: string,
  ): Promise<WatchRowWithSegments> {
    const result = await this.supabase
      .getClient()
      .from('watches')
      .select('*, watch_segments(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (result.error) this.handleDbError(result.error);
    if (!result.data) throw new NotFoundException('Watch not found');

    return result.data;
  }

  /** Fetches the current cheapest fare from Amadeus and records it as the
   * watch's baseline. Never throws — a failure just leaves baseline_price
   * null and gets logged, so watch creation always succeeds. */
  private async captureBaseline(
    watch: WatchRow,
    segments: WatchSegmentRow[],
  ): Promise<WatchRow> {
    try {
      const found =
        watch.trip_type === 'multi_city'
          ? await this.findMultiCityFare(watch, segments)
          : await this.findSimpleFare(watch);

      if (!found) return watch;
      return await this.applyBaseline(watch, found);
    } catch (err) {
      this.logger.warn(
        `Baseline capture failed for watch ${watch.id} (${watch.trip_type} ${watch.origin_iata ?? 'multi'}->${watch.destination_iata ?? 'multi'}): ${(err as Error).message}`,
      );
      return watch;
    }
  }

  private async findSimpleFare(watch: WatchRow): Promise<FoundFare | null> {
    const offers = await this.priceCache.getCheapestDates(
      watch.origin_iata as string,
      watch.destination_iata as string,
      watch.depart_date_from,
      watch.depart_date_to,
    );
    const cheapest = this.cheapest(offers, (offer) =>
      Number(offer.price.total),
    );
    if (!cheapest) return null;

    return {
      departDate: cheapest.departureDate,
      returnDate: cheapest.returnDate ?? null,
      price: Number(cheapest.price.total),
      currency: watch.currency,
      carrierCode: null,
      rawOffer: cheapest,
      source: 'amadeus_flight_dates',
    };
  }

  private async findMultiCityFare(
    watch: WatchRow,
    segments: WatchSegmentRow[],
  ): Promise<FoundFare | null> {
    if (segments.length < 2) return null;

    // MVP samples a single representative date per leg (the start of its
    // window) rather than scanning the whole range — flight-offers only
    // accepts one date per request and multi-city itineraries are expensive
    // to query. Wider date coverage is a Phase 3 concern (the cron job can
    // afford to sample a few dates per leg on a slower cadence).
    const originDestinations: AmadeusOriginDestination[] = segments
      .slice()
      .sort((a, b) => a.sequence_no - b.sequence_no)
      .map((segment, index) => ({
        id: String(index + 1),
        originLocationCode: segment.origin_iata,
        destinationLocationCode: segment.destination_iata,
        departureDateTimeRange: { date: segment.date_from },
      }));

    const offers = await this.amadeus.searchFlightOffers(
      originDestinations,
      watch.adults,
    );
    const cheapest = this.cheapest(offers, (offer) =>
      Number(offer.price.total),
    );
    if (!cheapest) return null;

    const firstLeg = cheapest.itineraries[0]?.segments[0];

    return {
      departDate: firstLeg?.departure.at.slice(0, 10) ?? segments[0].date_from,
      returnDate: null,
      price: Number(cheapest.price.total),
      currency: cheapest.price.currency,
      carrierCode: firstLeg?.carrierCode ?? null,
      rawOffer: cheapest,
      source: 'amadeus_flight_offers',
    };
  }

  private cheapest<T>(items: T[], priceOf: (item: T) => number): T | null {
    return items.reduce<T | null>(
      (min, item) => (!min || priceOf(item) < priceOf(min) ? item : min),
      null,
    );
  }

  private async applyBaseline(
    watch: WatchRow,
    found: FoundFare,
  ): Promise<WatchRow> {
    const client = this.supabase.getClient();

    const historyInsert = await client.from('price_history').insert({
      watch_id: watch.id,
      depart_date: found.departDate,
      return_date: found.returnDate,
      price: found.price,
      currency: found.currency,
      carrier_code: found.carrierCode,
      raw_offer: found.rawOffer,
      source: found.source,
    });
    if (historyInsert.error) {
      this.logger.warn(
        `Failed to record price_history for watch ${watch.id}: ${historyInsert.error.message}`,
      );
    }

    const watchUpdate = await client
      .from('watches')
      .update({
        baseline_price: found.price,
        baseline_captured_at: new Date().toISOString(),
        baseline_offer_snapshot: found.rawOffer,
      })
      .eq('id', watch.id)
      .select()
      .maybeSingle();

    if (watchUpdate.error || !watchUpdate.data) {
      this.logger.warn(
        `Failed to persist baseline for watch ${watch.id}: ${watchUpdate.error?.message}`,
      );
      return watch;
    }
    return watchUpdate.data;
  }

  private toWatchRow(userId: string, dto: CreateWatchDto) {
    const isMultiCity = dto.tripType === 'multi_city';
    return {
      user_id: userId,
      trip_type: dto.tripType,
      origin_iata: isMultiCity ? null : dto.originIata,
      destination_iata: isMultiCity ? null : dto.destinationIata,
      depart_date_from: dto.departDateFrom,
      depart_date_to: dto.departDateTo,
      return_date_from: dto.returnDateFrom ?? null,
      return_date_to: dto.returnDateTo ?? null,
      adults: dto.adults ?? 1,
      target_price: dto.targetPrice,
      currency: dto.currency ?? 'KRW',
    };
  }

  private toWatchResponse(
    row: WatchRow,
    segments: WatchSegmentRow[],
  ): WatchResponse {
    return {
      id: row.id,
      tripType: row.trip_type,
      originIata: row.origin_iata,
      destinationIata: row.destination_iata,
      departDateFrom: row.depart_date_from,
      departDateTo: row.depart_date_to,
      returnDateFrom: row.return_date_from,
      returnDateTo: row.return_date_to,
      adults: row.adults,
      targetPrice: Number(row.target_price),
      currency: row.currency,
      baselinePrice:
        row.baseline_price !== null ? Number(row.baseline_price) : null,
      baselineCapturedAt: row.baseline_captured_at,
      lastNotifiedPrice:
        row.last_notified_price !== null
          ? Number(row.last_notified_price)
          : null,
      lastNotifiedAt: row.last_notified_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      segments:
        row.trip_type === 'multi_city'
          ? segments
              .slice()
              .sort((a, b) => a.sequence_no - b.sequence_no)
              .map((segment) => this.toSegmentResponse(segment))
          : undefined,
    };
  }

  private toSegmentResponse(row: WatchSegmentRow): WatchSegmentResponse {
    return {
      id: row.id,
      sequenceNo: row.sequence_no,
      originIata: row.origin_iata,
      destinationIata: row.destination_iata,
      dateFrom: row.date_from,
      dateTo: row.date_to,
    };
  }

  private handleDbError(error: PostgrestError): never {
    // 23503 = foreign_key_violation (e.g. unknown IATA code), 23514 = check_violation
    // (e.g. depart_date_from > depart_date_to) — surface both as 400s instead of 500s.
    if (error.code === '23503') {
      throw new BadRequestException('Referenced airport does not exist');
    }
    if (error.code === '23514') {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
