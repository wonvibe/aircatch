import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { FareFinderService } from '../pricing/fare-finder.service';
import type { FoundFare } from '../pricing/fare-finder.types';
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

@Injectable()
export class WatchesService {
  private readonly logger = new Logger(WatchesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly fareFinder: FareFinderService,
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
    // it, and the Phase 3 cron will retry on its next pass), so a failed or
    // unconfigured Amadeus call never fails the request.
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
          ? await this.fareFinder.findMultiCityFare({
              legs: segments.map((s) => ({
                sequenceNo: s.sequence_no,
                originIata: s.origin_iata,
                destinationIata: s.destination_iata,
                dateFrom: s.date_from,
              })),
              adults: watch.adults,
            })
          : await this.fareFinder.findSimpleFare({
              origin: watch.origin_iata as string,
              destination: watch.destination_iata as string,
              dateFrom: watch.depart_date_from,
              dateTo: watch.depart_date_to,
              currency: watch.currency,
            });

      if (!found) return watch;
      return await this.applyInitialBaseline(watch, found);
    } catch (err) {
      this.logger.warn(
        `Baseline capture failed for watch ${watch.id} (${watch.trip_type} ${watch.origin_iata ?? 'multi'}->${watch.destination_iata ?? 'multi'}): ${(err as Error).message}`,
      );
      return watch;
    }
  }

  /** Only ever called right after insert, when baseline_price is guaranteed
   * null — so an unconditional overwrite is safe. The cron's ongoing
   * "should this update the baseline / trigger a notification" logic lives
   * in PriceMonitorService instead, since the two situations differ. */
  private async applyInitialBaseline(
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
