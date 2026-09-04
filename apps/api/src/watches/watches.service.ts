import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { FareFinderService } from '../pricing/fare-finder.service';
import type {
  CalendarDateEntry,
  FoundFare,
  MultiCityLegResult,
} from '../pricing/fare-finder.types';
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
  PriceHistoryLeg,
  WatchResponse,
  WatchSegmentResponse,
} from './watch.types';

type WatchUpdatePatch = Partial<
  Omit<WatchRow, 'id' | 'user_id' | 'trip_type' | 'created_at' | 'updated_at'>
>;

@Injectable()
export class WatchesService {
  private readonly logger = new Logger(WatchesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly fareFinder: FareFinderService,
  ) {}

  async create(userId: string, dto: CreateWatchDto): Promise<WatchResponse> {
    // The DTO leaves returnDateFrom/To optional for every trip type (their
    // legality genuinely depends on tripType, same reasoning as
    // UpdateWatchDto's comment) — but leaving them silently unenforced
    // here once let a round_trip watch save with no return dates, which
    // fare-finder.service.ts's findSimpleFare then quietly priced (and
    // booking.ts then linked) as one-way instead of round-trip.
    if (
      dto.tripType === 'round_trip' &&
      (!dto.returnDateFrom || !dto.returnDateTo)
    ) {
      throw new BadRequestException(
        'returnDateFrom/returnDateTo are required for round_trip watches',
      );
    }

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
    // unconfigured Travelpayouts call never fails the request.
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
    const existing = await this.getOwnedWatchRow(userId, id);
    const isMultiCity = existing.trip_type === 'multi_city';

    if (dto.segments && !isMultiCity) {
      throw new BadRequestException(
        'segments can only be set on a multi_city watch',
      );
    }
    if ((dto.originIata || dto.destinationIata) && isMultiCity) {
      throw new BadRequestException(
        'originIata/destinationIata cannot be set on a multi_city watch — edit segments instead',
      );
    }

    const client = this.supabase.getClient();
    const patch: WatchUpdatePatch = {};
    if (dto.targetPrice !== undefined) patch.target_price = dto.targetPrice;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.adults !== undefined) patch.adults = dto.adults;

    // Any edit to route or dates invalidates the existing baseline/history —
    // they described a different itinerary. Rather than leave a stale
    // baseline in place (misleading "기준가" comparisons) or try to patch it
    // in place, treat this the same as a fresh watch: reset the derived
    // fields below and recapture from scratch, same as create() does.
    let itineraryChanged = false;

    if (!isMultiCity) {
      if (
        dto.originIata !== undefined &&
        dto.originIata !== existing.origin_iata
      ) {
        patch.origin_iata = dto.originIata;
        itineraryChanged = true;
      }
      if (
        dto.destinationIata !== undefined &&
        dto.destinationIata !== existing.destination_iata
      ) {
        patch.destination_iata = dto.destinationIata;
        itineraryChanged = true;
      }
      if (
        dto.departDateFrom !== undefined &&
        dto.departDateFrom !== existing.depart_date_from
      ) {
        patch.depart_date_from = dto.departDateFrom;
        itineraryChanged = true;
      }
      if (
        dto.departDateTo !== undefined &&
        dto.departDateTo !== existing.depart_date_to
      ) {
        patch.depart_date_to = dto.departDateTo;
        itineraryChanged = true;
      }
      if (
        dto.returnDateFrom !== undefined &&
        dto.returnDateFrom !== (existing.return_date_from ?? undefined)
      ) {
        patch.return_date_from = dto.returnDateFrom;
        itineraryChanged = true;
      }
      if (
        dto.returnDateTo !== undefined &&
        dto.returnDateTo !== (existing.return_date_to ?? undefined)
      ) {
        patch.return_date_to = dto.returnDateTo;
        itineraryChanged = true;
      }

      const nextFrom = patch.depart_date_from ?? existing.depart_date_from;
      const nextTo = patch.depart_date_to ?? existing.depart_date_to;
      if (nextFrom > nextTo) {
        throw new BadRequestException(
          '탐색 시작일이 종료일보다 늦을 수 없어요.',
        );
      }
    }

