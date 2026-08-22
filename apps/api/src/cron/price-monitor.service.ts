import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FareFinderService } from '../pricing/fare-finder.service';
import {
  DropNotification,
  NotificationsService,
} from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  WatchRow,
  WatchRowWithSegments,
  WatchSegmentRow,
} from '../watches/watch.entities';

// PRD example: "기존 최저가보다 3만 원 더 저렴해졌습니다!" — 5,000원 is the MVP floor for
// what counts as a meaningful drop, independent of the user's own target price.
const MIN_DROP_THRESHOLD_KRW = 5_000;
// The hour is sliced into 12 five-minute windows; a watch is checked in
// exactly one of them, so the whole active set is swept once per hour
// without hammering Amadeus/the DB all at minute 0.
const SIMPLE_SLOT_COUNT = 12;

export interface SweepResult {
  checked: number;
  notified: number;
  failed: number;
}

type WatchWithSegments = { watch: WatchRow; segments: WatchSegmentRow[] };

@Injectable()
export class PriceMonitorService {
  private readonly logger = new Logger(PriceMonitorService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly fareFinder: FareFinderService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/5 * * * *')
  async runSimpleSlot(): Promise<SweepResult> {
    const slot = Math.floor(new Date().getMinutes() / 5);
    const watches = await this.fetchActiveSimpleWatches();
    const due = watches.filter((watch) => this.hashToSlot(watch.id) === slot);
    return this.checkAll(due.map((watch) => ({ watch, segments: [] })));
  }

  // Flight-offers (multi_city) is a heavier, more expensive call than
  // flight-dates and multi-city watches are expected to be low-volume, so
  // they get their own slower sweep instead of sharing the 5-minute slots.
  @Cron('0 */4 * * *')
  async runMultiCitySweep(): Promise<SweepResult> {
    const rows = await this.fetchActiveMultiCityWatches();
    return this.checkAll(
      rows.map((row) => ({ watch: row, segments: row.watch_segments })),
    );
  }

  /** Runs both sweeps once, synchronously, ignoring slot filtering entirely —
   * for the manual /internal/cron/run-price-check trigger (QA/debugging). */
  async runOnce(): Promise<{ simple: SweepResult; multiCity: SweepResult }> {
    const [simpleWatches, multiCityRows] = await Promise.all([
      this.fetchActiveSimpleWatches(),
      this.fetchActiveMultiCityWatches(),
    ]);
    const simple = await this.checkAll(
      simpleWatches.map((watch) => ({ watch, segments: [] })),
    );
    const multiCity = await this.checkAll(
      multiCityRows.map((row) => ({
        watch: row,
        segments: row.watch_segments,
      })),
    );
    return { simple, multiCity };
  }

  private async checkAll(items: WatchWithSegments[]): Promise<SweepResult> {
    let notified = 0;
    let failed = 0;
    for (const { watch, segments } of items) {
      try {
        if (await this.checkWatch(watch, segments)) notified += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Price check failed for watch ${watch.id}: ${(err as Error).message}`,
        );
      }
    }
    return { checked: items.length, notified, failed };
  }

  /** Returns true if a notification was sent for this watch. */
  private async checkWatch(
    watch: WatchRow,
    segments: WatchSegmentRow[],
  ): Promise<boolean> {
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

    if (!found) return false;

    const client = this.supabase.getClient();

    // Always record the check, whether or not it moves the baseline — this
    // is what powers the price-trend chart (GET /watches/:id/price-history).
    const historyInsert = await client
      .from('price_history')
      .insert({
        watch_id: watch.id,
        depart_date: found.departDate,
        return_date: found.returnDate,
        price: found.price,
        currency: found.currency,
        carrier_code: found.carrierCode,
        raw_offer: found.rawOffer,
        source: found.source,
      })
      .select('id')
      .single();

    if (historyInsert.error) {
      this.logger.warn(
        `Failed to record price_history for watch ${watch.id}: ${historyInsert.error.message}`,
      );
    }

    // No baseline yet (the initial capture on watch creation never
    // succeeded) — establish one now, silently, same as creation does.
    if (watch.baseline_price === null) {
      const init = await client
        .from('watches')
        .update({
          baseline_price: found.price,
          baseline_captured_at: new Date().toISOString(),
          baseline_offer_snapshot: found.rawOffer,
        })
        .eq('id', watch.id);
      if (init.error) {
        this.logger.warn(
          `Failed to set initial baseline for watch ${watch.id}: ${init.error.message}`,
        );
      }
      return false;
    }

    if (found.price >= watch.baseline_price) {
      return false; // no drop — already recorded in price_history above
    }

    const dropAmount = watch.baseline_price - found.price;
    const meetsThreshold =
      dropAmount >= MIN_DROP_THRESHOLD_KRW || found.price <= watch.target_price;
    const alreadyNotifiedAtThisOrLower =
      watch.last_notified_price !== null &&
      found.price >= watch.last_notified_price;

    if (!meetsThreshold || alreadyNotifiedAtThisOrLower) {
      // A real but sub-threshold (or already-notified) dip: leave the
      // baseline where it is so a later, larger drop from the *original*
      // baseline is still measured correctly and can still notify.
      return false;
    }

    const nowIso = new Date().toISOString();
    const watchUpdate = await client
      .from('watches')
      .update({
        baseline_price: found.price,
        baseline_captured_at: nowIso,
        baseline_offer_snapshot: found.rawOffer,
        last_notified_price: found.price,
        last_notified_at: nowIso,
      })
      .eq('id', watch.id);

    if (watchUpdate.error) {
      this.logger.warn(
        `Failed to update baseline for watch ${watch.id}: ${watchUpdate.error.message}`,
      );
      return false;
    }

    const notification: DropNotification = {
      watchId: watch.id,
      userId: watch.user_id,
      priceHistoryId: historyInsert.data?.id ?? null,
      previousPrice: watch.baseline_price,
      newPrice: found.price,
      currency: found.currency,
      originIata: watch.origin_iata,
      destinationIata: watch.destination_iata,
    };
    await this.notifications.notifyDrop(notification);

    return true;
  }

  private hashToSlot(id: string): number {
    const hex = id.replace(/-/g, '').slice(0, 8);
    return parseInt(hex, 16) % SIMPLE_SLOT_COUNT;
  }

  private async fetchActiveSimpleWatches(): Promise<WatchRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.supabase
      .getClient()
      .from('watches')
      .select('*')
      .eq('status', 'active')
      .in('trip_type', ['one_way', 'round_trip'])
      .gte('depart_date_to', today);

    if (result.error) {
      this.logger.warn(
        `Failed to load active watches: ${result.error.message}`,
      );
      return [];
    }
    return result.data ?? [];
  }

  private async fetchActiveMultiCityWatches(): Promise<WatchRowWithSegments[]> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.supabase
      .getClient()
      .from('watches')
      .select('*, watch_segments(*)')
      .eq('status', 'active')
      .eq('trip_type', 'multi_city')
      .gte('depart_date_to', today);

    if (result.error) {
      this.logger.warn(
        `Failed to load active multi-city watches: ${result.error.message}`,
      );
      return [];
    }
    return result.data ?? [];
  }
}
