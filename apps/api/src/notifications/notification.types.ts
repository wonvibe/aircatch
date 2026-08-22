export interface NotificationLogEntry {
  id: string;
  watchId: string;
  previousPrice: number;
  newPrice: number;
  dropAmount: number;
  dropPercent: number;
  message: string;
  status: 'sent' | 'failed';
  sentAt: string;
}

export interface NotificationsPage {
  items: NotificationLogEntry[];
  /** ISO timestamp to pass back as `cursor` for the next page, or null if this was the last page. */
  nextCursor: string | null;
}