    if (itineraryChanged) {
      patch.baseline_price = null;
      patch.baseline_captured_at = null;
      patch.baseline_offer_snapshot = null;
      patch.latest_price = null;
      patch.latest_checked_at = null;
      patch.last_notified_price = null;
      patch.last_notified_at = null;
    }

    if (Object.keys(patch).length === 0 && !dto.segments) {
      return this.toWatchResponse(existing, existing.watch_segments);
    }

    // Supabase/PostgREST rejects (or no-ops oddly on) an update with an
    // empty column set — a segments-only edit legitimately has nothing to
    // patch on the watches row itself, so skip the call entirely rather
    // than send `{}` and misread the result as "not found".
    let watch: WatchRow = existing;
    if (Object.keys(patch).length > 0) {
      const result = await client
        .from('watches')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (result.error) this.handleDbError(result.error);
      if (!result.data) throw new NotFoundException('Watch not found');
      watch = result.data;
    }

    let segments = existing.watch_segments;
    let segmentsChanged = false;
    if (isMultiCity && dto.segments) {
      const deleted = await client
        .from('watch_segments')
        .delete()
        .eq('watch_id', id);
      if (deleted.error) this.handleDbError(deleted.error);

      const segmentRows = dto.segments.map((segment) => ({
        watch_id: id,
        sequence_no: segment.sequenceNo,
        origin_iata: segment.originIata,
        destination_iata: segment.destinationIata,
        date_from: segment.dateFrom,
        date_to: segment.dateTo,
      }));
      const inserted = await client
        .from('watch_segments')
        .insert(segmentRows)
        .select();
      if (inserted.error) this.handleDbError(inserted.error);

      segments = inserted.data;
      segmentsChanged = true;

      // Segments carry multi_city's route/dates instead of the top-level
      // columns, but those columns still gate the cron's active-watch
      // queries (see PriceMonitorService.fetchActiveMultiCityWatches) —
      // keep them spanning the new segment dates, same as create()'s
      // NewWatchScreen-driven derivation.
      const segmentDates = dto.segments.map((s) => s.dateFrom);
      const rangeFrom = segmentDates.reduce((a, b) => (a < b ? a : b));
      const rangeTo = segmentDates.reduce((a, b) => (a > b ? a : b));
      const rangeUpdate = await client
        .from('watches')
        .update({ depart_date_from: rangeFrom, depart_date_to: rangeTo })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (rangeUpdate.error) this.handleDbError(rangeUpdate.error);
      if (rangeUpdate.data) watch = rangeUpdate.data;
    }

    if (itineraryChanged || segmentsChanged) {
      // Stale data for the old route/dates — wipe it rather than let it mix
      // with the new itinerary's chart/recommendations.
      await client.from('price_history').delete().eq('watch_id', id);
      await client.from('price_calendar_snapshot').delete().eq('watch_id', id);
      watch = await this.captureBaseline(watch, segments);
    }

