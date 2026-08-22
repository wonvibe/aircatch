export interface NotificationLogRow {
  id: string;
  watch_id: string;
  user_id: string;
  price_history_id: string | null;
  previous_price: number;
  new_price: number;
  drop_amount: number;
  drop_percent: number;
  message: string;
  status: 'sent' | 'failed';
  expo_ticket_id: string | null;
  sent_at: string;
}
