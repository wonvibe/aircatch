import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export interface PushSendResult {
  /** The first successful ticket id, if any — used as notification_logs.expo_ticket_id. */
  ticketId: string | null;
  /** Tokens Expo reports as no longer registered; caller should prune these. */
  invalidTokens: string[];
}

/** Thin wrapper around expo-server-sdk: chunking, per-chunk failure
 * isolation, and translating "DeviceNotRegistered" tickets into tokens to
 * clean up. Knows nothing about Supabase or watches. */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);
  private readonly expo: Expo;

  constructor(config: ConfigService) {
    const accessToken = config.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo(accessToken ? { accessToken } : undefined);
  }

  async sendToTokens(
    tokens: string[],
    content: Pick<ExpoPushMessage, 'title' | 'body' | 'data'>,
  ): Promise<PushSendResult> {
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    if (validTokens.length === 0) {
      return { ticketId: null, invalidTokens: [] };
    }

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      ...content,
    }));
    const chunks = this.expo.chunkPushNotifications(messages);

    let firstTicketId: string | null = null;
    const invalidTokens: string[] = [];
    let cursor = 0;

    for (const chunk of chunks) {
      const chunkTokens = validTokens.slice(cursor, cursor + chunk.length);
      cursor += chunk.length;

      let tickets: ExpoPushTicket[];
      try {
        tickets = await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        this.logger.warn(`Expo push chunk failed: ${(err as Error).message}`);
        continue;
      }

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          firstTicketId ??= ticket.id;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunkTokens[index]);
        } else {
          this.logger.warn(
            `Expo push ticket error for ${chunkTokens[index]}: ${ticket.message}`,
          );
        }
      });
    }

    return { ticketId: firstTicketId, invalidTokens };
  }
}
