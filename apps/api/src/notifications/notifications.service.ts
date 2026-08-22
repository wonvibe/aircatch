import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PushSenderService } from './push-sender.service';
import { NotificationLogRow } from './notification.entities';
import { NotificationsPage } from './notification.types';

export interface DropNotification {
  watchId: string;
  userId: string;
  priceHistoryId: string | null;
  previousPrice: number;
  newPrice: number;
  currency: string;
  originIata: string | null;
  destinationIata: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly pushSender: PushSenderService,
  ) {}

  async getForUser(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<NotificationsPage> {
    let query = this.supabase
      .getClient()
      .from('notification_logs')
      .select(
        'id, watch_id, previous_price, new_price, drop_amount, drop_percent, message, status, sent_at',
      )
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(limit + 1); // fetch one extra row to know whether there's a next page

    if (cursor) {
      query = query.lt('sent_at', cursor);
    }

    const result = await query;
    if (result.error) throw result.error;

    const rows = (result.data ?? []) as NotificationLogRow[];
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? page[page.length - 1].sent_at : null;

    return {
      items: page.map((row) => ({
        id: row.id,
        watchId: row.watch_id,
        previousPrice: Number(row.previous_price),
        newPrice: Number(row.new_price),
        dropAmount: Number(row.drop_amount),
        dropPercent: Number(row.drop_percent),
        message: row.message,
        status: row.status,
        sentAt: row.sent_at,
      })),
      nextCursor,
    };
  }

  /**
   * Sends the drop push to every device the user has registered and logs
   * the outcome. Never throws — a push failure is recorded as
   * notification_logs.status='failed' rather than propagating, so a bad
   * push never aborts the caller's price-check loop.
   */
  async notifyDrop(input: DropNotification): Promise<void> {
    const dropAmount = input.previousPrice - input.newPrice;
    const dropPercent =
      input.previousPrice > 0 ? (dropAmount / input.previousPrice) * 100 : 0;
    const route =
      input.originIata && input.destinationIata
        ? `${input.originIata}→${input.destinationIata}`
        : '등록한 여정';
    const amountLabel =
      input.currency === 'KRW'
        ? `${dropAmount.toLocaleString('ko-KR')}원`
        : `${dropAmount.toLocaleString('en-US')} ${input.currency}`;
    const message = `${route}: 기존 최저가보다 ${amountLabel} 더 저렴해졌습니다!`;

    let status: 'sent' | 'failed' = 'failed';
    let ticketId: string | null = null;

    try {
      const tokens = await this.getDeviceTokens(input.userId);
      if (tokens.length === 0) {
        this.logger.warn(
          `Watch ${input.watchId}: no device tokens registered for user ${input.userId}`,
        );
      } else {
        const result = await this.pushSender.sendToTokens(tokens, {
          title: '항공권 특가 알림',
          body: message,
          data: { watchId: input.watchId },
        });
        ticketId = result.ticketId;
        status = ticketId !== null ? 'sent' : 'failed';
        if (result.invalidTokens.length > 0) {
          await this.pruneInvalidTokens(result.invalidTokens);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Push send failed for watch ${input.watchId}: ${(err as Error).message}`,
      );
    }

    const insert = await this.supabase
      .getClient()
      .from('notification_logs')
      .insert({
        watch_id: input.watchId,
        user_id: input.userId,
        price_history_id: input.priceHistoryId,
        previous_price: input.previousPrice,
        new_price: input.newPrice,
        drop_amount: dropAmount,
        drop_percent: Math.round(dropPercent * 100) / 100,
        message,
        status,
        expo_ticket_id: ticketId,
      });

    if (insert.error) {
      this.logger.warn(
        `Failed to record notification_logs for watch ${input.watchId}: ${insert.error.message}`,
      );
    }
  }

  private async getDeviceTokens(userId: string): Promise<string[]> {
    const result = await this.supabase
      .getClient()
      .from('device_tokens')
      .select('expo_push_token')
      .eq('user_id', userId);

    if (result.error) {
      this.logger.warn(
        `Failed to load device tokens for user ${userId}: ${result.error.message}`,
      );
      return [];
    }
    return (result.data ?? []).map((row) => row.expo_push_token);
  }

  private async pruneInvalidTokens(tokens: string[]): Promise<void> {
    const result = await this.supabase
      .getClient()
      .from('device_tokens')
      .delete()
      .in('expo_push_token', tokens);
    if (result.error) {
      this.logger.warn(
        `Failed to prune invalid device tokens: ${result.error.message}`,
      );
    }
  }
}
