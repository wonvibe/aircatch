import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateWatchDto } from './dto/create-watch.dto';
import { UpdateWatchDto } from './dto/update-watch.dto';
import {
  WatchRow,
  WatchRowWithSegments,
  WatchSegmentRow,
} from './watch.entities';
import { WatchResponse, WatchSegmentResponse } from './watch.types';

@Injectable()
export class WatchesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(userId: string, dto: CreateWatchDto): Promise<WatchResponse> {
    const client = this.supabase.getClient();

    const inserted = await client
      .from('watches')
      .insert(this.toWatchRow(userId, dto))
      .select()
      .single();

    if (inserted.error) this.handleDbError(inserted.error);
    const watch = inserted.data;

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

      const segments = insertedSegments.data as WatchSegmentRow[];
      return this.toWatchResponse(watch, segments);
    }

    return this.toWatchResponse(watch, []);
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
    const result = await this.supabase
      .getClient()
      .from('watches')
      .select('*, watch_segments(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (result.error) this.handleDbError(result.error);
    if (!result.data) throw new NotFoundException('Watch not found');

    const row = result.data as WatchRowWithSegments;
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