    return this.toWatchResponse(watch, segments);
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
        'id, checked_at, depart_date, return_date, price, currency, carrier_code, source, raw_offer',
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
      legs:
        row.source === 'travelpayouts_multi_city_sum'
          ? this.parseMultiCityLegs(row.raw_offer)
          : undefined,
    }));
  }

  async getCalendarSnapshot(
    userId: string,
    watchId: string,
  ): Promise<CalendarDateEntry[]> {
    await this.getOwnedWatchRow(userId, watchId);

    const result = await this.supabase
      .getClient()
      .from('price_calendar_snapshot')
      .select('entries')
      .eq('watch_id', watchId)
      .maybeSingle();

    if (result.error) this.handleDbError(result.error);
    return (result.data?.entries as CalendarDateEntry[] | undefined) ?? [];
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

  /** Fetches the current cheapest fare from Travelpayouts and records it as
   * the watch's baseline. Never throws — a failure just leaves
   * baseline_price null and gets logged, so watch creation always succeeds. */
  private async captureBaseline(
    watch: WatchRow,
    segments: WatchSegmentRow[],
  ): Promise<WatchRow> {
    try {
      if (watch.trip_type === 'multi_city') {
        const found = await this.fareFinder.findMultiCityFare({
          legs: segments.map((s) => ({
            sequenceNo: s.sequence_no,
            originIata: s.origin_iata,
            destinationIata: s.destination_iata,
            dateFrom: s.date_from,
          })),
          currency: watch.currency,
        });
        if (!found) return watch;
        return await this.applyInitialBaseline(watch, found);
      }

      const { best, dailyEntries } = await this.fareFinder.findSimpleFare({
        origin: watch.origin_iata as string,
        destination: watch.destination_iata as string,
        dateFrom: watch.depart_date_from,
        dateTo: watch.depart_date_to,
        returnDateFrom: watch.return_date_from ?? undefined,
        returnDateTo: watch.return_date_to ?? undefined,
        currency: watch.currency,
      });

      if (dailyEntries.length > 0) {
        await this.saveCalendarSnapshot(watch.id, dailyEntries);
      }
      if (!best) return watch;
      return await this.applyInitialBaseline(watch, best);
    } catch (err) {
      this.logger.warn(
        `Baseline capture failed for watch ${watch.id} (${watch.trip_type} ${watch.origin_iata ?? 'multi'}->${watch.destination_iata ?? 'multi'}): ${(err as Error).message}`,
      );
      return watch;
    }
  }

  /** Upserts the "which dates are cheap" snapshot that backs the recommended
   * date-range list — kept separate from price_history so it can hold a
   * full calendar's worth of dates without smearing the price-trend chart
   * (see the price_calendar_snapshot migration for why). Best-effort: a
   * failure here never fails watch creation/checking. */
  private async saveCalendarSnapshot(
    watchId: string,
    entries: CalendarDateEntry[],
  ): Promise<void> {
    const result = await this.supabase
      .getClient()
      .from('price_calendar_snapshot')
      .upsert({
        watch_id: watchId,
        captured_at: new Date().toISOString(),
        entries,
      });
    if (result.error) {
      this.logger.warn(
        `Failed to save calendar snapshot for watch ${watchId}: ${result.error.message}`,
      );
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

    const nowIso = new Date().toISOString();
    const watchUpdate = await client
      .from('watches')
      .update({
        baseline_price: found.price,
        baseline_captured_at: nowIso,
        baseline_offer_snapshot: found.rawOffer,
        latest_price: found.price,
        latest_checked_at: nowIso,
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
      latestPrice: row.latest_price !== null ? Number(row.latest_price) : null,
      latestCheckedAt: row.latest_checked_at,
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

  /** raw_offer on a multi_city_sum row is `{ legs: MultiCityLegResult[] }`
   * (see FareFinderService.findMultiCityFare) — narrowed defensively since
   * it's an untyped jsonb column, not just cast, in case an older row ever
   * has a different shape. */
  private parseMultiCityLegs(rawOffer: unknown): PriceHistoryLeg[] | undefined {
    if (
      !rawOffer ||
      typeof rawOffer !== 'object' ||
      !Array.isArray((rawOffer as { legs?: unknown }).legs)
    ) {
      return undefined;
    }

    const legs = (rawOffer as { legs: MultiCityLegResult[] }).legs;
    return legs.map((leg) => ({
      sequenceNo: leg.sequenceNo,
      originIata: leg.originIata,
      destinationIata: leg.destinationIata,
      departDate: leg.foundDate,
      price: leg.price,
    }));
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
